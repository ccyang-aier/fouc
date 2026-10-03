import { expect, test } from 'bun:test';
import { RedisMutationManager } from './redis-mutation';

test('relocking rejects an in-flight snapshot instead of restoring an old write grant', async () => {
  let finish!: (value: Buffer[]) => void;
  const client = { callBuffer: () => new Promise<Buffer[]>((resolve) => { finish = resolve; }) };
  const manager = new RedisMutationManager(client as never);
  const pending = manager.snapshot(Buffer.from('key'));
  manager.clear();
  finish([Buffer.from('string'), Buffer.from('serialized-data'), Buffer.from('-1')]);
  await expect(pending).rejects.toThrow('重新锁定');
});
