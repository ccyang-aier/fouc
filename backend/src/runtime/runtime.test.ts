import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFoucServiceConfig } from './config';
import { startFoucRoles } from './lifecycle';
import type { RoleFactory } from './lifecycle';

const base = {
  DATABASE_URL: 'postgresql://app:private@localhost:55432/fouc', BETTER_AUTH_URL: 'http://localhost:8710', BETTER_AUTH_SECRET: 'a'.repeat(32),
  REDIS_URL: 'redis://localhost:56379', S3_ENDPOINT: 'http://localhost:59000', S3_REGION: 'us-east-1', S3_BUCKET: 'fouc-knowledge',
  S3_ACCESS_KEY_ID: 'test-key', S3_SECRET_ACCESS_KEY: 'test-secret', MEDIA_WORKER_URL: 'http://localhost:8010',
};

test('roles and role-specific requirements are explicit, without an unauthenticated fallback', () => {
  assert.deepEqual(readFoucServiceConfig(base).roles, ['api', 'collab', 'worker', 'mcp']);
  assert.deepEqual(readFoucServiceConfig({ ...base, ROLE: 'mcp', REDIS_URL: undefined, S3_ENDPOINT: undefined }).roles, ['mcp']);
  assert.deepEqual(readFoucServiceConfig({ ...base, ROLE: 'api,collab', MEDIA_WORKER_URL: undefined }).roles, ['api', 'collab']);
  assert.deepEqual(readFoucServiceConfig({ ...base, ROLE: 'collab, collab,api' }).roles, ['collab', 'api']);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'api,shell' }), /ROLE/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'all,api' }), /ROLE/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: ',' }), /ROLE/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'collab', REDIS_URL: undefined }), /REDIS_URL/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'api', S3_ENDPOINT: undefined }), /S3_ENDPOINT/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'worker', MEDIA_WORKER_URL: undefined }), /MEDIA_WORKER_URL/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'shell' }), /ROLE/);
  assert.throws(() => readFoucServiceConfig({ ...base, BETTER_AUTH_SECRET: '' }), /BETTER_AUTH_SECRET/);
  assert.throws(() => readFoucServiceConfig({ ...base, ROLE: 'mcp', S3_SECRET_ACCESS_KEY: undefined }), /S3_SECRET_ACCESS_KEY/);
});

test('invalid endpoints, origins, and ports never echo secret values', () => {
  for (const change of [{ DATABASE_URL: 'http://password-should-not-be-logged' }, { BETTER_AUTH_URL: 'password-should-not-be-logged' }, { FOUC_SERVICE_PORT: '0' }, { FOUC_AUTH_TRUSTED_ORIGINS: '*' }, { FOUC_AUTH_TRUSTED_ORIGINS: 'https://example.com/path' }]) {
    assert.throws(() => readFoucServiceConfig({ ...base, ...change }), (error) => error instanceof Error && !error.message.includes('password-should-not-be-logged'));
  }
  assert.deepEqual(readFoucServiceConfig({ ...base, FOUC_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000,https://example.com' }).auth.trustedOrigins, ['http://localhost:8710', 'http://localhost:3000', 'https://example.com']);
  assert.deepEqual(readFoucServiceConfig({ ...base, BETTER_AUTH_URL: 'http://localhost:8710/' }).auth.trustedOrigins, ['http://localhost:8710']);
});

test('combined roles stop in reverse order exactly once and abort shared work', async () => {
  const actions: string[] = [];
  let signal: AbortSignal | undefined;
  const factory = (name: string): RoleFactory => async (context) => {
    signal = context.signal;
    actions.push(`start:${name}`);
    return { health: async () => ({ status: 'ready' }), close: async () => { actions.push(`close:${name}`); } };
  };
  const runtime = await startFoucRoles(readFoucServiceConfig(base), { api: factory('api'), collab: factory('collab'), worker: factory('worker'), mcp: factory('mcp') });
  assert.equal((await runtime.health()).status, 'ready');
  await Promise.all([runtime.close(), runtime.close()]);
  assert.equal(signal?.aborted, true);
  assert.deepEqual(actions.slice(4), ['close:mcp', 'close:worker', 'close:collab', 'close:api']);
  assert.equal((await runtime.health()).status, 'stopped');
});

test('startup failure releases started roles, and missing factories do not partially start', async () => {
  const config = readFoucServiceConfig({ ...base, ROLE: 'all' });
  let closed = 0, started = 0;
  const ready: RoleFactory = async () => { started++; return { health: async () => ({ status: 'ready' }), close: async () => { closed++; } }; };
  await assert.rejects(() => startFoucRoles(config, { api: ready }), /not registered/);
  assert.equal(started, 0);
  await assert.rejects(() => startFoucRoles(config, { api: ready, collab: async () => { throw new Error('connection refused'); }, worker: ready, mcp: ready }), /connection refused/);
  assert.equal(started, 1);
  assert.equal(closed, 1);
});

test('unhealthy probes degrade readiness without exposing internal errors', async () => {
  const runtime = await startFoucRoles(readFoucServiceConfig({ ...base, ROLE: 'api' }), {
    api: async () => ({ close: async () => {}, health: async () => { throw new Error('private-connection-details'); } }),
  });
  assert.deepEqual(await runtime.health(), { status: 'degraded', roles: { api: { status: 'degraded', detail: 'Health probe failed' } } });
  await runtime.close();
});
