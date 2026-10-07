import type { DatabaseQueryResult } from '@fouc/shared';

export const RESULT_PIN_LIMITS = {
  count: 5,
  bytes: 8 * 1024 * 1024,
  cells: 50_000,
} as const;
export type ResultPinScope = {

  connectionId: string;
  tabId: string;
};
export type ResultPin = {
  id: string;
  scope: ResultPinScope;
  sourceId: string;
  label: string;
  sql: string;
  capturedAt: number;
  bytes: number;
  result: DatabaseQueryResult;
};
export function resultPinScopeKey(scope: ResultPinScope): string {
  return JSON.stringify([scope.connectionId, scope.tabId]);
}
export function scopedResultPins(
  pins: readonly ResultPin[],
  scope: ResultPinScope,
): ResultPin[] {
  const key = resultPinScopeKey(scope);
  return pins.filter((pin) => resultPinScopeKey(pin.scope) === key);
}

/** Reject large strings before serialization, then account for the complete JSON snapshot. */
function checkSnapshotSize(
  value: unknown,
  budget: { remaining: number },
  depth = 0,
): void {
  if (depth > 64) throw new Error('结果嵌套超过 64 层，无法固定');
  if (typeof value === 'string') budget.remaining -= value.length;
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      budget.remaining -= key.length + 4;
      if (budget.remaining < 0)
        throw new Error('固定结果总大小不能超过 8 MiB，请减少返回数据');
      checkSnapshotSize(entry, budget, depth + 1);
    }
  } else budget.remaining -= 8;
  if (budget.remaining < 0)
    throw new Error('固定结果总大小不能超过 8 MiB，请减少返回数据');
}
export function addResultPin(
  pins: readonly ResultPin[],
  input: Omit<ResultPin, 'id' | 'capturedAt' | 'bytes'>,
  id = crypto.randomUUID(),
  now = Date.now(),
): ResultPin[] {
  const existing = scopedResultPins(pins, input.scope).find(
    (pin) => pin.sourceId === input.sourceId,
  );
  if (existing) return [...pins];
  if (pins.length >= RESULT_PIN_LIMITS.count)
    throw new Error('最多固定 5 份结果，请先取消固定一份结果');
  const cells = input.result.rows.reduce((count, row) => count + row.length, 0);
  if (cells > RESULT_PIN_LIMITS.cells)
    throw new Error('单份固定结果最多 50,000 个单元格，请缩小查询范围');
  const remaining =
    RESULT_PIN_LIMITS.bytes - pins.reduce((total, pin) => total + pin.bytes, 0);
  checkSnapshotSize(input, { remaining });
  const text = JSON.stringify(input),
    bytes = new TextEncoder().encode(text).length;
  if (bytes > remaining)
    throw new Error('固定结果总大小不能超过 8 MiB，请先取消固定或缩小查询范围');
  return [...pins, { ...structuredClone(input), id, capturedAt: now, bytes }];
}
