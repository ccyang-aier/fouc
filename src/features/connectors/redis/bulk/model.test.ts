import { expect, test } from 'bun:test';
import { bulkOperation, expiryLabel } from './model';

test('relative TTL uses integer seconds, PERSIST is explicit, absolute deadlines and missing state stay distinct', () => {
  expect(bulkOperation('relative-ttl', '3600', '')).toEqual({
    kind: 'relative-ttl',
    milliseconds: '3600000',
  });
  for (const seconds of ['0', '-1', '1.5', '1e3', '01', '9007199254741'])
    expect(() => bulkOperation('relative-ttl', seconds, '')).toThrow();
  expect(bulkOperation('persist', '0', '')).toEqual({ kind: 'persist' });
  const time = '2030-01-01T12:00:00';
  expect(bulkOperation('absolute-ttl', '', time)).toEqual({
    kind: 'absolute-ttl',
    milliseconds: String(new Date(time).getTime()),
  });
  expect(() => bulkOperation('absolute-ttl', '', 'bad date')).toThrow();
  expect(expiryLabel('-1')).toBe('永久');
  expect(expiryLabel('-2')).toBe('不存在');
  expect(expiryLabel(null)).toBe('未确认');
});
