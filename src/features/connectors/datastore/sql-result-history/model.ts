import { createUiMessages } from '../../i18n/ui-message';
import { type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './model.messages';
import type { DatabaseQueryResult } from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export const RESULT_PIN_LIMITS = {
  count: 5,
  bytes: 8 * 1024 * 1024,
  cells: 50000,
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
  context: {
    database: string;
    schema: string | null;
  };
  capturedAt: number;
  bytes: number;
  result: DatabaseQueryResult;
};
export function resultPinScopeKey(scope: ResultPinScope): string {
  return JSON.stringify([scope.connectionId, scope.tabId]);
}
export function scopedResultPins(pins: readonly ResultPin[], scope: ResultPinScope): ResultPin[] {
  const key = resultPinScopeKey(scope);
  return pins.filter((pin) => resultPinScopeKey(pin.scope) === key);
}
/** Reject large strings before serialization, then account for the complete JSON snapshot. */
function checkSnapshotSize(
  value: unknown,
  budget: {
    remaining: number;
  },
  depth = 0,
  locale?: Locale,
): void {
  if (depth > 64) throw connectorUiMessages.error('resultsNestedBeyondLevelsCannotBePinned');
  if (typeof value === 'string') budget.remaining -= value.length;
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      budget.remaining -= key.length + 4;
      if (budget.remaining < 0)
        throw connectorUiMessages.error('pinnedResultsMustTotalNoMoreThanMibReturnLess');
      checkSnapshotSize(entry, budget, depth + 1, locale);
    }
  } else budget.remaining -= 8;
  if (budget.remaining < 0)
    throw connectorUiMessages.error('pinnedResultsMustTotalNoMoreThanMibReturnLess');
}
export function addResultPin(
  pins: readonly ResultPin[],
  input: Omit<ResultPin, 'id' | 'capturedAt' | 'bytes'>,
  id = crypto.randomUUID(),
  now = Date.now(),
  locale?: Locale,
): ResultPin[] {
  const existing = scopedResultPins(pins, input.scope).find(
    (pin) => pin.sourceId === input.sourceId,
  );
  if (existing) return [...pins];
  if (pins.length >= RESULT_PIN_LIMITS.count)
    throw connectorUiMessages.error('atMostResultsCanBePinnedUnpinOneFirst');
  const cells = input.result.rows.reduce((count, row) => count + row.length, 0);
  if (cells > RESULT_PIN_LIMITS.cells)
    throw connectorUiMessages.error('eachPinnedResultSupportsAtMostCellsNarrowTheQuery');
  const remaining = RESULT_PIN_LIMITS.bytes - pins.reduce((total, pin) => total + pin.bytes, 0);
  checkSnapshotSize(input, { remaining }, undefined, locale);
  const text = JSON.stringify(input),
    bytes = new TextEncoder().encode(text).length;
  if (bytes > remaining)
    throw connectorUiMessages.error('pinnedResultsMustTotalNoMoreThanMibUnpinA');
  return [...pins, { ...structuredClone(input), id, capturedAt: now, bytes }];
}
