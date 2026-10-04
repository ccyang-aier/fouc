import { expect, test } from 'bun:test';
import { redisBulkInput } from './redis-bulk-input';
import { RedisBulkPlans } from './redis-bulk-plans';

const raw = (key: string) => Buffer.from(key).toString('base64');
const input = { database: 15, keys: [raw('a')], operation: { kind: 'persist' } };

test('bulk selection requires explicit canonical keys and the current immutable database', () => {
  expect(redisBulkInput(input, 15).keys).toEqual([raw('a')]);
  expect(redisBulkInput({ ...input, keys: [''] }, 15).keys).toEqual(['']);
  for (const invalid of [
    { ...input, database: 0 }, { ...input, keys: [] }, { ...input, keys: '*' },
    { ...input, keys: ['YQ'] }, { ...input, keys: ['YR=='] },
    { ...input, keys: [raw('a'), raw('a')] },
    { ...input, keys: Array.from({ length: 101 }, (_, index) => raw(String(index))) },
    { ...input, keys: [Buffer.alloc(65537).toString('base64')] },
    { ...input, keys: Array.from({ length: 5 }, (_, index) => Buffer.alloc(65536, index).toString('base64')) },
  ]) expect(() => redisBulkInput(invalid, 15)).toThrow();
});

test('TTL keeps exact positive milliseconds and requires an explicit PERSIST operation', () => {
  expect(redisBulkInput({ ...input, operation: { kind: 'absolute-ttl', milliseconds: '9007199254740991' } }, 15).operation).toEqual({ kind: 'absolute-ttl', milliseconds: '9007199254740991' });
  for (const milliseconds of [0, '0', '-1', '1.5', '1e3', '01', '9007199254740992']) {
    expect(() => redisBulkInput({ ...input, operation: { kind: 'relative-ttl', milliseconds } }, 15)).toThrow();
  }
  expect(() => redisBulkInput({ ...input, operation: { kind: 'EVAL', script: 'return 1' } }, 15)).toThrow();
});

test('relocking invalidates an awaited read without installing a stale bulk plan', async () => {
  let finish!: (reply: unknown[]) => void;
  const client = { callBuffer: () => new Promise<unknown[]>(resolve => { finish = resolve; }) };
  const plans = new RedisBulkPlans(client as never, 15);
  const pending = plans.prepare(input);
  plans.clear();
  finish(['1', '0', [[Buffer.from('string'), Buffer.from('dump'), Buffer.from('-1')]]]);
  await expect(pending).rejects.toThrow('重新预览');
});

test('transport failure consumes the plan and reports unknown rather than a retry or rollback', async () => {
  let writes = 0;
  const client = { callBuffer: async (command: string) => {
    if (command === 'EVAL_RO') return ['1', '0', [[Buffer.from('string'), Buffer.from('dump'), Buffer.from('-1')]]];
    writes++;
    throw new Error('Connection is closed.');
  } };
  const plans = new RedisBulkPlans(client as never, 15);
  const preview = await plans.prepare(input);
  const result = await plans.commit(preview.planId, true, false);
  expect(result.state).toBe('unknown');
  expect(result.unknown).toBe(1);
  expect(result.keys[0]?.state).toBe('unknown');
  await expect(plans.commit(preview.planId, true, false)).rejects.toThrow('已提交');
  expect(writes).toBe(1);
});
