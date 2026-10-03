import { describe, expect, test } from 'bun:test';
import { redisMutation, redisStreamId } from './redis-mutation-input';

describe('Redis mutation byte and integer boundaries', () => {
  test('keeps binary/empty fields and rejects ambiguous Base64', () => {
    const mutation = { kind: 'hash-add' as const, key: '', field: 'AP8=', value: '' };
    expect(redisMutation(mutation)).toEqual(mutation);
    for (const value of ['AB==', 'a!', 'YQ', 'YQ==\n', 3])
      expect(() => redisMutation({ ...mutation, value })).toThrow('Base64');
  });
  test('stream IDs preserve both 64-bit parts and reject overflow/zero', () => {
    expect(redisStreamId('9007199254740993-18446744073709551615')).toBe('9007199254740993-18446744073709551615');
    expect(redisStreamId('*', true)).toBe('*');
    for (const id of ['*', '0-0', '18446744073709551616-0', '-1-2', '1.5-0'])
      expect(() => redisStreamId(id)).toThrow();
  });
  test('strict variants reject wrong type, infinite score and unsafe indexes', () => {
    for (const mutation of [
      { kind: 'create', key: '', type: 'json', value: '' },
      { kind: 'zset-add', key: '', member: '', score: 'NaN' },
      { kind: 'zset-add', key: '', member: '', score: '1e999' },
      { kind: 'list-remove', key: '', index: '10000' },
      { kind: 'list-remove', key: '', index: 1 },
      { kind: 'stream-add', key: '', entryId: '*', fields: [] },
      { kind: 'expiry', key: '', mode: 'relative', milliseconds: '0' },
      { kind: 'expiry', key: '', mode: 'absolute', milliseconds: '1' },
      { kind: 'rename', key: '', destination: '' },
    ]) expect(() => redisMutation(mutation)).toThrow();
  });
  test('new plans cannot retain unvalidated client commands or references', () => {
    const input = { kind: 'stream-add', key: '', entryId: '*', fields: [{ field: 'YQ==', value: 'Yg==' }], commands: ['FLUSHDB'] };
    const result = redisMutation(input);
    input.fields[0]!.value = 'Yw==';
    expect(result).toEqual({ kind: 'stream-add', key: '', entryId: '*', fields: [{ field: 'YQ==', value: 'Yg==' }] });
  });
});
