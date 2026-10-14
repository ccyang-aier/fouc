'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-editor-actions.messages';
import type { RefObject } from 'react';
import { foldAll, unfoldAll } from '@codemirror/language';
import { isolateHistory } from '@codemirror/commands';
import { Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  TextAlignJustify,
} from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { sqlKeywordCaseChanges } from './sql-editor-commands';
export function SqlEditorActions({
  editorRef,
  disabled,
  wrapLines,
  onWrapChange,
  diagnostics,
  onDiagnosticsChange,
}: {
  editorRef: RefObject<EditorView | null>;
  disabled: boolean;
  wrapLines: boolean;
  onWrapChange: () => void;
  diagnostics: boolean;
  onDiagnosticsChange: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const { notify } = useAppAlert();
  function fold(all: boolean) {
    const view = editorRef.current;
    if (view) {
      (all ? foldAll : unfoldAll)(view);
      view.focus();
    }
  }
  function changeCase() {
    const view = editorRef.current;
    if (!view) return;
    const changes = sqlKeywordCaseChanges(view.state);
    if (!changes) {
      notify('info', tConnector('sqlIsBeingParsedTryAgainShortly'));
      return;
    }
    view.dispatch({
      changes,
      annotations: [Transaction.userEvent.of('input.keyword-case'), isolateHistory.of('full')],
    });
    view.focus();
  }
  return (
    <>
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('foldAllSql')}
        title={tConnector('foldAllSql')}
        disabled={disabled}
        onClick={() => fold(true)}
      >
        <ArrowsInLineVertical />
      </button>
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('unfoldAllSql')}
        title={tConnector('unfoldAllSql')}
        disabled={disabled}
        onClick={() => fold(false)}
      >
        <ArrowsOutLineVertical />
      </button>
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('toggleSqlKeywordCase')}
        title={tConnector('toggleSqlKeywordCaseSelectionFirst')}
        disabled={disabled}
        onClick={changeCase}
      >
        <strong aria-hidden>A</strong>
      </button>
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('sqlWordWrap')}
        title={tConnector('sqlWordWrap')}
        aria-pressed={wrapLines}
        disabled={disabled}
        onClick={onWrapChange}
      >
        <TextAlignJustify />
      </button>
      <button
        type="button"
        className="fouc-action"
        aria-label={tConnector('sqlSemanticDiagnostics')}
        title={
          diagnostics
            ? tConnector('sqlSyntaxAndSemanticHintsEnabled')
            : tConnector('sqlSyntaxAndSemanticHintsDisabled')
        }
        aria-pressed={diagnostics}
        disabled={disabled}
        onClick={onDiagnosticsChange}
      >
        <strong aria-hidden className="sql-diagnostics-symbol">
          A
        </strong>
      </button>
    </>
  );
}
