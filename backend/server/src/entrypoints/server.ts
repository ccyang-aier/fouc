import { readFoucOAuthOptions } from '../platform/identity/oauth-config';
import { createFoucSocketTickets } from '../platform/identity/socket-tickets';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { Hono } from 'hono';
import { readFoucServiceConfig } from '../platform/runtime/config';
import type { FoucServiceConfig } from '../platform/runtime/config';
import { createFoucAuth, createFoucAuthRoutes, createSmtpAuthEmailTransport } from '../platform/identity';
import { createKnowledgeRequestAuthenticator } from '../modules/knowledge/access';
import { createVerificationEmailTransport } from '../platform/identity/email';
import { createWorkspaceRoutes, createWorkspaceService } from '../modules/workspaces';
import { createProjectRoutes, createProjectService } from '../modules/projects';
import { createKnowledgeCatalogRoutes, createKnowledgeCatalogService } from '../modules/knowledge/organization';
import { teamspacePermissionInvalidator } from '../modules/knowledge/permissions/fence';
import { createKnowledgeApiRoutes, createKnowledgePatRoutes } from '../modules/knowledge/api';
import { createKnowledgeCheckpointRoutes } from '../modules/knowledge/api/checkpoint-routes';
import { createKnowledgeNotificationRoutes } from '../modules/knowledge/notifications';
import { bindKnowledgeStreamingTasks, createKnowledgeStreamingTasks } from '../modules/knowledge/ai';
import { createModelGateway } from '../modules/knowledge/ai/gateway';
import { createPageCollaborationListener } from '../modules/knowledge/collaboration/page-collaboration-bun';
import { createWorkspaceEventRuntime } from '../modules/knowledge/collaboration/events';
import { pageCheckpointExtension } from '../modules/knowledge/collaboration/checkpoints';
import { createKnowledgeMcpAuthorizationRoutes } from '../modules/knowledge/mcp/oauth';
import { createKnowledgeMcpRequestHandler } from '../modules/knowledge/mcp/server';
import { handleKnowledgeMcpOnBun } from '../modules/knowledge/mcp/bun-adapter';

const mcpPathPattern = /^\/api\/knowledge\/[a-zA-Z0-9-]+\/mcp\/?$/;

export interface FoucServiceRuntime {
  port: number;
  close(): Promise<void>;
}

/**
 * The single-process composition behind the shared HTTP listener (Z03): one
 * Bun socket hosts the auth routes, the organization API, the per-workspace
 * tRPC boundary, the MCP endpoint and the collaboration WebSocket upgrades.
 * Dedicated-role deployments reuse the same factories with narrower roles.
 */
export async function startFoucService(config: FoucServiceConfig, environment: NodeJS.ProcessEnv = process.env): Promise<FoucServiceRuntime> {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 8 });
  pool.on('error', () => {});
  const auth = createFoucAuth({
    pool,
    config: config.auth,
    oauth: readFoucOAuthOptions(environment),
    // Production reads SMTP from the environment; a development process
    // without SMTP prints each verification link to its own log.
    email: environment.SMTP_HOST
      ? createSmtpAuthEmailTransport(environment)
      : createVerificationEmailTransport('noreply@fouc.dev', async (message: { to: string; subject: string; text: string }) => { console.log(`[auth] ${message.subject} → ${message.to}\n${message.text}`); }),
  });
  const authenticator = createKnowledgeRequestAuthenticator({ auth, pool });
  const externalOrigin = new URL(config.auth.baseUrl).origin;
  const events = createWorkspaceEventRuntime({ authenticator });
  const checkpoints = config.roles.includes('collab') ? pageCheckpointExtension({ pool }) : undefined;
  const app = new Hono();
  const socketTickets = createFoucSocketTickets();
  app.route('/', createFoucAuthRoutes(auth, (context) => context.env.clientAddress as string, socketTickets));
  app.route('/', createWorkspaceRoutes(auth, createWorkspaceService(pool)));
  app.route('/', createProjectRoutes(auth, createProjectService(pool)));
  app.route('/', createKnowledgeCatalogRoutes(auth, createKnowledgeCatalogService(pool, { permissions: teamspacePermissionInvalidator })));
  app.route('/', createKnowledgeApiRoutes({ auth, pool }));
  app.route('/', createKnowledgePatRoutes({ auth, pool }));
  app.route('/', createKnowledgeMcpAuthorizationRoutes({ auth, pool, externalOrigin }));
  app.route('/', createKnowledgeCheckpointRoutes({ auth, pool, checkpoints }));
  app.route('/', createKnowledgeNotificationRoutes({ authenticator, pool, trustedOrigins: auth.options.trustedOrigins as string[] }));

  let mcp: ReturnType<typeof createKnowledgeMcpRequestHandler> | undefined;
  const listener = createPageCollaborationListener({ authenticator, pool }, {
    socketTickets,
    port: config.port,
    hostname: config.hostname,
    events: events.channel,
    ...(config.redisUrl ? { broadcast: { redisUrl: config.redisUrl } } : {}),
    ...(checkpoints ? { checkpoints } : {}),
    http: async (request, clientAddress) => {
      if (mcp && mcpPathPattern.test(new URL(request.url).pathname)) return handleKnowledgeMcpOnBun(mcp, request);
      return app.fetch(request, { clientAddress });
    },
  });
  if (config.roles.includes('mcp')) mcp = createKnowledgeMcpRequestHandler({ authenticator, pool, hocuspocus: listener.hocuspocus, oauth: { externalOrigin } });
  // J04: bind the streaming AI task service to the tRPC registry. Without
  // model credentials the gateway holds no platform binding and aiTask.*
  // answers SERVICE_UNAVAILABLE by design.
  if (config.roles.includes('api')) {
    const models = config.models;
    const gateway = createModelGateway({
      platform: models.apiKey && models.chatBaseUrl && models.model ? {
        providers: { zhipu: { apiKey: models.apiKey, endpoint: models.chatBaseUrl } },
        defaults: { fast: { source: 'platform', provider: 'zhipu', model: models.model }, smart: { source: 'platform', provider: 'zhipu', model: models.model } },
      } : { providers: {}, defaults: {} },
      providers: models.apiKey && models.chatBaseUrl ? { zhipu: { protocol: 'openai-compatible', endpoints: [models.chatBaseUrl], tiers: ['fast', 'smart'] } } : {},
      ollamaEndpoints: models.ollamaEndpoint ? [models.ollamaEndpoint] : [],
    });
    bindKnowledgeStreamingTasks(createKnowledgeStreamingTasks({
      pool,
      gateway,
      hocuspocus: config.roles.includes('collab') ? listener.hocuspocus : undefined,
    }));
  }
  console.log(`Fouc service ready on http://${config.hostname}:${listener.port} (roles: ${config.roles.join(',')})`);
  return {
    port: listener.port as number,
    async close() {
      await listener.close();
      await pool.end();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => controller.abort());
  const runtime = await startFoucService(readFoucServiceConfig(process.env));
  controller.signal.addEventListener('abort', () => { void runtime.close(); });
}
