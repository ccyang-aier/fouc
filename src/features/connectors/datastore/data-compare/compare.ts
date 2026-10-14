import { uiText } from '../../i18n/ui-message';

import { createTranslator, type Locale, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './compare.messages';
import type { DatabaseQueryResult } from '@fouc/shared';
import {
  compareCellAt,
  validateCompareConfiguration,
  type DataCompareConfiguration,
  type DataCompareEntry,
  type DataCompareProgress,
  type DataCompareResult,
} from './model';
import { CompareValueLimitError, compareValueToken, type CompareValueBudget } from './values';
type IndexedRow = {
  index: number;
  tokens: string[];
  reasons: string[];
};
type Group = {
  left: IndexedRow[];
  right: IndexedRow[];
  keyValues: DataCompareEntry['keyValues'];
};
export type DataCompareRunOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: DataCompareProgress) => void;
  yieldControl?: () => Promise<void>;
};
function abort(signal?: AbortSignal, locale?: Locale) {
  const tConnector = createTranslator(connectorMessages, locale);
  if (signal?.aborted) throw new DOMException(tConnector('comparisonCancelled'), 'AbortError');
}
/** DBX's key-index/source-order comparison, extended with explicit duplicate conflicts and missing cells. */
export async function compareDataResults(
  left: DatabaseQueryResult,
  right: DatabaseQueryResult,
  config: DataCompareConfiguration,
  options: DataCompareRunOptions = {},
  locale?: Locale,
): Promise<DataCompareResult> {
  const tConnector = createTranslator(connectorMessages, locale);
  validateCompareConfiguration(left, right, config, locale);
  abort(options.signal, locale);
  const started = performance.now(),
    mapping = config.mapping.map((entry) => ({ ...entry })),
    keyColumns = [...config.keyColumns],
    keyIndexes = keyColumns.map((id) => mapping.findIndex((entry) => entry.id === id)),
    groups = new Map<string, Group>(),
    budget: CompareValueBudget = { characters: 0 };
  const total = (left.rows.length + right.rows.length) * 2;
  let completed = 0,
    work = 0;
  const yieldControl =
    options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  async function checkpoint(phase: DataCompareProgress['phase'], force = false, locale?: Locale) {
    abort(options.signal, locale);
    if (!force && work < 4096) return;
    work = 0;
    options.onProgress?.({ phase, completed, total });
    await yieldControl();
    abort(options.signal, locale);
  }
  for (const side of ['left', 'right'] as const) {
    const source = side === 'left' ? left : right;
    for (let index = 0; index < source.rows.length; index++) {
      const row = source.rows[index],
        tokens: string[] = [],
        reasons: string[] = [];
      for (const entry of mapping) {
        const column = entry[side];
        try {
          tokens.push(
            compareValueToken(
              compareCellAt(row, column),
              source.columnTypes[column],
              config.provider,
              budget,
              undefined,
              locale,
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error ? uiText(error, locale ?? getLocale()) : String(error);
          if (error instanceof CompareValueLimitError) throw error;
          reasons.push(`${source.columns[column]}：${message}`);
          tokens.push(`invalid:${side}:${index}:${column}`);
        }
        work++;
        if (work >= 4096) await checkpoint(side, undefined, locale);
      }
      const keyValues = keyIndexes.map((mappingIndex) =>
        compareCellAt(row, mapping[mappingIndex][side]),
      );
      if (keyValues.some((value) => value === undefined))
        reasons.push(tConnector('theMatchingKeyContainsMissingValuesSoReliableMatchingIs'));
      const key = JSON.stringify(keyIndexes.map((mappingIndex) => tokens[mappingIndex]));
      let group = groups.get(key);
      if (!group) {
        group = { left: [], right: [], keyValues };
        groups.set(key, group);
      }
      group[side].push({ index, tokens, reasons });
      completed++;
    }
    await checkpoint(side, true, locale);
  }
  const entries: DataCompareEntry[] = [],
    counts: DataCompareResult['counts'] = {
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
      conflict: 0,
    };
  for (const group of groups.values()) {
    const reasons = [...new Set([...group.left, ...group.right].flatMap((row) => row.reasons))];
    if (group.left.length > 1)
      reasons.push(
        tConnector('duplicateLeftSideMatchingKeysRows', { p0: String(group.left.length) }),
      );
    if (group.right.length > 1)
      reasons.push(
        tConnector('duplicateRightSideMatchingKeysRows', { p0: String(group.right.length) }),
      );
    const changes: DataCompareEntry['changes'] = [];
    if (!reasons.length && group.left.length && group.right.length) {
      for (let index = 0; index < mapping.length; index++)
        if (
          !keyColumns.includes(mapping[index].id) &&
          group.left[0].tokens[index] !== group.right[0].tokens[index]
        )
          changes.push({
            mappingId: mapping[index].id,
            left: compareCellAt(left.rows[group.left[0].index], mapping[index].left),
            right: compareCellAt(right.rows[group.right[0].index], mapping[index].right),
          });
    }
    const kind = reasons.length
      ? 'conflict'
      : !group.right.length
        ? 'added'
        : !group.left.length
          ? 'removed'
          : changes.length
            ? 'modified'
            : 'unchanged';
    const entry: DataCompareEntry = {
      id: `difference-${entries.length}`,
      kind,
      keyValues: group.keyValues,
      leftRows: group.left.map((row) => row.index),
      rightRows: group.right.map((row) => row.index),
      changes,
      reasons,
    };
    entries.push(entry);
    counts[kind]++;
    completed += group.left.length + group.right.length;
    work += mapping.length;
    if (work >= 4096) await checkpoint('compare', undefined, locale);
  }
  options.onProgress?.({ phase: 'complete', completed: total, total });
  return {
    entries,
    counts,
    mapping,
    keyColumns,
    left,
    right,
    partial: !!(left.hasMore || left.truncated || right.hasMore || right.truncated),
    elapsedMs: performance.now() - started,
  };
}
