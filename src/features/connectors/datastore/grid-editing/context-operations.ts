import { createUiMessages } from '../../i18n/ui-message';
import { type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './context-operations.messages';
import type { DatabaseCell, DatabaseTablePage } from '@fouc/shared';
import { GRID_EDIT_LIMITS, type GridEditDraft, type GridEditSelection } from './model';
import { gridRowsWithDrafts, gridRowIdentifiable } from './operations';
import { gridGeneratedColumn, validateGridOriginalValue } from './values';
const connectorUiMessages = createUiMessages(connectorMessages);
export function stageGridSelectedRows(
  page: DatabaseTablePage,
  drafts: readonly GridEditDraft[],
  scope: GridEditSelection,
  kind: 'clone' | 'delete',
  makeId = () => crypto.randomUUID(),
  locale?: Locale,
): GridEditDraft[] {
  if (
    !scope.rows.length ||
    scope.rows.length > GRID_EDIT_LIMITS.rows ||
    new Set(scope.rows).size !== scope.rows.length ||
    scope.rows.some((row) => !Number.isInteger(row) || row < 0 || row >= page.rows.length)
  )
    throw connectorUiMessages.error('selectUpToValidRowsOnTheCurrentPage');
  const projected = gridRowsWithDrafts(page, drafts);
  const added = scope.rows.map((row) => {
    if (drafts.some((draft) => draft.row === row && draft.change.kind === 'delete'))
      throw connectorUiMessages.error(
        'theSelectionIncludesRowsStagedForDeletionUndoThoseDeletions',
      );
    page.rows[row].forEach((value) => validateGridOriginalValue(value, 0, locale));
    if (kind === 'delete') {
      if (!gridRowIdentifiable(page, row))
        throw connectorUiMessages.error('deletingRequiresACompletePrimaryKeyOrNonNullUnique');
      return {
        id: makeId(),
        row,
        change: { kind: 'delete' as const, original: structuredClone(page.rows[row]) },
      };
    }
    const values: Record<string, DatabaseCell> = {};
    page.columns.forEach((column, index) => {
      if (column.isPrimaryKey || gridGeneratedColumn(column)) return;
      const value = projected[row][index] ?? null;
      validateGridOriginalValue(value, undefined, locale);
      Object.defineProperty(values, column.name, {
        value: structuredClone(value),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    });
    return { id: makeId(), row: null, change: { kind: 'insert' as const, values } };
  });
  const next = [
    ...drafts.filter(
      (draft) => kind === 'clone' || draft.row === null || !scope.rows.includes(draft.row),
    ),
    ...added,
  ];
  if (
    next.length > GRID_EDIT_LIMITS.changes ||
    JSON.stringify(next.map((draft) => draft.change)).length > GRID_EDIT_LIMITS.characters
  )
    throw connectorUiMessages.error('pendingChangesExceedItemsOrMbReduceTheBatch');
  return next;
}
