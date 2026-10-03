import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './server';
import { RedisSessionManager } from '../database/redis-session';
import { DeviceConnectionRepository } from '../database/connection-repository';
import { redisConfig } from '../database/redis-input';

const directory = mkdtempSync(path.join(tmpdir(), 'fouc-redis-api-'));
const sessions = new RedisSessionManager();
const connections = new DeviceConnectionRepository(directory, redisConfig);
const app = createApp({
  registry: {} as never,
  supervisor: {} as never,
  connectors: {} as never,
  redisSessions: sessions,
  redisConnections: connections,
  token: 'frontend-token',
  internalToken: 'native-only-token',
}).app;
const base = '/api/database/workspaces/workspace-a/redis';
const config = {
  provider: 'redis',
  host: '127.0.0.1',
  port: 6379,
  username: '',
  database: 0,
  tls: false,
  password: 'discard-me',
};
afterAll(() => {
  sessions.shutdown();
  const target = path.resolve(directory);
  if (
    !target.startsWith(path.resolve(tmpdir()) + path.sep) ||
    !path.basename(target).startsWith('fouc-redis-api-')
  )
    throw new Error('Unexpected test cleanup target');
  rmSync(target, { recursive: true });
});

test('Redis routes require device authentication before config or session access', async () => {
  for (const route of ['/connections', '/sessions'])
    expect((await app.request(base + route)).status).toBe(401);
  for (const suffix of ['scan', 'value', 'command', 'database', 'write-mode', 'edit-string', 'mutations/preview', 'mutations/commit', 'stream/groups', 'stream/consumers', 'stream/pending', 'monitor', 'pubsub', 'pubsub/publish', 'pubsub/unknown/subscriptions']) {
    expect(
      (await app.request(base + '/sessions/unknown/' + suffix, { method: 'POST', body: '{}' })).status,
    ).toBe(401);
    expect((await app.request(base + '/sessions/unknown/' + suffix, { method: 'POST', body: '{}', headers: { authorization: 'Bearer frontend-token', 'content-type': 'application/json' } })).status).toBe(400);
  }
  for (const suffix of ['databases', 'history', 'info', 'slowlog', 'pubsub/unknown/subscriptions', 'json-capability']) {
    expect((await app.request(base + '/sessions/unknown/' + suffix)).status).toBe(401);
    expect((await app.request(base + '/sessions/unknown/' + suffix, { headers: { authorization: 'Bearer frontend-token' } })).status).toBe(400);
  }
  expect((await app.request(base + '/sessions/unknown/history', { method: 'DELETE' })).status).toBe(401);
});
test('Redis config CRUD stays scoped and never persists the supplied secret', async () => {
  const headers = { authorization: 'Bearer frontend-token', 'content-type': 'application/json' };
  const response = await app.request(base + '/connections', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Redis source', config }),
  });
  expect(response.status).toBe(201);
  const { data: saved } = (await response.json()) as { data: { id: string; config: unknown } };
  expect(JSON.stringify(saved)).not.toContain('discard-me');
  expect(
    (
      await app.request(base.replace('workspace-a', 'workspace-b') + '/connections/' + saved.id, {
        method: 'DELETE',
        headers,
      })
    ).status,
  ).toBe(400);
  const listed = await app.request(base.replace('workspace-a', 'workspace-b') + '/connections', { headers });
  expect(((await listed.json()) as { data: unknown[] }).data).toEqual([]);
  expect((await app.request(base + '/connections/' + saved.id, { method: 'DELETE', headers })).status).toBe(
    200,
  );
  expect(connections.list('workspace-a')).toHaveLength(0);
});
