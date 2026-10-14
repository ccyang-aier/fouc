'use client';
import { uiText } from '../../i18n/ui-message';

import { useTranslation, createTranslator, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './actions.messages';
const translateConnector = createTranslator(connectorMessages);
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useAppAlert } from '@/components/app-alert-provider';
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ClipboardText,
  Copy,
  PencilSimple,
  ArrowUUpLeft,
} from '@phosphor-icons/react';
import type { DatabaseTablePage, RelationalProvider } from '@fouc/shared';
import { formatGridEditClipboard } from './clipboard';
import { GridEditDialog, type GridEditOperation } from './edit-dialog';
import {
  editableGridScope,
  gridDraftCellValue,
  gridEditScopeSignature,
  gridEditSourceCurrent,
  type GridEditCell,
  type GridEditSelection,
} from './model';
import { sameGridEditValue } from './values';
import { fillGridSelection, stageGridCellEdits, validateGridEditScope } from './operations';
import type { GridDraftHistory } from './use-grid-draft-history';
import { gridEditNativeInput, gridEditShortcut } from './shortcuts';
import type { TableGridCommandHandle } from '../grid/context-actions';
import styles from './grid-editing.module.css';
export type GridEditingActionsProps = {
  page: DatabaseTablePage;
  provider: RelationalProvider;
  selection: GridEditSelection | null;
  activeCell?: GridEditCell | null;
  writable: boolean;
  disabled: boolean;
  history: GridDraftHistory;
  onNotice?: (message: string) => void;
  shortcutTarget?: RefObject<HTMLElement | null>;
  toolbarTarget?: HTMLElement | null;
  commandRef?: RefObject<TableGridCommandHandle | null>;
};
export function GridEditingActions({
  page,
  provider,
  selection,
  activeCell,
  writable,
  disabled,
  history,
  onNotice,
  shortcutTarget,
  toolbarTarget,
  commandRef,
}: GridEditingActionsProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const scope = editableGridScope(selection, activeCell),
    signature = gridEditScopeSignature(scope),
    scopeError = validateGridEditScope(page, scope, locale);
  const [operation, setOperation] = useState<GridEditOperation | null>(null);
  const { notify } = useAppAlert();
  const latest = useRef({
    page,
    provider,
    revision: history.revision,
    signature,
    writable,
    disabled,
    alive: true,
  });
  useLayoutEffect(() => {
    latest.current = {
      page,
      provider,
      revision: history.revision,
      signature,
      writable,
      disabled,
      alive: true,
    };
    return () => {
      latest.current.alive = false;
    };
  }, [page, provider, history.revision, signature, writable, disabled]);
  const busy = disabled || !writable,
    current =
      !operation ||
      gridEditSourceCurrent(operation, {
        page,
        provider,
        revision: history.revision,
        signature,
        writable,
        disabled,
        alive: true,
      });
  function notice(message: string) {
    if (onNotice) onNotice(message);
    else notify('info', message);
  }
  function isCurrent() {
    return !!operation && gridEditSourceCurrent(operation, latest.current);
  }
  function open(
    kind: GridEditOperation['kind'],
    initialMode?: 'value' | 'null',
    initialPaste?: string,
    target = scope,
    generated = false,
  ) {
    const error = validateGridEditScope(page, target, locale);
    if (busy || !target || error) {
      notice(error ?? tConnector('unlockTableWritesToEdit'));
      return;
    }
    setOperation({
      kind,
      page,
      provider,
      scope: { ...target, rows: [...target.rows], columns: [...target.columns] },
      drafts: history.drafts,
      revision: history.revision,
      signature: gridEditScopeSignature(target),
      initialMode,
      initialPaste,
      generated,
    });
  }
  useImperativeHandle(commandRef, () => ({
    execute(command, target) {
      if (command === 'fill' || command === 'null') {
        open('fill', command === 'null' ? 'null' : undefined, undefined, target);
        return;
      }
      if (command.startsWith('generate-')) {
        const now = new Date().toISOString();
        const values = target.rows.map((_, row) =>
          target.columns.map((_, column) =>
            command === 'generate-uuid'
              ? crypto.randomUUID()
              : command === 'generate-now'
                ? now
                : row * target.columns.length + column + 1,
          ),
        );
        open('paste', undefined, formatGridEditClipboard(values, '\t'), target, true);
      }
    },
  }));
  const scopedKey = useEffectEvent((event: globalThis.KeyboardEvent) => {
    const command = gridEditShortcut(event);
    if (!command || busy) return;
    event.preventDefault();
    event.stopPropagation();
    if (command === 'undo') history.undo();
    else history.redo();
  });
  const scopedPaste = useEffectEvent((event: ClipboardEvent) => {
    if (gridEditNativeInput(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy || scopeError) {
      notice(busy ? tConnector('unlockTableWritesBeforePasting') : scopeError!);
      return;
    }
    const text = event.clipboardData?.getData('text/plain');
    if (text === undefined) {
      notice(tConnector('theClipboardContainsNoTextUseThePasteToolTo'));
      return;
    }
    open('paste', undefined, text);
  });
  useEffect(() => {
    const element = shortcutTarget?.current;
    if (!element) return;
    const key = (event: globalThis.KeyboardEvent) => scopedKey(event),
      paste = (event: ClipboardEvent) => scopedPaste(event);
    element.addEventListener('keydown', key, true);
    element.addEventListener('paste', paste, true);
    return () => {
      element.removeEventListener('keydown', key, true);
      element.removeEventListener('paste', paste, true);
    };
  }, [shortcutTarget]);
  function restore() {
    if (busy || !scope || scopeError) return;
    try {
      history.apply(
        stageGridCellEdits(
          page,
          history.drafts,
          fillGridSelection(scope, { mode: 'restore' }),
          provider,
          undefined,
          locale,
        ),
        tConnector('restoreOriginalSelectionValues'),
      );
      notice(tConnector('stagedChangesForSelectedFieldsWereRemovedOriginalDataIs'));
    } catch (reason) {
      notice(
        reason instanceof Error
          ? uiText(reason, locale)
          : tConnector('couldNotRestoreOriginalValues'),
      );
    }
  }
  async function copyPending() {
    if (!scope?.rectangular) return;
    try {
      const rows = scope.rows.map((rowIndex) =>
        scope.columns.map((columnIndex) =>
          gridDraftCellValue(page, history.drafts, { rowIndex, columnIndex }),
        ),
      );
      await navigator.clipboard.writeText(formatGridEditClipboard(rows, '\t'));
      notice(tConnector('copiedCurrentSelectionValuesTsvIncludesStagedEditsLiteralNull'));
    } catch {
      notice(tConnector('copyFailedCheckBrowserClipboardPermissions'));
    }
  }
  const actionButtons = (
    <div className={styles.actionButtons} data-grid-edit-buttons="">
      <button
        type="button"
        disabled={busy || !!scopeError}
        title={scopeError ?? tConnector('editTheCurrentCellOrCompleteSelection')}
        onClick={() => open('fill')}
      >
        <PencilSimple size={14} />
        {tConnector('editSelection')}
      </button>
      <button
        type="button"
        disabled={busy || !!scopeError}
        title={scopeError ?? tConnector('pasteAMatrixOrASingleFillValue')}
        onClick={() => open('paste')}
      >
        <ClipboardText size={14} />
        {tConnector('paste')}
      </button>
      <button
        type="button"
        disabled={busy || !!scopeError}
        title={scopeError ?? tConnector('setSelectedFieldsToNullReviewThePreviewFirst')}
        onClick={() => open('fill', 'null')}
      >
        NULL
      </button>
      <button
        type="button"
        disabled={busy || !!scopeError || !history.drafts.length}
        title={scopeError ?? tConnector('removeStagedAssignmentsForSelectedFields')}
        onClick={restore}
      >
        <ArrowUUpLeft size={14} />
        <span>{tConnector('restoreOriginalValues')}</span>
      </button>
      <i />
      <button
        type="button"
        disabled={busy || !history.canUndo}
        title={tConnector('undoCtrlZToolbarFocus', { p0: String(history.undoLabel) })}
        aria-label={tConnector('undoPendingChanges')}
        onClick={history.undo}
      >
        <ArrowCounterClockwise size={14} />
      </button>
      <button
        type="button"
        disabled={busy || !history.canRedo}
        title={tConnector('redoCtrlShiftZToolbarFocus', { p0: String(history.redoLabel) })}
        aria-label={tConnector('redoPendingChanges')}
        onClick={history.redo}
      >
        <ArrowClockwise size={14} />
      </button>
      {history.drafts.length > 0 && (
        <button
          type="button"
          disabled={
            !scope?.rectangular ||
            !scope.rows.length ||
            scope.rows.length * scope.columns.length > 100
          }
          title={tConnector(
            'copyCurrentSelectionValuesIncludingStagedEditsWithoutDisplayFormatting',
          )}
          onClick={() => void copyPending()}
        >
          <Copy size={14} />
          <span>{tConnector('copyStagedValues')}</span>
        </button>
      )}
      <small title={scopeError ?? ''}>
        {scope
          ? tConnector('rowsColumns', {
              p0: String(scope.rows.length),
              p1: String(scope.columns.length),
              p2: String(!scope.rectangular ? tConnector('disjointSelection') : ''),
            })
          : tConnector('selectACellOrRectangleToEdit')}
      </small>
    </div>
  );
  return (
    <div
      className={styles.actions}
      data-portaled={!!toolbarTarget}
      aria-label={tConnector('gridStagedEditingTools')}
      onKeyDown={(event) => {
        const command = gridEditShortcut(event);
        if (!command || busy) return;
        event.preventDefault();
        if (command === 'undo') history.undo();
        else history.redo();
      }}
    >
      {toolbarTarget ? createPortal(actionButtons, toolbarTarget) : actionButtons}
      {operation && (
        <GridEditDialog
          operation={operation}
          provider={operation.provider}
          sourceCurrent={current}
          isCurrent={isCurrent}
          onClose={() => setOperation(null)}
          onApply={(edits, label) => {
            if (!isCurrent()) {
              notice(translateConnector('theSourceChangedYourInputIsRetainedCloseAndReopen'));
              return;
            }
            try {
              const next = stageGridCellEdits(page, history.drafts, edits, provider),
                changed = edits.filter(
                  (edit) =>
                    !sameGridEditValue(
                      gridDraftCellValue(page, history.drafts, edit),
                      gridDraftCellValue(page, next, edit),
                    ),
                ).length;
              history.apply(next, label);
              setOperation(null);
              notice(
                changed
                  ? translateConnector('stagedCellsOneUndoStepNotWrittenToTheDatabase', {
                      p0: String(changed),
                    })
                  : translateConnector('valuesMatchNoNewPendingChanges'),
              );
            } catch (reason) {
              notice(
                reason instanceof Error
                  ? uiText(reason, getLocale())
                  : translateConnector('couldNotAddPendingChanges'),
              );
            }
          }}
        />
      )}
    </div>
  );
}
