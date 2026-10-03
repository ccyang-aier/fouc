import { expect, test } from 'bun:test';
import { redisPubSubBytes, redisPubSubChange, redisPubSubObserved } from './redis-pubsub';
import { redisRespCommand } from './redis-pubsub-wire';
import { RedisEventBuffer } from './redis-live';

test('Pub/Sub names preserve empty and binary bytes and reject noncanonical aliases and unbounded batches', () => {
  const binary = Buffer.from([0, 255, 13, 10, 128]);
  expect(redisPubSubBytes(binary.toString('base64'))).toEqual(binary);
  expect(redisPubSubBytes('')).toHaveLength(0);
  const change = redisPubSubChange({ kind: 'psubscribe', names: ['', binary.toString('base64'), ''] });
  expect(change.names).toEqual([Buffer.alloc(0), binary]);
  for (const name of ['YQ', 'YR==', 'YQ==\n', '!!!!']) expect(() => redisPubSubBytes(name)).toThrow();
  expect(() => redisPubSubBytes(Buffer.alloc(65537).toString('base64'))).toThrow();
  expect(redisPubSubBytes(Buffer.alloc(1048576).toString('base64'), 1048576)).toHaveLength(1048576);
  expect(() => redisPubSubBytes(Buffer.alloc(1048577).toString('base64'), 1048576)).toThrow();
  for (const value of [null, { kind: 'publish', names: [''] }, { kind: 'subscribe', names: [] }, { kind: 'subscribe', names: Array(101).fill('') }])
    expect(() => redisPubSubChange(value)).toThrow();
});

test('RESP command framing uses byte lengths and never treats CRLF, binary or empty names as protocol text', () => {
  const name = Buffer.from([255, 0, 13, 10]);
  expect(redisRespCommand('PSUBSCRIBE', [name, Buffer.alloc(0)])).toEqual(Buffer.concat([
    Buffer.from('*3\r\n$10\r\nPSUBSCRIBE\r\n$4\r\n'), name, Buffer.from('\r\n$0\r\n\r\n'),
  ]));
});

test('Observed values retain full length while truncation stays byte exact even across UTF-8 boundaries', () => {
  const value = Buffer.from('中'.repeat(22000)), observed = redisPubSubObserved(value);
  expect(observed.byteLength).toBe(66000); expect(observed.truncated).toBe(true);
  expect(Buffer.from(observed.rawBase64, 'base64')).toEqual(value.subarray(0, 65536));
  expect(observed.encoding).toBe('binary');
  expect(redisPubSubObserved(Buffer.alloc(0))).toMatchObject({ rawBase64: '', byteLength: 0, truncated: false });
});

test('Live event buffers bound both count and encoded bytes and report dropped entries once', () => {
  const buffer = new RedisEventBuffer<{ text: string }>(2, 80);
  buffer.push({ text: 'a' }); buffer.push({ text: 'b' }); buffer.push({ text: 'c' });
  expect(buffer.take()).toEqual({ entries: [{ text: 'b' }, { text: 'c' }], dropped: 1 });
  expect(buffer.take()).toBeNull();
  buffer.push({ text: '\\'.repeat(100) });
  expect(buffer.take()).toEqual({ entries: [], dropped: 1 });
});
