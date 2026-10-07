import { describe, expect, test } from 'bun:test';
import { DatabaseCapabilityRegistry } from '../database/capability-registry';
import { createApp } from './server';
import { RedisSessionManager } from '../database/redis-session';


function testApp(registry: DatabaseCapabilityRegistry) {
  return createApp({
    registry: {} as never,
    supervisor: {} as never,
    connectors: {} as never,
    databaseCapabilities: registry,
    redisSessions: new RedisSessionManager(),
    token: 'frontend-token',
    internalToken: 'native-only-token',
  }).app;
}

describe('database capability API', () => {
  test('serves the validated catalog behind the same authentication boundary', async () => {
    const app = testApp(new DatabaseCapabilityRegistry());
    expect((await app.request('/api/database/catalog')).status).toBe(401);
    const headers = { authorization: 'Bearer frontend-token' };
    const response = await app.request('/api/database/catalog', { headers });
    expect(response.status).toBe(200);
    const catalog = (await response.json() as { data: { declarationOnly: boolean; drivers: unknown[]; profiles: unknown[] } }).data;
    expect(catalog.declarationOnly).toBe(true);
    expect(catalog.drivers).toHaveLength(81);
    expect(catalog.profiles).toHaveLength(104);
    expect((await app.request('/api/database/catalog/dialects/MySQL', { headers })).status).toBe(200);
    expect((await app.request('/api/database/catalog/dialects/unknown', { headers })).status).toBe(404);
    expect((await app.request('/api/database/catalog/profiles/mysql')).status).toBe(401);
    const profile = await app.request('/api/database/catalog/profiles/mysql', { headers });
    expect(profile.status).toBe(200);
    expect((await profile.json() as { data: { port: number; user: string } }).data).toMatchObject({ port: 3306, user: 'root' });
    expect((await app.request('/api/database/catalog/profiles/unknown', { headers })).status).toBe(404);
  });

  test('Redis write endpoints require device authentication and an owned active session', async () => {
    const app = testApp(new DatabaseCapabilityRegistry());
    const base = '/api/database/redis/sessions/missing';
    for (const path of ['/write-mode', '/edit-string', '/mutations/preview', '/mutations/commit']) {
      const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
      expect((await app.request(base + path, options)).status).toBe(401);
      expect((await app.request(base + path, { ...options, headers: { ...options.headers, authorization: 'Bearer frontend-token' } })).status).toBe(400);
    }
  });

});
