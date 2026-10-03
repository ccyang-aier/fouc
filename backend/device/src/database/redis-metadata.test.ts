import { expect, test } from 'bun:test';
import { parseRedisKeyspace, redisDatabase } from './redis-metadata';

test('Redis database metadata preserves counts and skips malformed identifiers', () => {
  const info = '# Keyspace\r\ndb15:keys=9007199254740993,expires=2,avg_ttl=600123\r\ndb3:keys=invalid\r\ndb9007199254740993:keys=1\r\n';
  const values = parseRedisKeyspace(info);
  expect(values.get(15)).toEqual({ database: 15, keys: '9007199254740993', expires: '2', averageTtlMs: '600123' });
  expect(values.get(3)?.keys).toBeNull();
  expect(values.size).toBe(2);
  for (const value of ['15', -1, 1.5, 2147483647, null]) expect(() => redisDatabase(value)).toThrow();
});
