import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';

// Dedicated Redis lab (56380), with threshold=0 and capacity=512 at startup.
// Never changes slowlog configuration or resets logs on the business Redis.
const Redis = createRequire(new URL('../backend/device/package.json', import.meta.url))('ioredis');
const endpoint = new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).REDIS_URL);
const host = process.env.FOUC_REDIS_OBSERVABILITY_HOST || endpoint.hostname;
const port = Number(process.env.FOUC_REDIS_OBSERVABILITY_PORT || 56380);
const config = { provider: 'redis', host, port, username: '', database: 15, tls: false, password: '' };
const client = new Redis({ host, port, db: 15, retryStrategy: () => null, stringNumbers: true });
client.on('error', () => {});
const base = 'http://127.0.0.1:8710/api/database/workspaces/dbx-redis-observability-verification/redis';
const prefix = 'fouc:dbx-observability-lab:';
const aclName = 'fouc_dbx_observability_verifier', aclPassword = crypto.randomUUID();
let session, limited;
async function request(path, { body, method = body ? 'POST' : 'GET', status = 200, workspace } = {}) {
  const response = await fetch((workspace ? base.replace('dbx-redis-observability-verification', workspace) : base) + path, {
    method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  assert.equal(response.status, status, `${path}: ${result.error?.message}`);
  assert.equal(result.ok, status < 400);
  return result.ok ? result.data : result.error;
}
try {
  await client.ping();
  const settings = await client.config('GET', 'slowlog-*');
  const values = new Map(Array.from({ length: settings.length / 2 }, (_, index) => [settings[index * 2], settings[index * 2 + 1]]));
  assert.equal(values.get('slowlog-log-slower-than'), '0', 'use the dedicated lab, never reconfigure application Redis');
  assert.equal(values.get('slowlog-max-len'), '512');
  await client.client('SETNAME', 'Fouc_Redis_observability_lab');
  await client.set(prefix + 'sample', 'native sample');
  for (let index = 0; index < 160; index++) await client.get(prefix + 'sample');
  const binary = Buffer.from([0, 255, 1, 32, 34]);
  await client.set(prefix + 'binary', binary);
  session = await request('/sessions', { body: config, status: 201 });
  assert.equal(session.readOnly, true);
  const path = (suffix) => `/sessions/${session.id}/${suffix}`;
  const info = await request(path('info'));
  assert.ok(info.sections.some((section) => section.name === 'Memory' && section.entries.some((entry) => entry.key === 'used_memory')));
  assert.ok(info.sections.some((section) => section.name === 'Keyspace' && section.entries.some((entry) => entry.key === 'db15')));
  assert.ok(info.executionTimeMs >= 0 && info.fetchedAt > 0);
  const logs = await request(path('slowlog') + '?count=300');
  assert.equal(logs.thresholdMicros, '0'); assert.equal(logs.maxEntries, '512'); assert.ok(BigInt(logs.totalEntries) >= 160n);
  assert.ok(logs.entries.length >= 160 && logs.omittedEntries === 0);
  const logged = logs.entries.find((entry) => entry.arguments[0]?.display.toUpperCase() === 'SET' && entry.arguments[1]?.display === prefix + 'binary');
  assert.ok(logged); assert.equal(logged.arguments[2].rawBase64, binary.toString('base64'));
  assert.equal(logged.clientName.display, 'Fouc_Redis_observability_lab');
  assert.ok(/^\d+$/.test(logged.id) && /^\d+$/.test(logged.durationMicros));
  assert.equal(logged.originalArgumentCount, null, 'Redis 7.4 does not provide the Redis 8.10 count field');
  assert.ok((await request(path('slowlog') + '?count=1')).entries.length <= 1);
  for (const count of ['0', '-1', '10001', '1.5', 'NaN']) await request(path('slowlog') + '?count=' + count, { status: 400 });
  for (const suffix of ['info', 'slowlog']) await request(path(suffix), { workspace: 'other-workspace', status: 400 });
  assert.equal((await request(path('history'))).entries.length, 0, 'dashboard reads do not pollute command history');
  await request(path('mutations/preview'), { body: { mutation: { kind: 'delete', key: Buffer.from(prefix + 'sample').toString('base64') } }, status: 400 });
  assert.equal(await client.get(prefix + 'sample'), 'native sample');
  await client.acl('SETUSER', aclName, 'reset', 'on', `>${aclPassword}`, `~${prefix}*`, '+@all', '-config', '-slowlog|len');
  limited = await request('/sessions', { body: { ...config, username: aclName, password: aclPassword }, status: 201 });
  const limitedPath = `/sessions/${limited.id}`;
  const partial = await request(limitedPath + '/slowlog?count=2');
  assert.ok(partial.entries.length > 0); assert.equal(partial.totalEntries, null); assert.equal(partial.thresholdMicros, null);
  assert.equal(partial.maxEntries, null); assert.equal(partial.warnings.length, 2);
  await client.acl('SETUSER', aclName, '-info', '-slowlog|get');
  await request(limitedPath + '/slowlog', { status: 502 });
  await request(limitedPath + '/info', { status: 502 });
  await request(`/sessions/${session.id}`, { method: 'DELETE' }); session = null;
  await request(limitedPath + '/info', { status: 502 });
  console.log('PASS Redis observability: native INFO sections, real slowlog/binary/client fields, bounded counts, DB/workspace scope, history and read-only preservation, optional ACL metadata, denied GET/INFO errors; dedicated lab port ' + port + '.');
} finally {
  for (const entry of [session, limited]) if (entry) await request(`/sessions/${entry.id}`, { method: 'DELETE' }).catch(() => {});
  await client.acl('DELUSER', aclName).catch(() => {});
  await client.quit().catch(() => client.disconnect());
}
