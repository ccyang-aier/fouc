import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { Hono } from 'hono';
import { readKnowledgeConfig } from './config';
import type { KnowledgeConfig } from './config';
import { createKnowledgeAuth, createKnowledgeAuthRoutes, createKnowledgeRequestAuthenticator, readKnowledgeAuthConfig, createSmtpAuthEmailTransport } from '../auth';
import { createVerificationEmailTransport } from '../auth/email';
import { createOrganizationRoutes } from '../organization/http';
import { createOrganizationService } from '../organization/service';
import { teamspacePermissionInvalidator } from '../permissions/fence';
import { createKnowledgeApiRoutes, createKnowledgePatRoutes } from '../../api/knowledge';
import { createKnowledgeCheckpointRoutes } from '../../api/knowledge/checkpoint-routes';
import { createKnowledgeNotificationRoutes } from '../notifications';
import { bindKnowledgeStreamingTasks, createKnowledgeStreamingTasks } from '../ai';
import { createModelGateway } from '../ai/gateway';
import { createPageCollaborationListener } from '../collaboration/page-collaboration-bun';
import { createWorkspaceEventRuntime } from '../collaboration/events';
import { pageCheckpointExtension } from '../collaboration/checkpoints';
import { createKnowledgeMcpAuthorizationRoutes } from '../mcp/oauth';
import { createKnowledgeMcpRequestHandler } from '../mcp/server';
import { handleKnowledgeMcpOnBun } from '../mcp/bun-adapter';

const mcpPathPattern = /^\/api\/knowledge\/[a-zA-Z0-9-]+\/mcp\/?$/;

export interface KnowledgeRuntime {
  port: number;
  close(): Promise<void>;
}

/**
 * The single-process composition behind the shared HTTP listener (Z03): one
 * Bun socket hosts the auth routes, the organization API, the per-workspace
 * tRPC boundary, the MCP endpoint and the collaboration WebSocket upgrades.
 * Dedicated-role deployments reuse the same factories with narrower roles.
 */
export async function startKnowledgeRuntime(config: KnowledgeConfig, environment: NodeJS.ProcessEnv = process.env): Promise<KnowledgeRuntime> {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 8 });
  pool.on('error', () => {});
  const auth = createKnowledgeAuth({
    pool,
    config: readKnowledgeAuthConfig(environment),
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
  app.route('/', createKnowledgeAuthRoutes(auth, (context) => context.env.clientAddress as string));
  app.route('/', createOrganizationRoutes(auth, createOrganizationService(pool, { permissions: teamspacePermissionInvalidator })));
  app.route('/', createKnowledgeApiRoutes({ auth, pool }));
  app.route('/', createKnowledgePatRoutes({ auth, pool }));
  app.route('/', createKnowledgeMcpAuthorizationRoutes({ auth, pool, externalOrigin }));
  app.route('/', createKnowledgeCheckpointRoutes({ auth, pool, checkpoints }));
  app.route('/', createKnowledgeNotificationRoutes({ authenticator, pool, trustedOrigins: auth.options.trustedOrigins as string[] }));

  let mcp: ReturnType<typeof createKnowledgeMcpRequestHandler> | undefined;
  const listener = createPageCollaborationListener({ authenticator, pool }, {
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
  console.log(`knowledge runtime ready on http://${config.hostname}:${listener.port} (roles: ${config.roles.join(',')})`);
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
  const runtime = await startKnowledgeRuntime(readKnowledgeConfig(process.env));
  controller.signal.addEventListener('abort', () => { void runtime.close(); });
}
