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
import { createKnowledgeApiRoutes } from '../../api/knowledge';
import { createPageCollaborationListener } from '../collaboration/page-collaboration-bun';
import { createWorkspaceEventRuntime } from '../collaboration/events';
import { createKnowledgeMcpRequestHandler } from '../mcp/server';
import { handleKnowledgeMcpOnBun } from '../mcp/bun-adapter';

const mcpPathPattern = /\/api\/knowledge\/[a-zA-Z0-9-]+\/mcp\/?$/;

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
  const events = createWorkspaceEventRuntime({ authenticator });
  const app = new Hono();
  app.route('/', createKnowledgeAuthRoutes(auth, (context) => context.env.clientAddress as string));
  app.route('/', createOrganizationRoutes(auth, createOrganizationService(pool, { permissions: teamspacePermissionInvalidator })));
  app.route('/', createKnowledgeApiRoutes({ auth, pool }));

  let mcp: ReturnType<typeof createKnowledgeMcpRequestHandler> | undefined;
  const listener = createPageCollaborationListener({ authenticator, pool }, {
    port: config.port,
    hostname: config.hostname,
    events: events.channel,
    ...(config.redisUrl ? { broadcast: { redisUrl: config.redisUrl } } : {}),
    http: async (request, clientAddress) => {
      if (mcp && mcpPathPattern.test(new URL(request.url).pathname)) return handleKnowledgeMcpOnBun(mcp, request);
      return app.fetch(request, { clientAddress });
    },
  });
  if (config.roles.includes('mcp')) mcp = createKnowledgeMcpRequestHandler({ authenticator, pool, hocuspocus: listener.hocuspocus });
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
