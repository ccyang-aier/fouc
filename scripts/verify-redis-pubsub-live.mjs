import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { createServer, connect } from 'node:net';

const Redis = createRequire(new URL('../backend/device/package.json', import.meta.url))('ioredis');
const host = process.env.FOUC_REDIS_OBSERVABILITY_HOST || new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).REDIS_URL).hostname;
const port = Number(process.env.FOUC_REDIS_OBSERVABILITY_PORT || 56380);
const config = { provider: 'redis', host, port, username: '', database: 15, tls: false, password: '' };
const client = new Redis({ host, port, db: 15, retryStrategy: () => null, stringNumbers: true }); client.on('error', () => {});
const workspace = 'dbx-redis-pubsub-verification', base = `http://127.0.0.1:8710/api/database/workspaces/${workspace}/redis`;
const prefix = 'fouc:dbx-pubsub-lab:', acl = 'fouc_dbx_pubsub_verifier', secret = crypto.randomUUID(), b64 = (value) => Buffer.from(value).toString('base64');
let session, limited, delayed, gate, active;
async function request(path, { body, method = body ? 'POST' : 'GET', status = 200, foreign = false } = {}) {
  const response = await fetch((foreign ? base.replace(workspace, 'other-workspace') : base) + path, {
    method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json(); assert.equal(response.status, status, result.error?.message); return result.data ?? result.error;
}
async function ids() { return (await client.client('LIST')).split('\n').filter(Boolean).map((line) => /(?:^| )id=(\d+)/.exec(line)[1]); }
async function eventually(check, message) {
  for (let attempt = 0; attempt < 60; attempt++) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  assert.fail(message);
}
async function start(id) {
  const controller = new AbortController(), response = await fetch(`${base}/sessions/${id}/pubsub`, { method: 'POST', body: '{}', signal: controller.signal });
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^application\/x-ndjson/);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '', frames = [];
  async function next() {
    while (!frames.length) {
      let timer;
      const chunk = await Promise.race([reader.read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Pub/Sub frame timed out')), 5000); })]).finally(() => clearTimeout(timer));
      assert.equal(chunk.done, false, 'Pub/Sub ended before expected frame');
      pending += decoder.decode(chunk.value, { stream: true }); const lines = pending.split('\n'); pending = lines.pop(); frames.push(...lines.filter(Boolean).map(JSON.parse));
    }
    return frames.shift();
  }
  const ready = await next(); assert.equal(ready.type, 'ready'); assert.equal(ready.maxMessages, 500); assert.equal(ready.messageBytes, 65536);
  const messages = [];
  async function until(check) {
    for (let attempt = 0; attempt < 30; attempt++) { const frame = await next(); if (frame.type === 'messages') messages.push(...frame.entries); if (check(frame, messages)) return frame; }
    assert.fail('Expected Pub/Sub message not observed');
  }
  return { id: ready.captureId, messages, until, change: (kind, names, status = 200) => request(`/sessions/${id}/pubsub/${ready.captureId}/subscriptions`, { body: { kind, names: names.map(b64) }, status }),
    snapshot: () => request(`/sessions/${id}/pubsub/${ready.captureId}/subscriptions`), stop: async () => { controller.abort(); await reader.cancel().catch(() => {}); } };
}
// Hold the real PING acknowledgement only after the ordinary session is ready.
async function acknowledgementGate() {
  let armed = ''; const sockets = new Set();
  const server = createServer((socket) => {
    const upstream = connect(port, host); sockets.add(socket); sockets.add(upstream); let held = false;
    socket.on('data', (bytes) => { if (armed && new RegExp(`\\$${armed.length}\\r\\n${armed}\\r\\n`, 'i').test(bytes.toString())) held = true; upstream.write(bytes); });
    upstream.on('data', (bytes) => { if (!held) socket.write(bytes); else if (armed === 'PUBLISH') upstream.destroy(); });
    socket.on('error', () => upstream.destroy()); upstream.on('error', () => socket.destroy());
    socket.on('close', () => { upstream.destroy(); sockets.delete(socket); }); upstream.on('close', () => { socket.destroy(); sockets.delete(upstream); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { port: server.address().port, arm: (command) => { armed = command; }, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); } };
}
try {
  await client.ping(); const keyCount = await client.dbsize();
  session = await request('/sessions', { body: config, status: 201 }); const baseline = await ids(); active = await start(session.id);
  const owned = (await ids()).find((id) => !baseline.includes(id)); assert.ok(owned, 'Pub/Sub owns an independent connection');
  assert.equal((await active.snapshot()).subscriptionCount, '0');
  const channel = prefix + 'news', pattern = prefix + '*';
  assert.equal((await active.change('subscribe', [channel, channel])).subscriptionCount, '1');
  assert.equal((await active.change('psubscribe', [pattern])).subscriptionCount, '2');
  const payload = Buffer.from([0, 255, 34, 13, 10, 92]); await client.select(14); await client.publish(channel, payload); await client.select(15);
  await active.until((_, rows) => rows.filter((row) => row.payload.rawBase64 === b64(payload)).length === 2);
  const deliveries = active.messages.filter((row) => row.payload.rawBase64 === b64(payload));
  assert.ok(deliveries.some((row) => row.pattern === null)); assert.ok(deliveries.some((row) => row.pattern?.rawBase64 === b64(pattern)));
  assert.ok(deliveries.every((row) => row.captureId === active.id && row.channel.rawBase64 === b64(channel)));
  const binaryChannel = Buffer.concat([Buffer.from(prefix), Buffer.from([255, 0, 128])]), binaryPattern = Buffer.concat([Buffer.from(prefix), Buffer.from([255]), Buffer.from('*')]);
  await active.change('subscribe', [binaryChannel, '', '__proto__']); await active.change('psubscribe', [binaryPattern]);
  await client.publish(binaryChannel, 'binary-pattern'); await client.publish('', Buffer.alloc(0)); await client.publish('__proto__', 'map-safe');
  await active.until((_, rows) => rows.some((row) => row.channel.rawBase64 === b64('__proto__')));
  assert.ok(active.messages.some((row) => row.pattern?.rawBase64 === b64(binaryPattern) && row.channel.rawBase64 === b64(binaryChannel)));
  assert.ok(active.messages.some((row) => row.channel.rawBase64 === '' && row.payload.rawBase64 === '' && row.payload.byteLength === 0));
  const large = Buffer.from('中'.repeat(22000)); await client.publish(channel, large);
  await active.until((_, rows) => rows.some((row) => row.payload.byteLength === large.length));
  const clipped = active.messages.find((row) => row.payload.byteLength === large.length); assert.equal(clipped.payload.truncated, true); assert.equal(clipped.payload.rawBase64, b64(large.subarray(0, 65536)));
  const publish = { channel: b64(channel), payload: b64('api-publish'), confirmed: true };
  assert.match((await request(`/sessions/${session.id}/pubsub/publish`, { body: publish, status: 400 })).message, /解锁/);
  await request(`/sessions/${session.id}/write-mode`, { body: { readOnly: false } });
  await request(`/sessions/${session.id}/pubsub/publish`, { body: { ...publish, confirmed: false }, status: 400 });
  assert.equal((await request(`/sessions/${session.id}/pubsub/publish`, { body: publish })).receivers, '2');
  await active.until((_, rows) => rows.some((row) => row.payload.rawBase64 === b64('api-publish')));
  await request(`/sessions/${session.id}/write-mode`, { body: { readOnly: true } });
  await request(`/sessions/${session.id}/pubsub/publish`, { body: publish, status: 400 });
  assert.equal((await request(`/sessions/${session.id}/history`)).entries.length, 0);
  assert.equal((await request(`/sessions/${session.id}/command`, { body: { command: 'PING' } })).result, 'PONG');
  assert.equal(await client.dbsize(), keyCount, 'Pub/Sub does not create database keys');
  await request(`/sessions/${session.id}/pubsub/${active.id}/subscriptions`, { foreign: true, status: 400 });
  const other = await request('/sessions', { body: config, status: 201 });
  await request(`/sessions/${other.id}/pubsub/${active.id}/subscriptions`, { status: 400 }); await request(`/sessions/${other.id}`, { method: 'DELETE' });
  await active.change('unsubscribe', [channel, binaryChannel, '', '__proto__', 'absent']);
  assert.equal((await active.change('punsubscribe', [pattern, binaryPattern])).subscriptionCount, '0');
  await active.change('subscribe', [channel]); await active.stop(); active = null;
  await eventually(async () => !(await ids()).includes(owned), 'HTTP abort must release actual Redis socket');
  active = await start(session.id); await active.change('subscribe', [channel]);
  session = await request(`/sessions/${session.id}/database`, { body: { database: 14 } });
  assert.match((await active.until((frame) => frame.type === 'error')).message, /数据库已切换/); await active.stop(); active = null;
  await client.acl('SETUSER', acl, 'reset', 'on', `>${secret}`, '~*', `&${prefix}*`, '+@all');
  limited = await request('/sessions', { body: { ...config, username: acl, password: secret }, status: 201 }); const limitedBaseline = await ids(); active = await start(limited.id);
  const accepted = prefix + 'accepted'; await active.change('subscribe', [accepted, 'forbidden'], 502);
  assert.deepEqual((await active.snapshot()).channels.map((item) => item.rawBase64), [b64(accepted)], 'accepted ACK before denied name remains visible');
  await active.change('subscribe', ['forbidden'], 502); assert.equal((await active.snapshot()).subscriptionCount, '1');
  await client.acl('SETUSER', acl, '&*'); await active.change('subscribe', ['forbidden']);
  await request(`/sessions/${limited.id}/write-mode`, { body: { readOnly: false } }); await client.acl('SETUSER', acl, '-publish');
  assert.match((await request(`/sessions/${limited.id}/pubsub/publish`, { body: publish, status: 502 })).message, /NOPERM/);
  await client.acl('SETUSER', acl, '+publish'); assert.equal((await request(`/sessions/${limited.id}/pubsub/publish`, { body: { ...publish, channel: b64(accepted) } })).receivers, '1');
  const limitedWire = (await ids()).find((id) => !limitedBaseline.includes(id)); assert.ok(limitedWire); await client.client('KILL', 'ID', limitedWire);
  assert.match((await active.until((frame) => frame.type === 'error')).message, /连接已断开/); await active.stop(); active = null;
  active = await start(limited.id); await request(`/sessions/${limited.id}`, { method: 'DELETE' }); limited = null;
  assert.match((await active.until((frame) => frame.type === 'error')).message, /会话已断开/); await active.stop(); active = null;
  gate = await acknowledgementGate(); delayed = await request('/sessions', { body: { ...config, host: '127.0.0.1', port: gate.port }, status: 201 });
  const beforeSetup = await ids(); gate.arm('PING'); const cancel = new AbortController();
  const setup = fetch(`${base}/sessions/${delayed.id}/pubsub`, { method: 'POST', body: '{}', signal: cancel.signal }).catch((error) => error);
  await eventually(async () => (await ids()).length === beforeSetup.length + 1, 'pre-ready setup has real dedicated socket'); cancel.abort(); await setup;
  await eventually(async () => (await ids()).length === beforeSetup.length, 'pre-ready HTTP abort releases dedicated socket');
  active = await start(session.id); await active.change('subscribe', [channel]);
  await request(`/sessions/${delayed.id}/write-mode`, { body: { readOnly: false } }); gate.arm('PUBLISH');
  const unconfirmed = await request(`/sessions/${delayed.id}/pubsub/publish`, { body: { ...publish, payload: b64('delivered-with-lost-ack') }, status: 502 });
  assert.match(unconfirmed.message, /发布结果未确认/);
  await active.until((_, rows) => rows.some((row) => row.payload.rawBase64 === b64('delivered-with-lost-ack')));
  assert.equal(active.messages.filter((row) => row.payload.rawBase64 === b64('delivered-with-lost-ack')).length, 1, 'a lost publication ACK must not trigger an automatic retry');
  console.log('PASS Pub/Sub native HTTP: binary/empty channel and payload, binary patterns, channel+pattern duplicate deliveries, cross-DB messages, ACK truth after partial ACL denial, unsubscribe/resubscribe, 64KiB clipping, guarded confirmed publishing/ACL recovery/no history or keys, publication delivered with lost ACK reports unknown without retry, workspace/session guards, actual sockets released on abort/pre-ready cancellation/DB switch/session close/transport failure; lab ' + port + '.');
} finally {
  await active?.stop().catch(() => {});
  for (const entry of [session, limited, delayed]) if (entry) await request(`/sessions/${entry.id}`, { method: 'DELETE' }).catch(() => {});
  await gate?.close(); await client.acl('DELUSER', acl).catch(() => {}); await client.quit().catch(() => client.disconnect());
}
