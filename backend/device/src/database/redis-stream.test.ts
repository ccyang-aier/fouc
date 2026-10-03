import { expect, test } from 'bun:test';
import { redisStreamGroupsReply, redisStreamConsumersReply, redisStreamPendingReply, redisStreamPendingSlice, redisStreamPending, redisStreamPosition } from './redis-stream';
import { redisUnsigned } from './redis-protocol';

test('Stream metadata preserves binary names, full IDs and unknown optional counters', () => {
  const name = Buffer.from([0, 255]);
  const groups = redisStreamGroupsReply([
    ['name', name, 'consumers', '9007199254740993', 'pending', '18446744073709551615', 'last-delivered-id', '9007199254740993-18446744073709551615', 'entries-read', null, 'lag', null],
    ['name', Buffer.alloc(0), 'consumers', 0, 'pending', 0, 'last-delivered-id', '0-0'],
  ]);
  expect(groups[0]!.name.rawBase64).toBe(name.toString('base64'));
  expect(groups[0]!.consumers).toBe('9007199254740993');
  expect(groups[0]!.pending).toBe('18446744073709551615');
  expect(groups[0]!.lastDeliveredId).toBe('9007199254740993-18446744073709551615');
  expect(groups[0]!.lag).toBeNull();
  expect(groups[1]!.name.rawBase64).toBe('');
  expect(groups[1]!.entriesRead).toBeNull();
  const consumers = redisStreamConsumersReply([
    ['name', name, 'pending', '0', 'idle', '9007199254740993', 'inactive', '-1'],
    ['name', '', 'pending', 0, 'idle', 0],
  ]);
  expect(consumers[0]!.idleMs).toBe('9007199254740993');
  expect(consumers[0]!.inactiveMs).toBeNull();
  expect(consumers[1]!.inactiveMs).toBeNull();
  expect(redisStreamPendingReply([['18446744073709551615-1', name, '2', '9007199254740993']])[0]!.deliveries).toBe('9007199254740993');
});

test('Stream parsers reject corrupt shapes, lost integer precision and incomplete IDs', () => {
  for (const raw of [null, [[]], [['name', 'a']], [['name', 'a', 'consumers', 9007199254740992, 'pending', 0, 'last-delivered-id', '0-0']]])
    expect(() => redisStreamGroupsReply(raw)).toThrow();
  for (const raw of [[['name', 'a', 'pending', 0]], [['name', 'a', 'pending', 0, 'idle', '-1']]])
    expect(() => redisStreamConsumersReply(raw)).toThrow();
  for (const raw of [[['1-0', 'a', 0]], [['1', 'a', 0, 1]], [['1-0', {}, 0, 1]], [['1-0', 'a', 0, '-1']]])
    expect(() => redisStreamPendingReply(raw)).toThrow();
  for (const raw of ['1', '(1-0', '-1-0', '18446744073709551616-0', null]) expect(() => redisStreamPosition(raw)).toThrow();
  for (const raw of [9007199254740992, -1, undefined, '18446744073709551616']) expect(() => redisUnsigned(raw)).toThrow();
  expect(redisStreamPosition('0001-0002')).toBe('1-2');
});

test('inclusive Pending lookahead neither repeats a present cursor nor skips a cursor acknowledged between pages', () => {
  const entries = redisStreamPendingReply(Array.from({ length: 102 }, (_, index) => [`9007199254740993-${index}`, 'worker', '1', '1']));
  const first = redisStreamPendingSlice(entries, null);
  expect(first.entries).toHaveLength(100);
  expect(first.nextCursor).toBe('9007199254740993-99');
  const present = redisStreamPendingSlice(entries.slice(99), first.nextCursor);
  const acknowledged = redisStreamPendingSlice(entries.slice(100), first.nextCursor);
  expect(present.entries.map((entry) => entry.id)).toEqual(acknowledged.entries.map((entry) => entry.id));
  expect(acknowledged.entries[0]!.id).toBe('9007199254740993-100');
  expect(acknowledged.nextCursor).toBeNull();
});

test('Pending commands preserve an explicitly empty consumer filter and request bounded lookahead', async () => {
  const calls: unknown[][] = [];
  const client = { callBuffer: async (...args: unknown[]) => { calls.push(args); return []; } } as never;
  await redisStreamPending(client, 'aw==', 'Zw==', null, '');
  await redisStreamPending(client, 'aw==', 'Zw==', '9007199254740993-99', null);
  expect(calls[0]).toEqual(['XPENDING', Buffer.from('k'), Buffer.from('g'), '-', '+', '101', Buffer.alloc(0)]);
  expect(calls[1]).toEqual(['XPENDING', Buffer.from('k'), Buffer.from('g'), '9007199254740993-99', '+', '102']);
});
