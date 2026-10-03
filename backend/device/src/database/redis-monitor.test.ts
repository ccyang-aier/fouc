import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { RedisMonitor, RedisMonitorBuffer, REDIS_MONITOR_BUFFER_BYTES } from './redis-monitor';

test('MONITOR pending rows retain newest records and report count and byte pressure losses', () => {
  const buffer = new RedisMonitorBuffer();
  for (let index = 0; index < 1010; index++) buffer.push(String(index));
  const frame = buffer.take();
  if (frame?.type !== 'rows') throw new Error('Expected rows');
  expect(frame.records).toHaveLength(1000); expect(frame.records[0]!.message).toBe('10'); expect(frame.dropped).toBe(10);
  expect(buffer.take()).toBeNull();
  for (let index = 0; index < 500; index++) buffer.push('\\'.repeat(20000));
  const bounded = buffer.take();
  if (bounded?.type !== 'rows') throw new Error('Expected rows');
  expect(bounded.records.every((entry) => entry.truncated && entry.message.length === 16384)).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(REDIS_MONITOR_BUFFER_BYTES + 100);
  expect(bounded.dropped + bounded.records.length).toBe(500);
  buffer.push('中'.repeat(6000));
  const utf8 = buffer.take();
  if (utf8?.type !== 'rows') throw new Error('Expected rows');
  expect(utf8.records[0]!.message.includes('\ufffd')).toBe(false);
});

class FakeMonitor extends EventEmitter {
  closed = 0;
  fail = false;
  delayed = false;
  async connect() { if (this.fail) throw new Error('NOPERM'); if (!this.delayed) this.emit('monitoring'); }
  disconnect() { this.closed++; this.emit('end'); }
}
function operation(client: FakeMonitor, closed: () => void) {
  return new RedisMonitor({ duplicate: () => client } as never, closed);
}
test('MONITOR setup failure, pre-ready cancellation and late readiness release the dedicated client exactly once', async () => {
  const denied = new FakeMonitor(); denied.fail = true; let closes = 0;
  await expect(operation(denied, () => closes++).open(new AbortController().signal)).rejects.toThrow('NOPERM');
  expect(denied.closed).toBe(1); expect(closes).toBe(1);
  const delayed = new FakeMonitor(); delayed.delayed = true;
  const controller = new AbortController(), pending = operation(delayed, () => closes++).open(controller.signal);
  controller.abort(); await expect(pending).rejects.toThrow('已取消'); delayed.emit('monitoring');
  expect(delayed.closed).toBe(1); expect(closes).toBe(2);
});

test('MONITOR stream cancellation and session closure clean timers and preserve escaped text', async () => {
  const client = new FakeMonitor(); let closes = 0;
  const monitor = operation(client, () => closes++), stream = await monitor.open(new AbortController().signal), reader = stream.getReader();
  expect(JSON.parse(Buffer.from((await reader.read()).value!).toString()).type).toBe('ready');
  client.emit('monitor', '1700000000.000001', ['set', 'quote"key', '\\x00\\xff'], '127.0.0.1:1234', '15');
  const frame = JSON.parse(Buffer.from((await reader.read()).value!).toString());
  expect(frame.records[0].message).toBe('1700000000.000001 [15 127.0.0.1:1234] "set" "quote\\"key" "\\x00\\xff"');
  monitor.stop('会话断开');
  expect(JSON.parse(Buffer.from((await reader.read()).value!).toString())).toEqual({ type: 'error', message: '会话断开' });
  expect((await reader.read()).done).toBe(true); await reader.cancel(); monitor.stop();
  expect(client.closed).toBe(1); expect(closes).toBe(1);
  const another = new FakeMonitor(), second = await operation(another, () => closes++).open(new AbortController().signal);
  await second.cancel(); expect(another.closed).toBe(1); expect(closes).toBe(2);
});
