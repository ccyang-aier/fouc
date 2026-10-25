import { createAdaptorServer } from '@hono/node-server';
import { readFoucOAuthOptions } from '../platform/identity/oauth-config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { Hono } from 'hono';
import { readFoucServiceConfig } from '../platform/runtime/config';
import type { FoucServiceConfig } from '../platform/runtime/config';
import { createFoucAuth, createFoucAuthRoutes, createSmtpAuthEmailTransport } from '../platform/identity';
import { createVerificationEmailTransport } from '../platform/identity/email';
import { createProjectRoutes, createProjectService } from '../modules/projects';
import { createTaskBoardRoutes, createTaskBoardService } from '../modules/tasks';
import { createChannelRoutes, createChannelService } from '../modules/chats';
import { createS3ObjectStorage } from '../platform/storage/s3';
import { createModelCatalogRoutes } from '../modules/models/http';
import { createModelCatalogRepository } from '../modules/models/repository';

export interface FoucServiceRuntime {
  port: number;
  close(): Promise<void>;
}

/** Shared HTTP listener for identity, projects, tasks, chats. */
export async function startFoucService(config: FoucServiceConfig, environment: NodeJS.ProcessEnv = process.env): Promise<FoucServiceRuntime> {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 8 });
  pool.on('error', () => {});
  const auth = createFoucAuth({
    pool,
    config: config.auth,
    oauth: readFoucOAuthOptions(environment),
    email: environment.SMTP_HOST
      ? createSmtpAuthEmailTransport(environment)
      : createVerificationEmailTransport('noreply@fouc.dev', async (message: { to: string; subject: string; text: string }) => { console.log(`[auth] ${message.subject} → ${message.to}\n${message.text}`); }),
  });
  const app = new Hono<{ Bindings: { clientAddress: string } }>();
  const origins = auth.options.trustedOrigins as string[];
  app.route('/', createModelCatalogRoutes(createModelCatalogRepository(pool), origins));
  app.route('/', createFoucAuthRoutes(auth, context => context.env.clientAddress as string));
  app.route('/', createProjectRoutes(auth, createProjectService(pool)));
  const objectStorage = config.storage ? createS3ObjectStorage(config.storage) : undefined;
  app.route('/', createTaskBoardRoutes(auth, createTaskBoardService(pool, objectStorage)));
  app.route('/', createChannelRoutes(auth, createChannelService(pool, objectStorage)));
  const listener = createAdaptorServer({
    fetch: (request, bindings) => app.fetch(request, { clientAddress: bindings.incoming.socket.remoteAddress ?? '' }),
  });
  try {
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(config.port, config.hostname, () => { listener.removeListener('error', reject); resolve(); });
    });
  } catch (error) {
    await pool.end();
    throw error;
  }
  const port = (listener.address() as AddressInfo).port;
  console.log(`Fouc service ready on http://${config.hostname}:${port}`);
  return {
    port,
    async close() {
      await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
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
