import { expect, test } from 'bun:test';
import { redisInfoSections, redisSlowlogCount, redisSlowlogEntries } from './redis-observability';

test('INFO preserves module sections, empty values, colons and lossless counters', () => {
  const sections = redisInfoSections('before:10\r\n# Memory\r\nused_memory:9007199254740993\r\nempty:\r\n# Custom Module\r\nendpoint:host:6379\r\nmalformed\r\n');
  expect(sections).toEqual([
    { name: 'Other', entries: [{ key: 'before', value: '10' }] },
    { name: 'Memory', entries: [{ key: 'used_memory', value: '9007199254740993' }, { key: 'empty', value: '' }] },
    { name: 'Custom Module', entries: [{ key: 'endpoint', value: 'host:6379' }] },
  ]);
});
test('slowlog preserves 64-bit integers, binary and empty argument boundaries, and optional version fields', () => {
  const bytes = Buffer.from([0, 255]);
  const result = redisSlowlogEntries([
    ['9007199254740993', Buffer.from('1700000000'), '18446744073709551615', [Buffer.from('SET'), bytes, Buffer.alloc(0)], Buffer.from('127.0.0.1:6379'), Buffer.alloc(0), '40'],
    ['2', '1', '0', [Buffer.from('PING')]],
  ]);
  expect(result.entries[0]!.id).toBe('9007199254740993');
  expect(result.entries[0]!.durationMicros).toBe('18446744073709551615');
  expect(result.entries[0]!.arguments[1]!.rawBase64).toBe(bytes.toString('base64'));
  expect(result.entries[0]!.arguments[2]!.rawBase64).toBe('');
  expect(result.entries[0]!.clientName).toBeNull();
  expect(result.entries[0]!.originalArgumentCount).toBe('40');
  expect(result.entries[1]!.clientAddress).toBeNull();
  expect(result.entries[1]!.originalArgumentCount).toBeNull();
});
test('slowlog rejects corrupt shapes and already rounded numeric values instead of showing fake zero', () => {
  for (const raw of [null, [[]], [['bad', '1', '1', []]], [[9007199254740992, '1', '1', []]], [['1', '1', '-1', []]], [['1', '1', '1', null]]])
    expect(() => redisSlowlogEntries(raw)).toThrow();
  for (const count of [null, '100', 0, -1, 1.5, 10001, NaN]) expect(() => redisSlowlogCount(count)).toThrow();
  expect(redisSlowlogCount(10000)).toBe(10000);
});
test('slowlog limits serialized responses without claiming the omitted entries are absent', () => {
  const raw = Array.from({ length: 3 }, (_, index) => [String(index), '1', '1', [Buffer.alloc(800000, 97)]]);
  const page = redisSlowlogEntries(raw);
  expect(page.entries).toHaveLength(1);
  expect(page.returnedByServer).toBe(3);
  expect(page.omittedEntries).toBe(2);
});
