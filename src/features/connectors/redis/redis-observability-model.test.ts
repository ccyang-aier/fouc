import type { RedisSlowlogEntry } from '@fouc/shared';
import { expect, test } from 'bun:test';
import {
  redisBytes,
  redisHitRatio,
  redisInfoFilter,
  redisInteger,
  redisSlowlogCommand,
  redisSlowlogSort,
  redisSlowlogTime,
  redisTotalKeys,
} from './redis-observability-model';

test('overview computes counters and ratios without rounding 64-bit integers', () => {
  expect(redisInteger('9007199254740993')).toBe('9,007,199,254,740,993');
  expect(redisHitRatio('9007199254740993', '9007199254740993')).toBe('50.00%');
  expect(redisHitRatio('2', '1')).toBe('66.67%');
  expect(redisHitRatio('0', '0')).toBe('未知');
  expect(redisBytes('1025')).toBe('1.00 KiB');
  expect(redisBytes(null)).toBe('未知');
  expect(
    redisTotalKeys([
      {
        name: 'Keyspace',
        entries: [
          { key: 'db0', value: 'keys=9007199254740993,expires=0' },
          { key: 'db15', value: 'keys=2,expires=1' },
        ],
      },
    ]),
  ).toBe('9007199254740995');
  expect(redisTotalKeys([])).toBeNull();
  expect(
    redisTotalKeys([{ name: 'Keyspace', entries: [{ key: 'db0', value: 'expires=0' }] }]),
  ).toBeNull();
  expect(redisTotalKeys([{ name: 'Keyspace', entries: [] }])).toBe('0');
});
const entry = (id: string, durationMicros: string): RedisSlowlogEntry => ({
  id,
  durationMicros,
  timestampSeconds: '1700000000',
  arguments: [
    { encoding: 'utf8', rawBase64: 'U0VU', display: 'SET' },
    { encoding: 'utf8', rawBase64: '', display: 'a b' },
    { encoding: 'binary', rawBase64: 'AP8=', display: '0x00ff' },
  ],
  clientAddress: null,
  clientName: null,
  originalArgumentCount: null,
});
test('slowlog sorting keeps adjacent 64-bit IDs ordered and logged command argument boundaries visible', () => {
  const entries = [
    entry('9007199254740993', '10'),
    entry('9007199254740992', '100'),
    entry('2', '1'),
  ];
  expect(redisSlowlogSort(entries, 'id', 'asc').map((item) => item.id)).toEqual([
    '2',
    '9007199254740992',
    '9007199254740993',
  ]);
  expect(
    redisSlowlogSort(entries, 'durationMicros', 'desc').map((item) => item.durationMicros),
  ).toEqual(['100', '10', '1']);
  expect(redisSlowlogCommand(entries[0]!)).toBe('SET "a b" 0x00ff');
  expect(redisSlowlogTime('18446744073709551615')).toBe('18446744073709551615 s (Unix)');
});
test('INFO search matches section names, keys and values without discarding unknown module fields', () => {
  const sections = [
    {
      name: 'Module',
      entries: [
        { key: 'endpoint', value: 'host:6379' },
        { key: 'count', value: '100' },
      ],
    },
  ];
  expect(redisInfoFilter(sections, 'MODULE')[0]!.entries).toHaveLength(2);
  expect(redisInfoFilter(sections, '6379')[0]!.entries).toHaveLength(1);
  expect(redisInfoFilter(sections, 'missing')).toHaveLength(0);
});
