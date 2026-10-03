import { expect, test } from 'bun:test';
import { isRedisJsonType, redisJsonCapability, redisJsonDraft, redisJsonValue } from './redis-json';
import { redisMutation } from './redis-mutation-input';

test('RedisJSON types and drafts preserve raw numbers and reject malformed, oversized and byte-aliased mutation inputs', () => {
  for (const type of ['json', 'JSON', 'ReJSON-RL', 'rejson-rl']) expect(isRedisJsonType(type)).toBe(true);
  expect(isRedisJsonType('string')).toBe(false);
  expect(redisJsonDraft(' {"n":9007199254740993,"n":1.00000000000000001} ')).toBe('{"n":9007199254740993,"n":1.00000000000000001}');
  for (const value of [null, 'null trailing', '{bad}', '"' + 'a'.repeat(1048576) + '"']) expect(() => redisJsonDraft(value)).toThrow();
  expect(() => redisJsonDraft('"' + String.fromCharCode(0xd800) + '"')).toThrow('UTF-8');
  expect(redisJsonDraft('"\\ud800"')).toBe('"\\ud800"');
  expect(redisMutation({ kind: 'create', type: 'json', key: '', json: ' null ' })).toEqual({ kind: 'create', type: 'json', key: '', json: 'null' });
  expect(redisMutation({ kind: 'json-set', key: '', json: '1e300' })).toEqual({ kind: 'json-set', key: '', json: '1e300' });
});

test('JSON command discovery distinguishes absent, available and denied metadata without requiring MODULE LIST', async () => {
  const mock = (commands: unknown) => ({ callBuffer: async () => commands }) as never;
  expect((await redisJsonCapability(mock([[Buffer.from('json.get')], [Buffer.from('json.set')]]))).available).toBe(true);
  expect((await redisJsonCapability(mock([null, null]))).available).toBe(false);
  for (const malformed of [[], [null, []], [[Buffer.from('get')], [Buffer.from('json.set')]], ['json.get', null]]) {
    expect((await redisJsonCapability(mock(malformed))).available).toBeNull();
  }
  expect((await redisJsonCapability({ callBuffer: async () => { throw new Error('NOPERM'); } } as never)).available).toBeNull();
});

test('JSON reads retain null documents, reject disappeared keys/corrupt text/full-read overflow and tolerate optional MEMORY denial', async () => {
  const calls: unknown[][] = [];
  const mock = (reply: unknown) => ({ call: async () => { throw new Error('NOPERM'); }, callBuffer: async (...args: unknown[]) => { calls.push(args); return reply; } }) as never;
  expect(await redisJsonValue(mock(Buffer.from('null')), Buffer.alloc(0))).toEqual({ kind: 'json', content: 'null', byteLength: 4 });
  expect(calls[0]).toEqual(['JSON.GET', Buffer.alloc(0), '.']);
  for (const invalid of [null, Buffer.from([255]), Buffer.from('invalid'), Buffer.alloc(2097153)]) await expect(redisJsonValue(mock(invalid), Buffer.alloc(0))).rejects.toThrow();
});
