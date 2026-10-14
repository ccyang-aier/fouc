'use client';
import { uiText, type UiMessage, createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './edit-dialog.messages';
const translateConnector = createTranslator(connectorMessages);
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ClipboardText, PencilSimple, WarningCircle } from '@phosphor-icons/react';
import type { DatabaseColumnInfo, DatabaseTablePage, RelationalProvider } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import common from '../relational.module.css';
import { parseGridEditClipboard } from './clipboard';
import { fillGridSelection, pasteGridSelection, stageGridCellEdits } from './operations';
import {
  GRID_EDIT_LIMITS,
  gridDraftCellValue,
  type GridCellEdit,
  type GridEditDraft,
  type GridEditSelection,
  type GridEditValue,
} from './model';
import { coerceGridEditValue, gridCellEditorText, sameGridEditValue } from './values';
import styles from './grid-editing.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export type GridEditOperation = {
  kind: 'fill' | 'paste';
  page: DatabaseTablePage;
  provider: RelationalProvider;
  scope: GridEditSelection;
  drafts: readonly GridEditDraft[];
  revision: number;
  signature: string;
  initialMode?: 'value' | 'null';
  initialPaste?: string;
  generated?: boolean;
};
type Props = {
  operation: GridEditOperation;
  provider: RelationalProvider;
  sourceCurrent: boolean;
  isCurrent: () => boolean;
  onApply: (edits: readonly GridCellEdit[], label: string) => void;
  onClose: () => void;
};
function previewText(
  value: ReturnType<typeof gridDraftCellValue>,
  column: DatabaseColumnInfo,
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  return value === null
    ? 'NULL'
    : value === ''
      ? tConnector('emptyString')
      : value === 'NULL'
        ? '"NULL"'
        : gridCellEditorText(value, column);
}
export function GridEditDialog({
  operation,
  provider,
  sourceCurrent,
  isCurrent,
  onApply,
  onClose,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const { page, scope, drafts } = operation,
    first = gridDraftCellValue(page, drafts, {
      rowIndex: scope.rows[0],
      columnIndex: scope.columns[0],
    });
  const [mode, setMode] = useState<GridEditValue['mode']>(
      operation.initialMode ?? (first === null ? 'null' : 'value'),
    ),
    [text, setText] = useState(
      operation.kind === 'paste'
        ? (operation.initialPaste ?? '')
        : gridCellEditorText(first, page.columns[scope.columns[0]]),
    );
  const [separator, setSeparator] = useState<',' | '\t'>('\t'),
    [nullMarker, setNullMarker] = useState(false),
    [emptyAsNull, setEmptyAsNull] = useState(false);
  const [reading, setReading] = useState(false),
    [readErrorStored, setReadError] = useState<UiMessage>(''),
    inputRevision = useRef(0),
    alive = useRef(true);
  const readError = uiText(readErrorStored, locale);
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const plan = useMemo(() => {
    try {
      const edits =
        operation.kind === 'paste'
          ? pasteGridSelection(
              scope,
              parseGridEditClipboard(text, {
                separator,
                ...(nullMarker ? { nullToken: 'NULL' } : {}),
                emptyStringAsNull: emptyAsNull,
              }),
            )
          : fillGridSelection(scope, mode === 'value' ? { mode, text } : { mode });
      let ordinal = 0;
      const next = stageGridCellEdits(
        page,
        drafts,
        edits,
        provider,
        () => `preview-${ordinal++}`,
        locale,
      );
      const changed = edits.filter(
        (edit) =>
          !sameGridEditValue(
            gridDraftCellValue(page, drafts, edit),
            gridDraftCellValue(page, next, edit),
          ),
      ).length;
      return { edits, changed, error: '' };
    } catch (reason) {
      return {
        edits: [] as GridCellEdit[],
        changed: 0,
        error:
          reason instanceof Error ? uiText(reason, locale) : tConnector('couldNotPreviewEdits'),
      };
    }
  }, [
    operation.kind,
    page,
    drafts,
    scope,
    provider,
    mode,
    text,
    separator,
    nullMarker,
    emptyAsNull,
    locale,
    tConnector,
  ]);
  async function readClipboard() {
    const revision = ++inputRevision.current;
    setReading(true);
    setReadError('');
    try {
      const value = await navigator.clipboard.readText();
      if (!alive.current) return;
      if (!isCurrent()) {
        setReadError(
          connectorUiMessages.message('theOriginalPageSelectionOrPendingListChangedCloseAnd'),
        );
        return;
      }
      if (revision !== inputRevision.current) {
        setReadError(connectorUiMessages.message('inputChangedWhileReadingCurrentInputIsRetained'));
        return;
      }
      setText(value);
    } catch {
      if (alive.current)
        setReadError(
          connectorUiMessages.message(
            'clipboardReadUnavailablePasteDirectlyBelowAndCheckBrowserPermissions',
          ),
        );
    } finally {
      if (alive.current) setReading(false);
    }
  }
  const canApply = sourceCurrent && !plan.error && plan.changed > 0;
  return (
    <SqlDialog
      title={
        operation.generated
          ? tConnector('generatedValuePreview')
          : operation.kind === 'paste'
            ? tConnector('pasteIntoGridSelection')
            : tConnector('editGridSelection')
      }
      className={styles.dialog}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (canApply)
            onApply(
              plan.edits,
              operation.generated
                ? translateConnector('generateSelectionValues')
                : operation.kind === 'paste'
                  ? translateConnector('pasteIntoSelection')
                  : mode === 'restore'
                    ? translateConnector('restoreOriginalSelectionValues')
                    : mode === 'null'
                      ? translateConnector('setSelectionToNull')
                      : translateConnector('fillSelection'),
            );
        }}
      >
        <div className={styles.scope}>
          <span>
            {operation.kind === 'paste' ? <ClipboardText size={15} /> : <PencilSimple size={15} />}
            <strong>
              {scope.rows.length}
              {tConnector('rows')}
              {scope.columns.length}
              {tConnector('columns')}
            </strong>
            <small>
              {scope.rows.length * scope.columns.length}
              {tConnector('cells')}
            </small>
          </span>
          <small>
            {tConnector('currentLoadedPageUpTo')}
            {GRID_EDIT_LIMITS.rows}
            {tConnector('rows1557')}
            {GRID_EDIT_LIMITS.cells}
            {tConnector('cells1558')}
          </small>
        </div>
        <div className={styles.body}>
          <section className={styles.inputSection} aria-label={tConnector('editContent')}>
            {operation.kind === 'paste' ? (
              <>
                {!operation.generated && (
                  <div className={styles.inputHead}>
                    <label>
                      {tConnector('delimitedFormat')}
                      <select
                        value={separator}
                        onChange={(event) => setSeparator(event.target.value as ',' | '\t')}
                      >
                        <option value={'\t'}>{tConnector('tsvTabs')}</option>
                        <option value=",">{tConnector('csvCommas')}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={reading || !sourceCurrent}
                      onClick={() => void readClipboard()}
                    >
                      <ClipboardText size={14} />
                      {reading ? tConnector('reading') : tConnector('readClipboard')}
                    </button>
                  </div>
                )}
                <label>
                  {operation.generated
                    ? tConnector('generatedResults')
                    : tConnector('pastedMatrix')}
                  <textarea
                    aria-label={
                      operation.generated
                        ? tConnector('gridGeneratedContent')
                        : tConnector('gridPastedContent')
                    }
                    value={text}
                    rows={5}
                    maxLength={GRID_EDIT_LIMITS.characters}
                    autoFocus
                    spellCheck={false}
                    placeholder={tConnector('pasteCsvTsvOneValueFillsTheSelectionWhileA')}
                    onChange={(event) => {
                      inputRevision.current++;
                      setText(event.target.value);
                      setReadError('');
                    }}
                  />
                </label>
                {!operation.generated && (
                  <div className={styles.pasteOptions}>
                    <label>
                      <input
                        type="checkbox"
                        checked={nullMarker}
                        onChange={(event) => setNullMarker(event.target.checked)}
                      />
                      {tConnector('unquotedNullNullValue')}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={emptyAsNull}
                        onChange={(event) => setEmptyAsNull(event.target.checked)}
                      />
                      {tConnector('emptyStringNullValue')}
                    </label>
                  </div>
                )}
                <small>
                  {operation.generated
                    ? tConnector('adjustGeneratedResultsIfNeededConfirmationAddsThemOnlyTo')
                    : tConnector('literalNullAndEmptyStringsArePreservedByDefaultDouble')}
                </small>
              </>
            ) : (
              <>
                <label>
                  {tConnector('valueMode')}
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as GridEditValue['mode'])}
                  >
                    <option value="value">
                      {tConnector('explicitAssignmentPreserveEmptyStrings')}
                    </option>
                    <option value="null">{tConnector('setToSqlNull')}</option>
                    <option value="restore">
                      {tConnector('restoreOriginalValueRemoveThisFieldSStagedChange')}
                    </option>
                  </select>
                </label>
                {mode === 'value' && (
                  <label>
                    {tConnector('fillValue')}
                    <textarea
                      aria-label={tConnector('gridFillValue')}
                      value={text}
                      rows={4}
                      maxLength={GRID_EDIT_LIMITS.characters}
                      autoFocus
                      spellCheck={false}
                      onChange={(event) => setText(event.target.value)}
                    />
                  </label>
                )}
                <small>
                  {mode === 'restore'
                    ? tConnector('restoreSelectedFieldsFromTheirOriginalLoadedRowsWithoutAffecting')
                    : mode === 'null'
                      ? tConnector('allSelectedFieldsMustAllowNullIfAnyFieldFails')
                      : tConnector('parsedByTargetColumnTypeLargeIntegersAndDecimalsRetain')}
                </small>
              </>
            )}
            {readError && (
              <p className={styles.error} role="alert">
                {readError}
              </p>
            )}
            {!sourceCurrent && (
              <p className={styles.error} role="alert">
                <WarningCircle size={14} />
                {tConnector('theOriginalPageSelectionOrPendingListChangedCloseAnd')}
              </p>
            )}
            {plan.error && (
              <p className={styles.error} role="alert">
                {plan.error}
              </p>
            )}
          </section>
          <section className={styles.preview} aria-label={tConnector('editPreview')}>
            <header>
              <strong>{tConnector('cellByCellPreview')}</strong>
              <small>{tConnector('originalSnapshotRetainedUndoTheWholeOperationInOneStep')}</small>
            </header>
            <div className={styles.previewScroll}>
              <table>
                <thead>
                  <tr>
                    <th>{tConnector('position')}</th>
                    <th>{tConnector('rawValue')}</th>
                    <th>{tConnector('existingStagedValue')}</th>
                    <th>{tConnector('newValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.edits.map((edit) => {
                    const original = page.rows[edit.rowIndex][edit.columnIndex],
                      pending = gridDraftCellValue(page, drafts, edit),
                      column = page.columns[edit.columnIndex];
                    const value =
                      edit.input.mode === 'restore'
                        ? original
                        : edit.input.mode === 'null'
                          ? null
                          : coerceGridEditValue(edit.input.text, column, original, provider);
                    return (
                      <tr key={`${edit.rowIndex}:${edit.columnIndex}`}>
                        <th>
                          <b>
                            {tConnector('no')}
                            {page.offset + edit.rowIndex + 1}
                            {tConnector('row')}
                          </b>
                          <span title={column.name}>{column.name}</span>
                        </th>
                        {[original, pending, value].map((cell, index) => (
                          <td
                            key={index}
                            title={previewText(cell, column, locale).slice(0, 4096)}
                            data-null={cell === null || undefined}
                          >
                            <code>{previewText(cell, column, locale).slice(0, 240)}</code>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!plan.edits.length && (
                <p className={styles.empty}>
                  {tConnector('correctTheInputToSeeTheFullEditPreview')}
                </p>
              )}
            </div>
          </section>
        </div>
        <footer className={`${common.dialogFooter} ${styles.footer}`}>
          <small>
            {plan.edits.length
              ? plan.changed
                ? tConnector('valuesChanged', { p0: String(plan.changed) })
                : tConnector('valuesMatchTheCurrentStagedContent')
              : ''}
            {tConnector('savingStillRequiresSqlPreviewConfirmation')}
          </small>
          <button type="button" className={common.secondary} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <button type="submit" className={common.primary} disabled={!canApply}>
            {tConnector('addToPendingChanges')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
