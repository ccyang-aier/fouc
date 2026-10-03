import { expect, test } from 'bun:test';
import type { DatabaseQueryResult, SqlExecutionSnapshot } from '@fouc/shared';
import { SqlExecutionRegistry } from './sql-execution-registry';
const result: DatabaseQueryResult = { columns: ['n'], columnTypes: ['integer'], columnSortables: [false], rows: [[1]], affectedRows: 0, executionTimeMs: 1, truncated: false, sessionId: null, hasMore: false, messages: [] };
const ranges = ['SELECT 1', 'SELECT 2', 'SELECT 3'].map((sql, index) => ({ sql, from: index * 10, to: index * 10 + 8 }));
async function settle(registry: SqlExecutionRegistry, snapshot: SqlExecutionSnapshot) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    snapshot = registry.poll('w', 's', snapshot.id, 0).execution!;
    if (!['running', 'cancelling'].includes(snapshot.status)) return snapshot;
  }
  throw new Error('execution did not settle');
}
test('failure preserves completed results and prevents subsequent execution; snapshots cannot mutate registry status', async () => {
  const registry = new SqlExecutionRegistry(), called: string[] = [];
  let snapshot = registry.start('w', 's', 'db', 'main', ranges, async (sql) => {
    called.push(sql); if (sql === 'SELECT 2') throw Object.assign(new Error('unknown column'), { code: '42703', position: '8', hint: 'check field' }); return result;
  });
  snapshot.statements[0].status = 'failed'; snapshot = await settle(registry, snapshot);
  expect(called).toEqual(['SELECT 1', 'SELECT 2']); expect(snapshot.status).toBe('failed');
  expect(snapshot.statements.map((item) => item.status)).toEqual(['succeeded', 'failed', 'skipped']);
  expect(snapshot.statements[1].error).toMatchObject({ code: '42703', position: 7, hint: 'check field' });
  expect(registry.poll('w', 's', snapshot.id, snapshot.revision).execution).toBeNull();
  expect(() => registry.cancel('other', 's', snapshot.id)).toThrow();
  expect(() => registry.poll('w', 'other', snapshot.id, 0)).toThrow();
});
test('cancellation stays pending until actual driver termination, then disconnect releases registrations', async () => {
  const registry = new SqlExecutionRegistry(); let release: (() => void) | undefined, interrupted = false;
  const snapshot = registry.start('w', 's', 'db', null, ranges, (_sql, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { interrupted = true; release = () => reject(signal.reason); }, { once: true });
  }));
  expect(registry.cancel('w', 's', snapshot.id).status).toBe('cancelling'); expect(interrupted).toBe(true);
  expect(registry.poll('w', 's', snapshot.id, 0).execution?.finishedAt).toBeNull(); release!();
  const done = await settle(registry, snapshot); expect(done.status).toBe('cancelled');
  expect(done.statements.map((item) => item.status)).toEqual(['cancelled', 'skipped', 'skipped']);
  await registry.closeSession('s'); expect(() => registry.poll('w', 's', snapshot.id, 0)).toThrow();
});
test('late cancel retains a completed result and active parallel work is bounded', async () => {
  const registry = new SqlExecutionRegistry(); let release: ((value: DatabaseQueryResult) => void) | undefined;
  const first = registry.start('w', 's', 'db', null, ranges.slice(0, 1), () => new Promise((resolve) => { release = resolve; }));
  registry.cancel('w', 's', first.id); release!(result);
  expect((await settle(registry, first)).status).toBe('completed');
  const run = (_sql: string, signal: AbortSignal) => new Promise<DatabaseQueryResult>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  registry.start('w', 's', 'db', null, ranges, run); registry.start('w', 's', 'db', null, ranges, run);
  expect(() => registry.start('w', 's', 'db', null, ranges, run)).toThrow('并行查询');
  await registry.closeSession('s');
});
