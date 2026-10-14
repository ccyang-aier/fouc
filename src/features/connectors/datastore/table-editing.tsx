'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-editing.messages';
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  PencilSimple,
  Trash,
  FileCode,
  X,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import type {
  DatabaseTablePage,
  RelationalRowChange,
  RelationalSavePreview,
  RelationalSaveResult,
} from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { RowEditDialog } from './row-edit-dialog';
import { SavePreviewDialog } from './save-preview-dialog';
import styles from './table-editing.module.css';
import common from './relational.module.css';
import {
  GridEditingActions,
  useGridDraftHistory,
  type GridEditDraft as Draft,
  type GridEditCell,
  type GridEditSelection,
} from './grid-editing';
import { stageGridSelectedRows } from './grid-editing/context-operations';
import type { TableGridCommandHandle } from './grid/context-actions';
const connectorUiMessages = createUiMessages(connectorMessages);
export function TableEditing({
  base,
  schema,
  page,
  selectedRow,
  provider,
  selection,
  activeCell,
  shortcutTarget,
  onDraftsChange,
  writable,
  disabled,
  onPending,
  onSaved,
  toolbarTarget,
  toolsTarget,
  commandRef,
}: {
  base: string;
  schema: string;
  page: DatabaseTablePage;
  selectedRow: number | null;
  provider: import('@fouc/shared').RelationalProvider;
  selection: GridEditSelection | null;
  activeCell: GridEditCell | null;
  shortcutTarget: RefObject<HTMLElement | null>;
  onDraftsChange: (drafts: Draft[]) => void;
  writable: boolean;
  disabled: boolean;
  onPending: (pending: boolean) => void;
  onSaved: (message: string) => void;
  toolbarTarget?: HTMLElement | null;
  toolsTarget?: HTMLElement | null;
  commandRef?: RefObject<TableGridCommandHandle | null>;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const history = useGridDraftHistory();
  const { drafts } = history;
  useEffect(() => {
    onPending(drafts.length > 0);
    onDraftsChange(drafts);
  }, [drafts, onPending, onDraftsChange]);
  const [editing, setEditing] = useState<{
    row: number | null;
    draftId?: string;
  } | null>(null);
  const gridCommands = useRef<TableGridCommandHandle | null>(null);
  const [preview, setPreview] = useState<RelationalSavePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const selected = selectedRow === null ? null : page.rows[selectedRow];
  const identifiable = page.columns.some((column) => column.isPrimaryKey || column.isUnique);
  useImperativeHandle(commandRef, () => ({
    execute(command, scope) {
      if (!writable || disabled || busy || preview || editing) return;
      if (command === 'clone' || command === 'delete') {
        try {
          history.apply(
            stageGridSelectedRows(page, drafts, scope, command, undefined, locale),
            command === 'clone'
              ? tConnector('cloneSelectedRows')
              : tConnector('deleteSelectedRows'),
          );
          setError('');
        } catch (reason) {
          setError(
            reason instanceof Error
              ? uiFailure(reason)
              : connectorUiMessages.message('unableToStageSelectedRowAction'),
          );
        }
      } else gridCommands.current?.execute(command, scope);
    },
  }));
  function update(next: Draft[]) {
    history.apply(next);
    setError('');
  }
  function stage(change: RelationalRowChange, row: number | null) {
    const existing = editing?.draftId
      ? drafts.find((draft) => draft.id === editing.draftId)
      : row === null
        ? undefined
        : drafts.find((draft) => draft.row === row);
    update([
      ...drafts.filter((draft) => draft !== existing),
      { id: existing?.id ?? crypto.randomUUID(), row, change },
    ]);
    setEditing(null);
  }
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      setPreview(
        await backendFetch<RelationalSavePreview>(`${base}/save-plans`, {
          method: 'POST',
          body: JSON.stringify({
            schema,
            table: page.table,
            changes: drafts.map((draft) => draft.change),
          }),
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('unableToGeneratePreview'),
      );
    } finally {
      setBusy(false);
    }
  }
  function closePreview() {
    if (preview)
      void backendFetch(`${base}/save-plans/${preview.id}`, { method: 'DELETE' }).catch(() => {});
    setPreview(null);
    setError('');
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await backendFetch<RelationalSaveResult>(
        `${base}/save-plans/${preview.id}/commit`,
        {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        },
      );
      history.reset();
      setPreview(null);
      onSaved(
        tConnector('committedChangesMs', {
          p0: String(result.affectedRows),
          p1: String(result.executionTimeMs),
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('commitFailedRefreshAndCheckTheData'),
      );
    } finally {
      setBusy(false);
    }
  }
  const prior = editing?.draftId
    ? drafts.find((draft) => draft.id === editing.draftId)?.change
    : editing?.row == null
      ? undefined
      : drafts.find((draft) => draft.row === editing.row && draft.change.kind === 'update')?.change;
  const toolbar = (
    <div className={toolbarTarget ? styles.nativeToolbar : styles.toolbar}>
      <button
        type="button"
        disabled={!writable || disabled || busy}
        onClick={() => setEditing({ row: null })}
      >
        <Plus size={14} />
        {tConnector('addRow')}
      </button>
      <button
        type="button"
        disabled={!writable || disabled || busy || !selected || !identifiable}
        onClick={() => setEditing({ row: selectedRow })}
      >
        <PencilSimple size={14} />
        {tConnector('editRow')}
      </button>
      <button
        type="button"
        className="fouc-action"
        data-variant="destructive"
        disabled={!writable || disabled || busy || !selected || !identifiable}
        onClick={() => selected && stage({ kind: 'delete', original: selected }, selectedRow)}
      >
        <Trash size={14} />
        {tConnector('deleteRows')}
      </button>
      <button
        type="button"
        className={styles.submit}
        disabled={!drafts.length || busy || disabled}
        onClick={() => void prepare()}
      >
        <FileCode size={14} />
        {tConnector('commit')}
      </button>
      <button
        type="button"
        disabled={!drafts.length || busy}
        onClick={() => {
          history.reset();
          setError('');
        }}
      >
        <ArrowCounterClockwise size={14} />
        {tConnector('rollBack')}
      </button>
    </div>
  );
  return (
    <div className={styles.editing}>
      {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar}
      <GridEditingActions
        page={page}
        provider={provider}
        selection={selection}
        activeCell={activeCell}
        shortcutTarget={shortcutTarget}
        writable={writable}
        disabled={disabled || busy || !!preview || !!editing}
        history={history}
        toolbarTarget={toolsTarget}
        commandRef={gridCommands}
      />
      {drafts.length > 0 && (
        <div className={styles.drafts}>
          <div className={styles.draftHead}>
            <strong>
              {drafts.length}
              {tConnector('changesAwaitingCommit')}
            </strong>
            <button type="button" disabled={busy} onClick={() => update([])}>
              {tConnector('discardAll')}
            </button>
            <button
              type="button"
              className={common.primary}
              disabled={busy || disabled}
              onClick={() => void prepare()}
            >
              <FileCode size={14} />
              {busy ? tConnector('generatingPreview') : tConnector('previewAndCommit')}
            </button>
          </div>
          <div className={styles.draftList}>
            {drafts.map((draft) => (
              <span key={draft.id}>
                <b>
                  {draft.change.kind === 'insert'
                    ? tConnector('addRecord')
                    : draft.change.kind === 'delete'
                      ? tConnector('delete')
                      : tConnector('modified')}
                </b>
                {draft.row === null
                  ? ''
                  : tConnector('row', { p0: String(page.offset + draft.row + 1) })}
                {draft.change.kind === 'insert' && (
                  <button
                    type="button"
                    aria-label={tConnector('editNewChange', {
                      p0: String(drafts.indexOf(draft) + 1),
                    })}
                    disabled={busy || disabled}
                    onClick={() => setEditing({ row: null, draftId: draft.id })}
                  >
                    <PencilSimple size={12} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={tConnector('removeChange', { p0: String(drafts.indexOf(draft) + 1) })}
                  disabled={busy}
                  onClick={() => update(drafts.filter((item) => item.id !== draft.id))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {error && !preview && (
        <p className={common.error} role="alert">
          {error}
        </p>
      )}
      {editing && (
        <RowEditDialog
          columns={page.columns}
          original={editing.row === null ? undefined : page.rows[editing.row]}
          values={prior?.kind === 'update' || prior?.kind === 'insert' ? prior.values : undefined}
          onClose={() => setEditing(null)}
          onStage={(change) => stage(change, editing.row)}
        />
      )}
      {preview && (
        <SavePreviewDialog
          preview={preview}
          busy={busy}
          error={error}
          onClose={closePreview}
          onCommit={() => void commit()}
        />
      )}
    </div>
  );
}
