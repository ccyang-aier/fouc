import { createUiMessages } from '../../i18n/ui-message';
import { getLocale } from '@/lib/i18n';
import { type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './model.messages';
import type {
  DatabaseCell,
  DatabaseColumnInfo,
  DatabaseQueryResult,
  RelationalProvider,
} from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export type DataCompareColumnMapping = {
  id: string;
  left: number;
  right: number;
};
export type DataCompareCell = DatabaseCell | undefined;
export type DataCompareKind = 'added' | 'removed' | 'modified' | 'unchanged' | 'conflict';
export type DataCompareChange = {
  mappingId: string;
  left: DataCompareCell;
  right: DataCompareCell;
};
export type DataCompareEntry = {
  id: string;
  kind: DataCompareKind;
  keyValues: DataCompareCell[];
  leftRows: number[];
  rightRows: number[];
  changes: DataCompareChange[];
  reasons: string[];
};
export type DataCompareConfiguration = {
  mapping: readonly DataCompareColumnMapping[];
  keyColumns: readonly string[];
  provider?: RelationalProvider;
};
export type DataCompareProgress = {
  phase: 'left' | 'right' | 'compare' | 'complete';
  completed: number;
  total: number;
};
export type DataCompareResult = {
  entries: DataCompareEntry[];
  counts: Record<DataCompareKind, number>;
  mapping: DataCompareColumnMapping[];
  keyColumns: string[];
  left: DatabaseQueryResult;
  right: DatabaseQueryResult;
  partial: boolean;
  elapsedMs: number;
};
export type DataCompareTarget = {
  table: string;
  schema?: string;
  columns?: readonly DatabaseColumnInfo[];
};
export type DataCompareSqlPreview = {
  sql: string;
  statements: number;
  skipped: Array<{
    entryId: string;
    reason: string;
  }>;
  warnings: string[];
};
export const DATA_COMPARE_MAX_ROWS = 10000;
export const DATA_COMPARE_MAX_CELLS = 1000000;
export function compareCellAt(row: readonly DatabaseCell[], index: number): DataCompareCell {
  return Object.hasOwn(row, index) ? row[index] : undefined;
}
/** DBX column intersection adapted to positional aliases; ambiguous duplicates require an explicit map. */
export function inferCompareMappings(
  left: readonly string[],
  right: readonly string[],
): DataCompareColumnMapping[] {
  const used = new Set<number>(),
    mapping: DataCompareColumnMapping[] = [];
  for (let index = 0; index < left.length; index++) {
    const name = left[index],
      exact = right
        .map((entry, candidate) => (entry === name ? candidate : -1))
        .filter((candidate) => candidate >= 0);
    let target =
      exact.length === 1 && left.filter((entry) => entry === name).length === 1 ? exact[0] : -1;
    if (target < 0) {
      const folded = name.toLowerCase(),
        matches = right
          .map((entry, candidate) => (entry.toLowerCase() === folded ? candidate : -1))
          .filter((candidate) => candidate >= 0);
      if (
        matches.length === 1 &&
        left.filter((entry) => entry.toLowerCase() === folded).length === 1
      )
        target = matches[0];
    }
    if (target >= 0 && !used.has(target)) {
      used.add(target);
      mapping.push({ id: `column-${index}`, left: index, right: target });
    }
  }
  return mapping;
}
/** Only caller-supplied, real primary-key metadata is inferred; never guess the first result column. */
export function inferCompareKeys(
  left: DatabaseQueryResult,
  mapping: readonly DataCompareColumnMapping[],
  primaryKeys: readonly string[] = [],
): string[] {
  if (!primaryKeys.length) return [];
  const keys = primaryKeys.map((name) =>
    mapping.filter((entry) => left.columns[entry.left] === name),
  );
  return keys.every((matches) => matches.length === 1) ? keys.map((matches) => matches[0].id) : [];
}
export function validateCompareConfiguration(
  left: DatabaseQueryResult,
  right: DatabaseQueryResult,
  config: DataCompareConfiguration,
  locale?: Locale,
): void {
  const rowCount = left.rows.length + right.rows.length;
  if (rowCount > DATA_COMPARE_MAX_ROWS)
    throw connectorUiMessages.error('theLoadedResultsContainRowsOneComparisonSupportsUpTo', {
      p0: String(rowCount.toLocaleString(locale ?? getLocale())),
      p1: String(DATA_COMPARE_MAX_ROWS.toLocaleString(locale ?? getLocale())),
    });
  const cellCount =
    left.rows.reduce((sum, row) => sum + Math.max(row.length, left.columns.length), 0) +
    right.rows.reduce((sum, row) => sum + Math.max(row.length, right.columns.length), 0);
  if (cellCount > DATA_COMPARE_MAX_CELLS)
    throw connectorUiMessages.error('theLoadedResultsExceedCellsReturnFewerRowsOrColumns');
  if (!config.mapping.length)
    throw connectorUiMessages.error('mapAtLeastOnePairOfComparisonColumns');
  const ids = new Set<string>(),
    leftIndexes = new Set<number>(),
    rightIndexes = new Set<number>();
  for (const entry of config.mapping) {
    if (
      !entry.id ||
      ids.has(entry.id) ||
      leftIndexes.has(entry.left) ||
      rightIndexes.has(entry.right)
    )
      throw connectorUiMessages.error('columnMappingsMustBeOneToOneWithUniqueMapping');
    if (
      !Number.isInteger(entry.left) ||
      !Number.isInteger(entry.right) ||
      entry.left < 0 ||
      entry.left >= left.columns.length ||
      entry.right < 0 ||
      entry.right >= right.columns.length
    )
      throw connectorUiMessages.error('aColumnMappingIsOutsideTheCurrentResultRange');
    ids.add(entry.id);
    leftIndexes.add(entry.left);
    rightIndexes.add(entry.right);
  }
  if (!config.keyColumns.length)
    throw connectorUiMessages.error('explicitlySelectAtLeastOneMatchingKeySelectMultipleColumns');
  if (
    new Set(config.keyColumns).size !== config.keyColumns.length ||
    config.keyColumns.some((id) => !ids.has(id))
  )
    throw connectorUiMessages.error('matchingKeysMustBelongToTheCurrentColumnMappingsAnd');
}
