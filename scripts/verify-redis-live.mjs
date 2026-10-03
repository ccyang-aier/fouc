import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';

// Explicit test datasource, independent DB 15 and prefix. Never flush a DB or
// read Fouc application cache keys. Passwords never appear in console output.
const environment = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
const endpoint = new URL(environment.REDIS_URL);
const require = createRequire(new URL('../backend/device/package.json', import.meta.url));
const Redis = require('ioredis');
const config = { provider: 'redis', host: endpoint.hostname, port: Number(endpoint.port || 6379), username: decodeURIComponent(endpoint.username), database: 15, tls: endpoint.protocol === 'rediss:' };
const password = decodeURIComponent(endpoint.password);
const client = new Redis({ host: config.host, port: config.port, username: config.username || undefined, password: password || undefined, db: config.database, retryStrategy: () => null, connectTimeout: 10000, commandTimeout: 10000 });
client.on('error', () => {});
const prefix = 'fouc:dbx-lab:';
const base = 'http://127.0.0.1:8710/api/database/workspaces/dbx-redis-live-verification/redis';
const key = (suffix) => prefix + suffix;
const raw = (value) => Buffer.from(value).toString('base64');
async function request(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  assert.ok(response.ok && result.ok, `${route}: ${response.status} ${result.error?.message}`);
  return result.data;
}
let saved, session;
try {
  await client.ping();
  const owned = ['json', 'binary', 'large', 'list', 'set', 'hash', 'zset', 'stream', 'expired', 'ttl'].map(key);
  const binaryKey = Buffer.concat([Buffer.from(prefix), Buffer.from([0, 255])]);
  // Reset only named fixtures owned by this verifier, then retain them for UI QA.
  await client.del(...owned, binaryKey);
  await client.set(key('json'), '{"name":"Redis 工作台","ready":true}');
  await client.set(key('binary'), Buffer.from([0, 255, 1]));
  await client.set(binaryKey, 'binary-key-value');
  await client.set(key('large'), 'x'.repeat(70000));
  await client.rpush(key('list'), ...Array.from({ length: 105 }, (_, index) => `item-${index}`));
  await client.sadd(key('set'), '成员一', '成员二');
  await client.hset(key('hash'), 'name', 'Fouc', 'binary', Buffer.from([0, 255]));
  await client.zadd(key('zset'), '1.25', 'first', '9007199254740992', 'large-score');
  for (let index = 0; index < 105; index++) await client.xadd(key('stream'), '*', 'event', `entry-${index}`);
  await client.set(key('ttl'), 'expiring', 'EX', 600);
  saved = await request('/connections', { name: 'Redis runtime verification', config: { ...config, password } });
  assert.ok(!JSON.stringify(saved).includes('password'));
  session = await request(`/connections/${saved.id}/connect`, { password });
  assert.equal(session.database, 15);
  const seen = new Set(); let cursor = '0'; let iterations = 0;
  do { const page = await request(`/sessions/${session.id}/scan`, { cursor, pattern: prefix + '*' }); cursor = page.cursor; page.keys.forEach((entry) => seen.add(entry.key.rawBase64)); assert.ok(++iterations < 50); } while (cursor !== '0');
  assert.ok(seen.has(raw(binaryKey)));
  for (const kind of ['json', 'binary', 'large', 'list', 'set', 'hash', 'zset', 'stream', 'ttl']) assert.ok(seen.has(raw(key(kind))));
  const value = (suffix, cursor = '0') => request(`/sessions/${session.id}/value`, { key: raw(key(suffix)), cursor });
  const json = await value('json'); assert.equal(json.data.kind, 'string'); assert.match(json.data.content.display, /Redis 工作台/);
  const binary = await value('binary'); assert.equal(binary.data.content.rawBase64, 'AP8B'); assert.equal(binary.data.content.encoding, 'binary');
  const large = await value('large'); assert.equal(large.data.total, '70000'); assert.equal(large.data.truncated, true); assert.equal(Buffer.from(large.data.content.rawBase64, 'base64').length, 65536);
  const list = await value('list'); assert.equal(list.data.items.length, 100); assert.equal(list.data.nextCursor, '100'); assert.equal((await value('list', '100')).data.items.length, 5);
  assert.equal((await value('set')).data.items.length, 2);
  assert.equal((await value('hash')).data.items.find((item) => item.field.display === 'binary').value.rawBase64, 'AP8=');
  assert.equal((await value('zset')).data.items[0].score, '1.25');
  const stream = await value('stream'); assert.equal(stream.data.items.length, 100); assert.ok(stream.data.nextCursor.includes('-')); assert.equal((await value('stream', stream.data.nextCursor)).data.items.length, 5);
  assert.equal((await value('expired')).data.kind, 'none');
  assert.ok((await value('ttl')).ttl > 0);
  assert.equal((await request(`/sessions/${session.id}/command`, { command: 'PING' })).result, 'PONG');
  for (const command of ['SET fouc:should-not-exist x', 'FLUSHDB', 'EVAL "return 1" 0', 'SELECT 0', 'KEYS *']) {
    const response = await fetch(base + `/sessions/${session.id}/command`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command }) }); assert.equal(response.status, 400);
  }
  const cross = await fetch(base.replace('dbx-redis-live-verification', 'other-workspace') + `/sessions/${session.id}/scan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cursor: '0', pattern: '*' }) }); assert.equal(cross.status, 400);
  console.log('PASS Redis HTTP: explicit lab DB, config CRUD, scoped sessions, cursor/binary keys, six value types, bounded string/list/stream pages, TTL/missing, command policy and workspace isolation.');
} finally {
  if (session) await request(`/sessions/${session.id}`, undefined, 'DELETE');
  if (saved) await request(`/connections/${saved.id}`, undefined, 'DELETE');
  client.disconnect();
}
