import { randomBytes } from 'node:crypto';
import { expect, test } from 'bun:test';
import { startFoucService } from './server';
import { readFoucServiceConfig } from '../platform/runtime/config';
import { readFoucDatabaseConnections } from '../platform/database/initialize-config';
import { createResourceTestDatabase } from '../platform/database/resources/resource-test-database';

test('shared HTTP listener preserves account and project boundaries after knowledge removal', async () => {
  const database = await createResourceTestDatabase();
  const connections = await readFoucDatabaseConnections();
  const application = new URL(connections.application);
  application.pathname = '/' + database.name;
  const origin = 'http://localhost:3000';
  const config = readFoucServiceConfig({ DATABASE_URL: application.toString(), BETTER_AUTH_URL: 'http://localhost:8711', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'), FOUC_AUTH_TRUSTED_ORIGINS: origin });
  const runtime = await startFoucService({ ...config, port: 0 });
  const base = 'http://127.0.0.1:' + runtime.port;
  try {
    const session = await fetch(base + '/api/auth/get-session', { headers: { origin, 'x-fouc-auth-client-ip': 'spoofed.invalid', 'x-forwarded-for': 'spoofed.invalid' } });
    expect(session.status).toBe(200);
    expect(await session.json()).toBeNull();
    const denied = await fetch(base + '/api/auth/get-session', { headers: { origin: 'https://foreign.example' } });
    expect(denied.status).toBe(403);
    expect((await fetch(base + '/api/projects', { headers: { origin } })).status).toBe(401);
    expect((await fetch(base + '/api/knowledge/catalog', { headers: { origin } })).status).toBe(404);
  } finally {
    await runtime.close();
    await database.dispose();
  }
}, 30_000);
