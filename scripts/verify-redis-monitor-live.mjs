import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { createServer, connect } from 'node:net';

const Redis = createRequire(new URL('../backend/device/package.json', import.meta.url))('ioredis');
const endpoint = new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).REDIS_URL);
const host = process.env.FOUC_REDIS_OBSERVABILITY_HOST || endpoint.hostname;
const port = Number(process.env.FOUC_REDIS_OBSERVABILITY_PORT || 56380);
const config = { provider: 'redis', host, port, username: '', database: 15, tls: false, password: '' };
const client = new Redis({ host, port, db: 15, retryStrategy: () => null, stringNumbers: true }); client.on('error', () => {});
const base = `http://127.0.0.1:8710/api/database/redis`;
const prefix = 'fouc:dbx-monitor-lab:', acl = 'fouc_dbx_monitor_verifier', secret = crypto.randomUUID();
let session, limited, active, delayedSession, gate;
async function request(path, { body, method = body ? 'POST' : 'GET', status = 200, missingSession = false } = {}) {
  const response = await fetch(base + (missingSession ? path.replace(/^\/sessions\/[^/]+/, `/sessions/${crypto.randomUUID()}`) : path), {
    method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json(); assert.equal(response.status, status, result.error?.message);
  return result.data ?? result.error;
}
async function monitorIds() {
  return (await client.client('LIST')).split('\n').filter((line) => /(?:^| )flags=[^ ]*O/.test(line)).map((line) => /(?:^| )id=(\d+)/.exec(line)[1]);
}
async function eventually(test, message) {
  for (let attempt = 0; attempt < 40; attempt++) { if (await test()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  assert.fail(message);
}
// Delay the real MONITOR acknowledgement, so HTTP cancellation is exercised
// while Redis has entered monitor mode but the device route has not returned.
async function acknowledgementGate() {
  const sockets = new Set();
  const server = createServer((socket) => {
    const upstream = connect(port, host); sockets.add(socket); sockets.add(upstream); let held = false;
    socket.on('data', (bytes) => { if (/\$7\r\nmonitor\r\n/i.test(bytes.toString())) held = true; upstream.write(bytes); });
    upstream.on('data', (bytes) => { if (!held) socket.write(bytes); });
    socket.on('error', () => upstream.destroy()); upstream.on('error', () => socket.destroy());
    socket.on('close', () => { upstream.destroy(); sockets.delete(socket); }); upstream.on('close', () => { socket.destroy(); sockets.delete(upstream); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { port: server.address().port, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); } };
}
async function start(id) {
  const controller = new AbortController();
  const response = await fetch(`${base}/sessions/${id}/monitor`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: controller.signal });
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^application\/x-ndjson/);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '', frames = [];
  async function next() {
    while (!frames.length) {
      let timeout;
      const value = await Promise.race([reader.read(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('MONITOR frame timed out')), 5000); })]).finally(() => clearTimeout(timeout));
      if (value.done) throw new Error('MONITOR ended before expected frame');
      pending += decoder.decode(value.value, { stream: true }); const lines = pending.split('\n'); pending = lines.pop(); frames.push(...lines.filter(Boolean).map((line) => JSON.parse(line)));
    }
    return frames.shift();
  }
  const ready = await next(); assert.equal(ready.type, 'ready'); assert.equal(ready.maxRows, 1000); assert.equal(ready.lineBytes, 16384);
  const records = [];
  async function until(predicate) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const frame = await next();
      if (frame.type === 'rows') records.push(...frame.records);
      if (predicate(frame, records)) return frame;
    }
    assert.fail('Expected MONITOR record not observed');
  }
  return { controller, reader, records, until, stop: async () => { controller.abort(); await reader.cancel().catch(() => {}); } };
}
try {
  await client.ping(); const baseline = await monitorIds();
  session = await request('/sessions', { body: config, status: 201 }); assert.equal(session.readOnly, true);
  active = await start(session.id);
  assert.equal((await monitorIds()).length, baseline.length + 1);
  const binaryKey = prefix + 'quote"key'; await client.set(binaryKey, Buffer.from([0, 255, 32, 34, 92]));
  await client.select(14); await client.get(prefix + 'other-db'); await client.select(15);
  await active.until((_, rows) => rows.some((row) => row.message.includes('other-db')));
  const binary = active.records.find((row) => row.message.includes('quote\\"key'));
  assert.ok(binary); assert.ok(binary.message.includes('\\x00\\xff')); assert.ok(binary.message.includes('\\"')); assert.ok(binary.message.includes('\\\\'));
  assert.match(binary.message, /^\d+\.\d{6} \[15 /); assert.equal(binary.truncated, false);
  assert.ok(active.records.some((row) => /\[14 /.test(row.message) && row.message.includes('other-db')), 'MONITOR is instance-wide, not selected-DB filtered');
  assert.equal((await request(`/sessions/${session.id}/history`)).entries.length, 0);
  assert.equal((await request(`/sessions/${session.id}/command`, { body: { command: 'PING' } })).result, 'PONG', 'normal session stays usable during monitoring');
  await client.set(prefix + 'large', 'x'.repeat(20000));
  await active.until((_, rows) => rows.some((row) => row.message.includes(prefix + 'large')));
  const long = active.records.find((row) => row.message.includes(prefix + 'large')); assert.equal(long.truncated, true); assert.equal(Buffer.byteLength(long.message), 16384);
  await active.stop(); active = null; await eventually(async () => (await monitorIds()).length === baseline.length, 'HTTP abort must release the Redis monitor client');
  await request(`/sessions/${session.id}/monitor`, { body: {}, missingSession: true, status: 400 });
  active = await start(session.id); await request(`/sessions/${session.id}`, { method: 'DELETE' }); session = null;
  const closed = await active.until((frame) => frame.type === 'error'); assert.match(closed.message, /会话已断开/); await active.stop(); active = null;
  await eventually(async () => (await monitorIds()).length === baseline.length, 'session disconnect must release its monitor');
  session = await request('/sessions', { body: config, status: 201 }); active = await start(session.id);
  const switched = await request(`/sessions/${session.id}/database`, { body: { database: 14 } }); session = switched;
  assert.match((await active.until((frame) => frame.type === 'error')).message, /数据库已切换/); await active.stop(); active = null;
  await client.acl('SETUSER', acl, 'reset', 'on', `>${secret}`, '~*', '+@all', '-monitor');
  limited = await request('/sessions', { body: { ...config, username: acl, password: secret }, status: 201 });
  const denied = await request(`/sessions/${limited.id}/monitor`, { body: {}, status: 502 }); assert.match(denied.message, /NOPERM/);
  await eventually(async () => (await monitorIds()).length === baseline.length, 'denied monitor setup must not leak a client');
  await client.acl('SETUSER', acl, '+monitor'); active = await start(limited.id);
  const owned = (await monitorIds()).find((id) => !baseline.includes(id)); assert.ok(owned);
  await client.client('KILL', 'ID', owned);
  assert.match((await active.until((frame) => frame.type === 'error')).message, /连接已断开/); await active.stop(); active = null;
  await eventually(async () => (await monitorIds()).length === baseline.length, 'unexpected transport loss releases the monitor');
  assert.equal((await request(`/sessions/${limited.id}/command`, { body: { command: 'PING' } })).result, 'PONG');
  gate = await acknowledgementGate();
  delayedSession = await request('/sessions', { body: { ...config, host: '127.0.0.1', port: gate.port }, status: 201 });
  const cancel = new AbortController();
  const pendingResponse = fetch(`${base}/sessions/${delayedSession.id}/monitor`, { method: 'POST', body: '{}', signal: cancel.signal }).catch((error) => error);
  await eventually(async () => (await monitorIds()).length === baseline.length + 1, 'delayed acknowledgement must correspond to a real Redis MONITOR client');
  cancel.abort(); await pendingResponse;
  await eventually(async () => (await monitorIds()).length === baseline.length, 'cancelling before HTTP headers must close the pending Redis MONITOR client');
  await request(`/sessions/${delayedSession.id}`, { method: 'DELETE' }); delayedSession = null; await gate.close(); gate = null;
  console.log('PASS MONITOR real HTTP stream: dedicated client, native microsecond timestamp/DB/source/quote/binary escapes, all DBs, 16KiB truncation, separate normal command and history, request abort (including before delayed acknowledgement)/session close/DB switch/ACL rejection/recovery/unexpected socket close release actual monitor clients, missing-session guard; dedicated lab port ' + port + '.');
} finally {
  await active?.stop().catch(() => {});
  for (const entry of [session, limited, delayedSession]) if (entry) await request(`/sessions/${entry.id}`, { method: 'DELETE' }).catch(() => {});
  await gate?.close();
  await client.acl('DELUSER', acl).catch(() => {}); await client.quit().catch(() => client.disconnect());
}
