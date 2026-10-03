import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
const Redis = createRequire(new URL('../backend/device/package.json', import.meta.url))('ioredis');
const host = new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).REDIS_URL).hostname;
const config = { provider: 'redis', host, port: 56381, username: '', database: 15, tls: false, password: '' };
const client = new Redis({ host, port: 56381, db: 15, retryStrategy: () => null, stringNumbers: true }); client.on('error', () => {});
const workspace = 'dbx-redis-json-verification', base = `http://127.0.0.1:8710/api/database/workspaces/${workspace}/redis`;
const prefix = 'fouc:dbx-json-lab:', acl = 'fouc_dbx_json_verifier', password = crypto.randomUUID(), b64 = (value) => Buffer.from(value).toString('base64');
const binaryKey = Buffer.concat([Buffer.from(prefix), Buffer.from([255, 0, 128])]);
const keys = [prefix + 'document', prefix + 'null', prefix + 'array', prefix + 'created', prefix + 'string', prefix + 'large', binaryKey];
let session, limited, plain;
async function request(path, { body, method = body ? 'POST' : 'GET', status = 200, foreign = false } = {}) {
  const response = await fetch((foreign ? base.replace(workspace, 'other-workspace') : base) + path, {
    method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json(); assert.equal(response.status, status, result.error?.message); return result.data ?? result.error;
}
const value = (id, key, status = 200) => request(`/sessions/${id}/value`, { body: { key: b64(key), cursor: '0' }, status });
const prepare = (id, mutation, writeVersion = null, status = 200) => request(`/sessions/${id}/mutations/preview`, { body: { mutation, writeVersion }, status });
const commit = (id, plan, status = 200) => request(`/sessions/${id}/mutations/commit`, { body: { planId: plan.id, confirmed: true }, status });
try {
  await client.ping(); await client.del(...keys);
  const original = '{"integer":9007199254740993,"max":9223372036854775807,"text":"中\\n文","array":[true,false,null,1e300],"decimal":0.123456789123456789}';
  for (const key of [keys[0], binaryKey]) await client.call('JSON.SET', key, '$', original);
  await client.call('JSON.SET', keys[1], '$', 'null'); await client.call('JSON.SET', keys[2], '$', '[1,2,{"n":9007199254740993}]');
  await client.set(keys[4], 'not-json'); await client.pexpire(keys[0], 300000);
  const expiry = await client.call('PEXPIRETIME', keys[0]), raw = await client.call('JSON.GET', keys[0], '.');
  session = await request('/sessions', { body: config, status: 201 });
  assert.equal((await request(`/sessions/${session.id}/json-capability`)).available, true);
  assert.equal((await value(session.id, keys[0])).data.content, raw);
  assert.equal((await value(session.id, keys[1])).data.content, 'null');
  assert.equal((await value(session.id, keys[2])).data.content, '[1,2,{"n":9007199254740993}]', 'root arrays must not be wrapped in a JSONPath result array');
  assert.equal((await value(session.id, binaryKey)).key.rawBase64, b64(binaryKey));
  await request(`/sessions/${session.id}/json-capability`, { foreign: true, status: 400 });
  await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: '{}' }, null, 400);
  await request(`/sessions/${session.id}/write-mode`, { body: { readOnly: false } });
  let page = await value(session.id, keys[0]); assert.ok(page.writeVersion);
  const draft = '{"integer":9007199254740995,"negative":-0,"decimal":1.230000000000000000001,"text":"\\u4e2d文"}';
  const plan = await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: draft }, page.writeVersion);
  assert.equal(plan.commands[0].command, 'JSON.SET'); assert.equal(plan.commands[0].arguments[2].display, draft); assert.equal(plan.commands[0].arguments[3].display, 'XX');
  assert.equal(await client.call('JSON.GET', keys[0], '.'), raw, 'preview does not write');
  await commit(session.id, plan); assert.equal(await client.call('PEXPIRETIME', keys[0]), expiry, 'JSON root edit retains the exact key expiry');
  assert.match(await client.call('JSON.GET', keys[0], '.'), /9007199254740995/); await commit(session.id, plan, 400);
  const created = await prepare(session.id, { kind: 'create', type: 'json', key: b64(keys[3]), json: 'null' });
  assert.equal(plan.commands[0].arguments[0].rawBase64, b64(keys[0])); await commit(session.id, created);
  assert.equal((await value(session.id, keys[3])).data.content, 'null');
  await prepare(session.id, { kind: 'create', type: 'json', key: b64(keys[3]), json: '{}' }, null, 400);
  page = await value(session.id, keys[0]); const conflict = await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: '{"mustNotWrite":true}' }, page.writeVersion);
  await client.call('JSON.SET', keys[0], '$.other', 'true'); await commit(session.id, conflict, 400); assert.doesNotMatch(await client.call('JSON.GET', keys[0], '.'), /mustNotWrite/);
  page = await value(session.id, keys[0]); const expiredPlan = await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: '{}' }, page.writeVersion);
  await client.pexpire(keys[0], 10000); await commit(session.id, expiredPlan, 400);
  page = await value(session.id, keys[4]); await prepare(session.id, { kind: 'json-set', key: b64(keys[4]), json: '{}' }, page.writeVersion, 400);
  page = await value(session.id, keys[0]); await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: '{"invalid":}' }, page.writeVersion, 400);
  await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: '"' + String.fromCharCode(0xd800) + '"' }, page.writeVersion, 400);
  const revoked = await prepare(session.id, { kind: 'json-set', key: b64(keys[0]), json: '{}' }, page.writeVersion);
  await request(`/sessions/${session.id}/write-mode`, { body: { readOnly: true } }); await commit(session.id, revoked, 400);
  await client.acl('SETUSER', acl, 'reset', 'on', `>${password}`, '~*', '+@all', '-module|list', '-memory|usage');
  limited = await request('/sessions', { body: { ...config, username: acl, password }, status: 201 });
  assert.equal((await request(`/sessions/${limited.id}/json-capability`)).available, true);
  assert.equal((await value(limited.id, binaryKey)).data.content, raw, 'optional MEMORY and MODULE permissions are not required to read');
  await client.acl('SETUSER', acl, '-command|info'); const capability = await request(`/sessions/${limited.id}/json-capability`); assert.equal(capability.available, null); assert.match(capability.reason, /NOPERM/);
  await client.acl('SETUSER', acl, '-json.get'); assert.match((await value(limited.id, binaryKey, 502)).message, /NOPERM/);
  await client.acl('SETUSER', acl, '+json.get', '+memory|usage'); await request(`/sessions/${limited.id}/write-mode`, { body: { readOnly: false } });
  page = await value(limited.id, binaryKey); const denied = await prepare(limited.id, { kind: 'json-set', key: b64(binaryKey), json: '{}' }, page.writeVersion);
  await client.acl('SETUSER', acl, '-json.set'); await commit(limited.id, denied, 400); assert.equal(await client.call('JSON.GET', binaryKey, '.'), raw);
  await client.acl('SETUSER', acl, '+json.set'); page = await value(limited.id, binaryKey); await commit(limited.id, await prepare(limited.id, { kind: 'json-set', key: b64(binaryKey), json: '{"recovered":true}' }, page.writeVersion));
  await client.call('JSON.SET', keys[5], '$', '"' + 'x'.repeat(2200000) + '"'); await value(session.id, keys[5], 400);
  plain = await request('/sessions', { body: { ...config, port: 56380 }, status: 201 });
  assert.equal((await request(`/sessions/${plain.id}/json-capability`)).available, false);
  assert.equal((await request(`/sessions/${session.id}/history`)).entries.length, 0);
  console.log('PASS RedisJSON native: Redis8.2.2/ReJSON8.2.1, raw JSON numbers/int64, scalar/null/root-array and binary keys, no-write preview, NX create/XX edit/single-use plans, exact TTL preservation/content+expiry conflicts/relock/wrong types/invalid JSON guards, optional MODULE/MEMORY denial and unknown COMMAND metadata, GET/SET ACL errors/recovery, full-read bounds, standalone module absence and workspace guard; owned DB15 fixtures only.');
} finally {
  for (const entry of [session, limited, plain]) if (entry) await request(`/sessions/${entry.id}`, { method: 'DELETE' }).catch(() => {});
  await client.del(...keys).catch(() => {}); await client.acl('DELUSER', acl).catch(() => {}); await client.quit().catch(() => client.disconnect());
}
