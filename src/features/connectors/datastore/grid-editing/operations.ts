import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './operations.messages';
import type { DatabaseTablePage, RelationalProvider } from '@fouc/shared';
import {
  GRID_EDIT_LIMITS,
  type GridCellEdit,
  type GridEditDraft,
  type GridEditSelection,
  type GridEditValue,
} from './model';
import {
  coerceGridEditValue,
  gridGeneratedColumn,
  sameGridEditValue,
  validateGridOriginalValue,
} from './values';
const connectorUiMessages = createUiMessages(connectorMessages);
export function gridRowIdentifiable(page: DatabaseTablePage, rowIndex: number): boolean {
  const row = page.rows[rowIndex];
  if (!row || row.length !== page.columns.length) return false;
  const primary = page.columns.flatMap((column, index) => (column.isPrimaryKey ? [index] : []));
  return primary.length
    ? primary.every((index) => row[index] !== null && row[index] !== undefined)
    : page.columns.some(
        (column, index) => column.isUnique && row[index] !== null && row[index] !== undefined,
      );
}
export function validateGridEditScope(
  page: DatabaseTablePage,
  scope: GridEditSelection | null,
  locale?: Locale,
): string | null {
  const tConnector = createTranslator(connectorMessages, locale);
  if (!scope?.rows.length || !scope.columns.length)
    return tConnector('selectACellOrRectangularSelectionToEdit');
  if (!scope.rectangular) return tConnector('disjointCellsCannotBeFilledOrPastedAsAMatrix');
  if (
    scope.rows.length > GRID_EDIT_LIMITS.rows ||
    scope.rows.length * scope.columns.length > GRID_EDIT_LIMITS.cells
  )
    return tConnector('eachOperationSupportsUpToRowsAndCellsReduceThe');
  if (
    new Set(scope.rows).size !== scope.rows.length ||
    new Set(scope.columns).size !== scope.columns.length
  )
    return tConnector('duplicateSelectionIndicesSelectAgain');
  if (
    scope.rows.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= page.rows.length,
    ) ||
    scope.columns.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= page.columns.length,
    )
  )
    return tConnector('theSelectionIsOutsideTheCurrentlyLoadedPageSelectAgain');
  if (scope.rows.some((index) => !gridRowIdentifiable(page, index)))
    return tConnector('updatingRequiresACompletePrimaryKeyOrNonNullSingle');
  if (scope.columns.some((index) => gridGeneratedColumn(page.columns[index])))
    return tConnector('theSelectionIncludesGeneratedOrIdentityColumnsDeselectThoseColumns');
  return null;
}
export function fillGridSelection(scope: GridEditSelection, input: GridEditValue): GridCellEdit[] {
  return scope.rows.flatMap((rowIndex) =>
    scope.columns.map((columnIndex) => ({ rowIndex, columnIndex, input })),
  );
}
/** One value fills a matrix; a multi-cell matrix must match exactly and never spill into unseen columns/rows. */
export function pasteGridSelection(
  scope: GridEditSelection,
  matrix: readonly (readonly GridEditValue[])[],
): GridCellEdit[] {
  if (!scope.rectangular || !scope.rows.length || !scope.columns.length)
    throw connectorUiMessages.error('selectTheDestinationRectangleBeforePasting');
  if (matrix.length === 1 && matrix[0]?.length === 1) return fillGridSelection(scope, matrix[0][0]);
  if (
    matrix.length !== scope.rows.length ||
    matrix.some((row) => row.length !== scope.columns.length)
  )
    throw connectorUiMessages.error('thePastedMatrixIsRowsColumnsAndMustMatchThe', {
      p0: String(matrix.length),
      p1: String(matrix[0]?.length ?? 0),
      p2: String(scope.rows.length),
      p3: String(scope.columns.length),
    });
  return scope.rows.flatMap((rowIndex, row) =>
    scope.columns.map((columnIndex, column) => ({
      rowIndex,
      columnIndex,
      input: matrix[row][column],
    })),
  );
}
export function stageGridCellEdits(
  page: DatabaseTablePage,
  drafts: readonly GridEditDraft[],
  edits: readonly GridCellEdit[],
  provider: RelationalProvider,
  makeId: () => string = () => crypto.randomUUID(),
  locale?: Locale,
): GridEditDraft[] {
  if (
    !edits.length ||
    edits.length > GRID_EDIT_LIMITS.cells ||
    new Set(edits.map((edit) => edit.rowIndex)).size > GRID_EDIT_LIMITS.rows
  )
    throw connectorUiMessages.error('eachOperationRequiresCellsAndNoMoreThanRows');
  const seen = new Set<string>(),
    validatedRows = new Set<number>(),
    changes = new Map<number, GridEditDraft>(),
    existing = new Map(
      drafts.filter((draft) => draft.row !== null).map((draft) => [draft.row!, draft]),
    );
  for (const edit of edits) {
    const column = page.columns[edit.columnIndex],
      row = page.rows[edit.rowIndex],
      cellKey = `${edit.rowIndex}:${edit.columnIndex}`,
      prior = existing.get(edit.rowIndex);
    if (
      !column ||
      !row ||
      !Number.isInteger(edit.columnIndex) ||
      !Number.isInteger(edit.rowIndex) ||
      edit.columnIndex < 0 ||
      edit.rowIndex < 0
    )
      throw connectorUiMessages.error('originalRowsOrColumnsChangedSelectAgain');
    if (seen.has(cellKey))
      throw connectorUiMessages.error('anEditCannotAssignTheSameCellMoreThanOnce');
    seen.add(cellKey);
    if (!gridRowIdentifiable(page, edit.rowIndex))
      throw connectorUiMessages.error('rowLacksACompletePrimaryKeyOrNonNullSingle', {
        p0: String(page.offset + edit.rowIndex + 1),
      });
    if (gridGeneratedColumn(column))
      throw connectorUiMessages.error('isDatabaseGeneratedAndCannotBeAssignedDirectly', {
        p0: String(column.name),
      });
    if (prior?.change.kind === 'delete')
      throw connectorUiMessages.error('rowIsStagedForDeletionUndoThatDeletionFirst', {
        p0: String(page.offset + edit.rowIndex + 1),
      });
    if (prior?.change.kind === 'insert')
      throw connectorUiMessages.error('newRecordsCannotBeBoundToALoadedRowIndex');
    if (!validatedRows.has(edit.rowIndex)) {
      row.forEach((value) => validateGridOriginalValue(value, undefined, locale));
      validatedRows.add(edit.rowIndex);
    }
    if (prior?.change.kind === 'update' && !sameGridEditValue(prior.change.original, row))
      throw connectorUiMessages.error('originalRowsInPendingChangesNoLongerMatchTheLoaded');
    let draft = changes.get(edit.rowIndex);
    if (!draft) {
      draft = {
        id: prior?.id ?? makeId(),
        row: edit.rowIndex,
        change: {
          kind: 'update',
          original: prior?.change.kind === 'update' ? prior.change.original : structuredClone(row),
          values: prior?.change.kind === 'update' ? { ...prior.change.values } : {},
        },
      };
      changes.set(edit.rowIndex, draft);
    }
    if (draft.change.kind !== 'update') throw connectorUiMessages.error('invalidPendingRowType');
    if (edit.input.mode === 'restore') {
      delete draft.change.values[column.name];
      continue;
    }
    if (edit.input.mode === 'null' && !column.isNullable)
      throw connectorUiMessages.error('doesNotAllowNull', { p0: String(column.name) });
    const original = row[edit.columnIndex],
      value =
        edit.input.mode === 'null'
          ? null
          : coerceGridEditValue(edit.input.text, column, original, provider);
    validateGridOriginalValue(value, undefined, locale);
    if (sameGridEditValue(value, original)) delete draft.change.values[column.name];
    else
      Object.defineProperty(draft.change.values, column.name, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  const next: GridEditDraft[] = [];
  for (const draft of drafts) {
    const replacement = draft.row === null ? undefined : changes.get(draft.row);
    if (!replacement) next.push(draft);
    else if (replacement.change.kind === 'update' && Object.keys(replacement.change.values).length)
      next.push(replacement);
  }
  for (const [row, draft] of changes)
    if (
      !existing.has(row) &&
      draft.change.kind === 'update' &&
      Object.keys(draft.change.values).length
    )
      next.push(draft);
  if (next.length > GRID_EDIT_LIMITS.changes)
    throw connectorUiMessages.error('thePendingListSupportsUpToChangesSaveOrReduce');
  if (JSON.stringify(next.map((draft) => draft.change)).length > GRID_EDIT_LIMITS.characters)
    throw connectorUiMessages.error('originalRowsAndChangesExceedTheSaveProtocolSMb');
  return next;
}
/** Display projection only. Inserts/deletes remain explicit draft entries, keeping loaded row indexes stable. */
export function gridRowsWithDrafts(
  page: DatabaseTablePage,
  drafts: readonly GridEditDraft[],
): DatabaseTablePage['rows'] {
  const updates = new Map(
    drafts
      .filter((draft) => draft.row !== null && draft.change.kind === 'update')
      .map((draft) => [draft.row!, draft.change]),
  );
  return page.rows.map((row, index) => {
    const change = updates.get(index);
    return change?.kind === 'update'
      ? page.columns.map((column, columnIndex) =>
          Object.hasOwn(change.values, column.name) ? change.values[column.name] : row[columnIndex],
        )
      : row;
  });
}
