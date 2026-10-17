'use client';

import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-explain-action.messages';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { EditorView } from '@codemirror/view';
import { GitBranch } from '@phosphor-icons/react';
import {
  inspectSqlTemplate,
  resolveSqlExecutionTarget,
  sqlVariableContext,
  type DatabaseQueryResult,
  type RelationalProvider,
  type SqlParameterDescriptor,
  type SqlParameterInput,
} from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { ExplainPlanViewer } from './explain';
import { SqlDialog } from './sql-library-dialog';
import {
  SqlParameterDialog,
  rememberSqlParameters,
  type SqlParameterRecents,
} from './sql-parameter-dialog';
import common from './relational.module.css';
import styles from './sql-explain-action.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Statement = {
  sql: string;
  declarationSql: string;
  descriptors: SqlParameterDescriptor[];
  parameters?: Record<string, SqlParameterInput>;
};
type Props = {
  base: string;
  provider: RelationalProvider;
  schema: string | null;
  targetLabel: string;
  editorRef: RefObject<EditorView | null>;
  disabled: boolean;
  contextIssue?: string;
  onNotice: (message: string) => void;
  resultTriggerTarget?: HTMLElement | null;
};
/** Estimated plans reuse the document's parameters and native scoped session. */
export function SqlExplainAction({
  base,
  provider,
  schema,
  targetLabel,
  editorRef,
  disabled,
  contextIssue,
  onNotice,
  resultTriggerTarget,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [statement, setStatement] = useState<Statement | null>(null),
    [parameters, setParameters] = useState<Statement | null>(null);
  const [result, setResult] = useState<DatabaseQueryResult | null>(null),
    [loading, setLoading] = useState(false),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const request = useRef<AbortController | null>(null),
    [history] = useState<SqlParameterRecents>(() => new Map());
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [base],
  );
  async function load(source: Statement) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatement(source);
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const response = await backendFetch<DatabaseQueryResult>(`${base}/explain`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          sql: source.sql,
          schema,
          declarationSql: source.declarationSql,
          parameters: source.parameters,
        }),
      });
      if (request.current === controller && !controller.signal.aborted) setResult(response);
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (request.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }
  function close() {
    request.current?.abort();
    request.current = null;
    setStatement(null);
    setLoading(false);
    editorRef.current?.focus();
  }
  function open() {
    if (contextIssue) {
      onNotice(contextIssue);
      return;
    }
    const view = editorRef.current;
    if (!view || disabled) return;
    const document = view.state.doc.toString(),
      target = resolveSqlExecutionTarget(document, provider, 'current', view.state.selection.main);
    if (!target) {
      onNotice(tConnector('selectOneSelectWithQueryOrPlaceTheCursorInside'));
      return;
    }
    try {
      const declarationSql = sqlVariableContext(document.slice(0, target.to), provider),
        inspected = inspectSqlTemplate(target.sql, provider, declarationSql);
      const source = { sql: target.sql, declarationSql, descriptors: inspected.descriptors };
      if (source.descriptors.length > 128)
        throw connectorUiMessages.error('executionPlansSupportAtMostParameters');
      if (source.descriptors.length) setParameters(source);
      else void load(source);
    } catch (reason) {
      onNotice(reason instanceof Error ? uiText(reason, locale) : String(reason));
    }
  }
  return (
    <>
      <button
        type="button"
        className="fouc-action"
        data-sql-tool="plan"
        aria-label={tConnector('viewExecutionPlan')}
        title={tConnector('selectionOrCurrentQueryEstimatedPlanOnly')}
        disabled={disabled}
        onClick={open}
      >
        <GitBranch size={16} />
        <span>{tConnector('executionPlan')}</span>
      </button>
      {resultTriggerTarget &&
        createPortal(
          <button
            type="button"
            className="fouc-action"
            aria-label={tConnector('resultAreaExecutionPlan')}
            title={tConnector('viewTheCurrentSqlExecutionPlan')}
            disabled={disabled}
            onClick={open}
          >
            <GitBranch size={18} weight="bold" />
            <span>{tConnector('executionPlan')}</span>
          </button>,
          resultTriggerTarget,
        )}
      {parameters && (
        <SqlParameterDialog
          action="explain"
          sql={parameters.sql}
          declarationSql={parameters.declarationSql}
          provider={provider}
          descriptors={parameters.descriptors}
          history={history}
          targetLabel={targetLabel}
          onClose={() => {
            setParameters(null);
            editorRef.current?.focus();
          }}
          onExecute={(values) => {
            rememberSqlParameters(history, values);
            const source = { ...parameters, parameters: values };
            setParameters(null);
            void load(source);
          }}
        />
      )}
      {statement && (
        <SqlDialog title={tConnector('sqlExecutionPlan')} className={styles.dialog} onClose={close}>
          <div className={styles.context}>
            <span>
              <GitBranch size={16} />
              {targetLabel}
            </span>
            <small>{tConnector('explainEstimatedPlanQueryNotExecuted')}</small>
          </div>
          <details className={styles.source}>
            <summary>{tConnector('viewThisQuery')}</summary>
            <pre>{statement.sql}</pre>
          </details>
          <div className={styles.body}>
            <ExplainPlanViewer
              provider={provider}
              result={result}
              loading={loading}
              error={error}
              onRetry={() => void load(statement)}
            />
          </div>
          <footer className={`${common.dialogFooter} ${styles.footer}`}>
            <small>
              {loading
                ? tConnector('readingTheNativeExecutionPlan')
                : result
                  ? tConnector('msOptimizerEstimatesDoNotRepresentActualDuration', {
                      p0: String(result.executionTimeMs),
                    })
                  : tConnector('queryContentWasKeptCloseEditAndTryAgain')}
            </small>
            <button type="button" className={common.secondary} onClick={close}>
              {loading ? tConnector('cancelAndClose') : tConnector('close')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </>
  );
}
