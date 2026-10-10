import { expect, test } from 'bun:test';
import type { DatabaseQueryResult } from '@fouc/shared';
import {
  addResultPin,
  RESULT_PIN_LIMITS,
  scopedResultPins,
  type ResultPinScope,
} from './model';
const scope: ResultPinScope = {
  connectionId: 'connection-a',
  tabId: 'tab-a',
};
function input(sourceId = 'run-a') {
  const result: DatabaseQueryResult = {
    columns: ['id', 'json'],
    columnTypes: ['bigint', 'json'],
    columnSortables: [],
    rows: [['9007199254740993', { nested: [null, true] }]],
    affectedRows: 0,
    executionTimeMs: 1,
    truncated: false,
    hasMore: false,
    sessionId: 'session',
    messages: [],
  };
  return {
    scope,
    sourceId,
    label: 'Query · 结果 1',
    sql: 'SELECT id, json FROM test',
    context: { database: 'db', schema: 'public' },
    result,
  };
}
test('pin takes an independent snapshot and deduplicates only its own scope', () => {
  const source = input(),
    pins = addResultPin([], source, 'pin-a', 1);
  source.result.rows[0][0] = 'changed';
  source.context.schema = 'later-schema';
  expect(pins[0].result.rows[0][0]).toBe('9007199254740993');
  expect(pins[0].context).toEqual({ database: 'db', schema: 'public' });
  expect(addResultPin(pins, input(), 'pin-b').length).toBe(1);
  expect(
    addResultPin(
      pins,
      { ...input(), scope: { ...scope, tabId: 'tab-b' } },
      'pin-b',
    ).length,
  ).toBe(2);
  for (const other of [
    { ...scope, connectionId: 'connection-b' },
    { ...scope, tabId: 'tab-b' },
  ])
    expect(scopedResultPins(pins, other)).toEqual([]);
});
test('pins never evict a fixed result and enforce total count, byte and cell budgets', () => {
  let pins = addResultPin([], input());
  for (let i = 1; i < 5; i++) pins = addResultPin(pins, input(`run-${i}`));
  expect(() => addResultPin(pins, input('run-6'))).toThrow('最多固定 5');
  const large = input();
  large.result.rows = [['x'.repeat(RESULT_PIN_LIMITS.bytes + 1)]];
  expect(() => addResultPin([], large)).toThrow('8 MiB');
  const cells = input();
  cells.result.rows = [
    Array.from({ length: RESULT_PIN_LIMITS.cells + 1 }, () => null),
  ];
  expect(() => addResultPin([], cells)).toThrow('50,000');
  expect(pins).toHaveLength(5);
});
