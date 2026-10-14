'use client';

import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';

import { useTranslation, createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckCircle, Code, Copy, Eye, LockKey, ShieldCheck, Warning } from '@phosphor-icons/react';
import type { RelationalProvider } from '@fouc/shared';
import type {
  SqlMutationCommitResult,
  SqlMutationInput,
  SqlMutationPrepared,
} from '@fouc/shared/sql-mutation';
import { MutationRowDiff } from './row-diff';
import styles from './sql-mutation.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type StoredResult = Omit<SqlMutationCommitResult, 'error'> & { error: UiMessage | null };
export interface SqlMutationPanelProps {
  sessionId: string;
  provider: RelationalProvider;
  schema: string;
  sql: string;
  writable: boolean;
  className?: string;
  onPreview: (
    input: SqlMutationInput,
    control: {
      signal: AbortSignal;
    },
  ) => Promise<SqlMutationPrepared>;
  onCommit: (
    planId: string,
    control: {
      signal: AbortSignal;
    },
  ) => Promise<SqlMutationCommitResult>;
  onUnlock?: () => void | Promise<void>;
  onDiscard?: (planId: string) => void | Promise<void>;
  onCommitted?: (result: SqlMutationCommitResult) => void;
  onClose?: () => void;
}
export function SqlMutationPanel(props: SqlMutationPanelProps) {
  return (
    <MutationPanel key={JSON.stringify([props.sessionId, props.schema, props.sql])} {...props} />
  );
}
function MutationPanel({
  provider,
  schema,
  sql,
  writable,
  className = '',
  onPreview,
  onCommit,
  onUnlock,
  onDiscard,
  onCommitted,
  onClose,
}: SqlMutationPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const editorId = useId();
  const [draft, setDraft] = useState(sql),
    [maxRows, setMaxRows] = useState(200);
  const [prepared, setPrepared] = useState<SqlMutationPrepared | null>(null);
  const [storedResult, setResult] = useState<StoredResult | null>(null);
  const result = useMemo(
    () =>
      storedResult && {
        ...storedResult,
        error: storedResult.error ? uiText(storedResult.error, locale) : null,
      },
    [storedResult, locale],
  );
  const [busy, setBusy] = useState<'preview' | 'commit' | 'unlock' | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [errorStored, setError] = useState<UiMessage>(''),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const notice = uiText(noticeStored, locale);
  const [rowIndex, setRowIndex] = useState(0),
    [changesOnly, setChangesOnly] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef<AbortController | null>(null),
    planId = useRef<string | null>(null);
  const handlers = useRef({ onDiscard });
  useEffect(() => {
    handlers.current = { onDiscard };
  }, [onDiscard]);
  useEffect(
    () => () => {
      request.current?.abort();
      const pending = planId.current;
      if (pending)
        void Promise.resolve()
          .then(() => handlers.current.onDiscard?.(pending))
          .catch(() => undefined);
    },
    [],
  );
  useEffect(() => {
    if (!prepared?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [prepared?.expiresAt]);
  const expired = Boolean(prepared?.expiresAt && now >= prepared.expiresAt);
  const consumed = Boolean(result);
  const review = prepared?.review;
  function discard(): void {
    const pending = planId.current;
    if (pending)
      void Promise.resolve()
        .then(() => onDiscard?.(pending))
        .catch(() => undefined);
    planId.current = null;
    setPrepared(null);
    setResult(null);
    setConfirmed(false);
    setNotice('');
    setError('');
  }
  async function preview(): Promise<void> {
    discard();
    const controller = new AbortController();
    request.current = controller;
    setBusy('preview');
    setCancelRequested(false);
    try {
      const next = await onPreview({ schema, sql: draft, maxRows }, { signal: controller.signal });
      if (controller.signal.aborted) {
        if (next.planId) await onDiscard?.(next.planId);
        setNotice(connectorUiMessages.message('previewCancelled'));
        return;
      }
      setPrepared(next);
      planId.current = next.planId;
      setNow(Date.now());
      setRowIndex(0);
      setChangesOnly(next.review.operation === 'update');
      setNotice(
        next.review.executable
          ? connectorUiMessages.message('readOnlyPreviewCompleteNoWritesExecuted')
          : connectorUiMessages.message('readOnlyReviewCompleteNoExecutablePlanForThisScope'),
      );
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
      else setNotice(connectorUiMessages.message('previewCancelled'));
    } finally {
      request.current = null;
      setBusy(null);
      setCancelRequested(false);
    }
  }
  async function unlock(): Promise<void> {
    setBusy('unlock');
    setError('');
    try {
      await onUnlock?.();
      discard();
      setNotice(
        connectorUiMessages.message(
          'unlockRequestedPreviewAndConfirmAgainUsingTheCurrentConnection',
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(null);
    }
  }
  async function commit(): Promise<void> {
    if (!prepared?.planId || !confirmed || !writable || expired || consumed) return;
    const controller = new AbortController();
    request.current = controller;
    const token = prepared.planId;
    planId.current = null;
    setBusy('commit');
    setCancelRequested(false);
    setError('');
    try {
      const next = await onCommit(token, { signal: controller.signal });
      setResult(next);
      setConfirmed(false);
      if (next.outcome === 'committed') {
        try {
          onCommitted?.(next);
        } catch {
          setNotice(
            connectorUiMessages.message(
              'transactionCommittedButRefreshFeedbackFailedReadTheDataAgain',
            ),
          );
        }
      }
    } catch (reason) {
      // A disconnected HTTP response cannot establish whether COMMIT reached the server.
      setResult({
        outcome: 'unknown',
        affectedRows: null,
        matchedRows: prepared.review.matchedRows,
        executionTimeMs: 0,
        error: uiFailure(reason),
      });
      setConfirmed(false);
    } finally {
      request.current = null;
      setBusy(null);
      setCancelRequested(false);
    }
  }
  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(connectorUiMessages.message('sqlCopied'));
    } catch {
      setError(connectorUiMessages.message('copyFailedCheckClipboardPermissions'));
    }
  }
  return (
    <section
      className={`${styles.panel} ${className}`}
      aria-label={tConnector('sqlWriteReview')}
      aria-busy={Boolean(busy)}
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <ShieldCheck size={24} />
          <div>
            <h2>{tConnector('reviewSqlChanges')}</h2>
            <p>
              {provider.toUpperCase()}
              <span>{schema}</span>
              <span>
                {writable ? tConnector('connectionUnlocked') : tConnector('readOnlyConnection')}
              </span>
            </p>
          </div>
        </div>
        {onClose && (
          <button type="button" disabled={Boolean(busy)} onClick={onClose}>
            {tConnector('close')}
          </button>
        )}
      </header>
      <div className={styles.editor}>
        <label htmlFor={editorId}>{tConnector('currentStatement')}</label>
        <textarea
          id={editorId}
          aria-label={tConnector('sqlToReview')}
          value={draft}
          disabled={Boolean(busy)}
          onChange={(event) => {
            discard();
            setDraft(event.target.value);
          }}
          spellCheck={false}
        />
        {draft.length > 65536 && (
          <p className={styles.alert} role="alert">
            {tConnector('eachSqlReviewSupportsAtMostCharactersReduceTheStatement')}
          </p>
        )}
        <div className={styles.editorActions}>
          <label>
            {tConnector('maximumTargetRows')}
            <select
              aria-label={tConnector('sqlPreviewTargetRowLimit')}
              value={maxRows}
              disabled={Boolean(busy)}
              onChange={(event) => {
                discard();
                setMaxRows(Number(event.target.value));
              }}
            >
              <option value={50}>50</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </label>
          <span>{tConnector('thePreviewDoesNotExecuteInsertUpdateDelete')}</span>
          <button
            type="button"
            className={styles.primary}
            disabled={Boolean(busy) || !draft.trim() || draft.length > 65536}
            onClick={() => void preview()}
          >
            <Eye size={16} />
            {busy === 'preview'
              ? tConnector('readOnlyPreviewInProgress')
              : tConnector('generateReadOnlyPreview')}
          </button>
        </div>
      </div>
      {error && (
        <p className={styles.alert} role="alert">
          <Warning size={16} />
          {error}
        </p>
      )}
      {busy === 'preview' && (
        <div className={styles.loading} role="status">
          <div />
          <div />
          <p>{tConnector('executingNativeSelectCalculatingScopeAndCheckingMetadata')}</p>
        </div>
      )}
      {review && (
        <div className={styles.review}>
          <div className={styles.reviewHeader}>
            <div>
              <span>{review.operation.toUpperCase()}</span>
              <h3>
                {review.schema}.{review.table}
              </h3>
            </div>
            <dl>
              <div>
                <dt>{tConnector('targetScope')}</dt>
                <dd>
                  {review.matchedRows.toLocaleString(locale)}
                  {tConnector('row')}
                </dd>
              </div>
              <div>
                <dt>{tConnector('knownValueChanges')}</dt>
                <dd>
                  {review.changedRows === null
                    ? tConnector('notFullyCalculated')
                    : tConnector('rows', { p0: String(review.changedRows.toLocaleString(locale)) })}
                </dd>
              </div>
              <div>
                <dt>{tConnector('executionPlan')}</dt>
                <dd>
                  {consumed
                    ? tConnector('used')
                    : expired
                      ? tConnector('expired')
                      : prepared.planId
                        ? tConnector('validOnce')
                        : tConnector('notExecutable')}
                </dd>
              </div>
            </dl>
          </div>
          {review.issues.length > 0 && (
            <div className={styles.alert} role="alert">
              {review.issues.join('；')}
            </div>
          )}
          <div className={styles.compareHead}>
            <label>
              {tConnector('viewRow')}
              <select
                aria-label={tConnector('chooseSqlComparisonPreviewRow')}
                value={rowIndex}
                disabled={!review.rows.length}
                onChange={(event) => setRowIndex(Number(event.target.value))}
              >
                {review.rows.map((_, index) => (
                  <option key={index} value={index}>
                    {tConnector('no')}
                    {index + 1}
                    {tConnector('row')}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {review.matchedRows > review.sampleLimit
                ? tConnector('showingTheFirstRows', {
                    p0: String(review.sampleLimit),
                    p1: String(
                      review.executable
                        ? tConnector('executionPlanVerifiesAllRows', {
                            p0: String(review.matchedRows),
                          })
                        : tConnector('noExecutionPlanGenerated'),
                    ),
                  })
                : tConnector('rowsOldNewValueComparison', { p0: String(review.rows.length) })}
            </span>
            <label>
              <input
                type="checkbox"
                checked={changesOnly}
                onChange={(event) => setChangesOnly(event.target.checked)}
              />
              {tConnector('changesOnly')}
            </label>
          </div>
          <MutationRowDiff review={review} rowIndex={rowIndex} changesOnly={changesOnly} />
          <div className={styles.scripts}>
            <details>
              <summary>
                <Code size={15} />
                {tConnector('sqlToCommit')}
              </summary>
              <button type="button" onClick={() => void copy(review.writeSql)}>
                <Copy size={13} />
                {tConnector('copy')}
              </button>
              <pre aria-label={tConnector('sqlToCommit')}>{review.writeSql}</pre>
            </details>
            <details>
              <summary>
                <Code size={15} />
                {tConnector('readOnlyPreviewAndScopeCount')}
              </summary>
              <button type="button" onClick={() => void copy(review.previewSql)}>
                <Copy size={13} />
                {tConnector('copyPreview')}
              </button>
              <pre aria-label={tConnector('readOnlyRewrittenSelect')}>{review.previewSql}</pre>
              <pre aria-label={tConnector('nativeScopeCountSql')}>{review.countSql}</pre>
            </details>
          </div>
          <details className={styles.limitations}>
            <summary>
              <Warning size={14} />
              {tConnector('supportedScopeAndExecutionSemantics')}
            </summary>
            <ul>
              {review.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </details>
          {review.executable && !consumed && !expired && writable && (
            <label className={styles.confirm}>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={Boolean(busy)}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {tConnector('iHaveReviewedTheTargetRowsOldNewValuesAnd')}
            </label>
          )}
          {result && (
            <div
              className={result.outcome === 'committed' ? styles.success : styles.alert}
              role="status"
            >
              <div>
                <h4>{outcomeTitle(result.outcome, locale)}</h4>
                <p>
                  {result.error ||
                    tConnector('rowsReviewedDriverReportsAffectedRowsMs', {
                      p0: String(result.matchedRows),
                      p1: String(result.affectedRows),
                      p2: String(result.executionTimeMs),
                    })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {!review && !busy && (
        <div className={styles.empty}>
          <Eye size={28} />
          <h3>{tConnector('checkTheDataBeforeDecidingToExecute')}</h3>
          <p>
            {tConnector('supportsSingleTableValuesDeterministicUpdateAssignmentsAndDeleteWhere')}
          </p>
        </div>
      )}
      <footer className={styles.footer}>
        <span role="status">
          {cancelRequested
            ? tConnector('cancellationRequestedWaitingForTheCurrentStatementToEndBefore')
            : notice ||
              (expired
                ? tConnector('planExpiredGenerateANewPreview')
                : prepared?.expiresAt
                  ? tConnector('planExpiresInSeconds', {
                      p0: String(Math.max(0, Math.ceil((prepared.expiresAt - now) / 1000))),
                    })
                  : tConnector('readOnlyPreviewAndConfirmedExecutionUseTheSameConnection'))}
        </span>
        {busy && busy !== 'unlock' && (
          <button
            type="button"
            disabled={cancelRequested}
            onClick={() => {
              request.current?.abort();
              setCancelRequested(true);
            }}
          >
            {tConnector('cancel')}
            {busy === 'preview' ? tConnector('preview') : tConnector('execute')}
          </button>
        )}
        {!writable && onUnlock && (
          <button type="button" disabled={Boolean(busy)} onClick={() => void unlock()}>
            <LockKey size={15} />
            {tConnector('unlockWrites')}
          </button>
        )}
        <button
          type="button"
          className={styles.commit}
          disabled={
            Boolean(busy) || !writable || !confirmed || !prepared?.planId || expired || consumed
          }
          onClick={() => void commit()}
        >
          <CheckCircle size={16} />
          {busy === 'commit'
            ? tConnector('verifyingAndCommitting')
            : tConnector('confirmSingleTransactionCommit')}
        </button>
      </footer>
    </section>
  );
}
function outcomeTitle(outcome: SqlMutationCommitResult['outcome'], locale?: Locale): string {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    committed: tConnector('transactionCommitted'),
    conflict: tConnector('dataOrStructureConflictTheseChangesWereNotCommitted'),
    cancelled: tConnector('cancelledTransactionRollbackRequested'),
    'rolled-back': tConnector('executionFailedTransactionRollbackRequested'),
    unknown: tConnector('commitOutcomeIsUncertainReadTheDataAgainFirst'),
  }[outcome];
}
