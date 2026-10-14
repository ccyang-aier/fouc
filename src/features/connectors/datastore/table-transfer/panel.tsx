'use client';

import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowsLeftRight, CheckCircle, Warning, X } from '@phosphor-icons/react';
import type { RelationalTableStructure } from '@fouc/shared';
import {
  tableTransferInputSchema,
  validateTableTransferMapping,
  type TableTransferInput,
  type TableTransferPlan,
  type TableTransferProgress,
  type TableTransferResult,
} from '@fouc/shared/table-transfer';
import { autoTransferMappings, TransferMappingTable } from './mapping';
import styles from './table-transfer.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface TableTransferPanelProps {
  source: RelationalTableStructure;
  target: RelationalTableStructure;
  sourceLabel?: string;
  targetLabel?: string;
  className?: string;
  onPrepare: (input: TableTransferInput) => Promise<TableTransferPlan>;
  onExecute: (
    plan: TableTransferPlan,
    control: {
      signal: AbortSignal;
      onProgress: (progress: TableTransferProgress) => void;
    },
  ) => Promise<TableTransferResult>;
  onComplete?: (result: TableTransferResult) => void;
  onClose?: () => void;
}
export function TableTransferPanel(props: TableTransferPanelProps) {
  return (
    <TransferEditor
      key={`${props.source.connectionId}/${props.source.schema}/${props.source.table}/${props.target.connectionId}/${props.target.schema}/${props.target.table}`}
      {...props}
    />
  );
}
function TransferEditor({
  source,
  target,
  sourceLabel,
  targetLabel,
  className = '',
  onPrepare,
  onExecute,
  onComplete,
  onClose,
}: TableTransferPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [input, setInput] = useState<TableTransferInput>(() => ({
    mode: 'append',
    mappings: autoTransferMappings(source, target),
    maxRows: 20000,
    batchSize: 200,
    rowLimitMode: 'require-complete',
  }));
  const [plan, setPlan] = useState<TableTransferPlan | null>(null),
    [busy, setBusy] = useState<'prepare' | 'execute' | null>(null);
  const [progress, setProgress] = useState<TableTransferProgress | null>(null),
    [result, setResult] = useState<TableTransferResult | null>(null),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [confirmed, setConfirmed] = useState(false),
    [cancelRequested, setCancelRequested] = useState(false),
    [page, setPage] = useState<'mapping' | 'review'>('mapping');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const validation = useMemo(() => {
    const parsed = tableTransferInputSchema.safeParse(input),
      errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    for (const mapping of input.mappings) {
      const from = source.columns.find((column) => column.name === mapping.sourceColumn),
        to = target.columns.find((column) => column.name === mapping.targetColumn);
      if (from && to) {
        const error = validateTableTransferMapping(
          from,
          source.provider,
          to,
          target.provider,
          mapping,
        );
        if (error) errors.push(`${from.name} → ${to.name}：${uiText(error, locale)}`);
      }
    }
    return errors;
  }, [source, target, input, locale]);
  function update(next: TableTransferInput) {
    setInput(next);
    setPlan(null);
    setResult(null);
    setConfirmed(false);
    setError('');
  }
  async function prepare() {
    setBusy('prepare');
    setError('');
    try {
      const next = await onPrepare(input);
      setPlan(next);
      setConfirmed(false);
      setPage('review');
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(null);
    }
  }
  async function execute() {
    if (!plan?.executable || !confirmed) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy('execute');
    setProgress(null);
    setResult(null);
    setError('');
    setCancelRequested(false);
    try {
      const next = await onExecute(plan, { signal: abort.signal, onProgress: setProgress });
      setResult(next);
      try {
        onComplete?.(next);
      } catch {
        setError(
          connectorUiMessages.message('transferFinishedButTargetRefreshFailedReadTheTargetAgain'),
        );
      }
    } catch (reason) {
      setError(
        connectorUiMessages.message('ifTheRequestWasInterruptedReadTheTargetAgainTo', {
          p0: uiFailure(reason),
        }),
      );
    } finally {
      controller.current = null;
      setBusy(null);
    }
  }
  function cancel() {
    setCancelRequested(true);
    controller.current?.abort();
  }
  const phase = progress?.phase ?? 'reading',
    pending = Boolean(busy),
    completed = Boolean(result);
  return (
    <section
      className={`${styles.panel} ${className}`}
      aria-label={tConnector('crossConnectionTableDataTransfer')}
      aria-busy={pending}
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <div className={styles.icon}>
            <ArrowsLeftRight size={22} />
          </div>
          <div>
            <h2>{tConnector('crossConnectionDataTransfer')}</h2>
            <p>{tConnector('appendToAnExistingTableNativeColumnMappingOneTarget')}</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label={tConnector('closeDataTransfer')}
            disabled={pending}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        )}
      </header>
      <div className={styles.endpoints}>
        <div>
          <small>
            {tConnector('sourceConnection')}
            {source.provider.toUpperCase()}
          </small>
          <h3>{sourceLabel || source.connectionId || tConnector('currentSourceSession')}</h3>
          <code>
            {source.schema}.{source.table}
          </code>
        </div>
        <ArrowRight size={21} />
        <div>
          <small>
            {tConnector('targetConnection')}
            {target.provider.toUpperCase()}
          </small>
          <h3>{targetLabel || target.connectionId || tConnector('currentTargetSession')}</h3>
          <code>
            {target.schema}.{target.table}
          </code>
        </div>
      </div>
      <nav className={styles.tabs} aria-label={tConnector('transferConfigurationPages')}>
        <button
          type="button"
          aria-current={page === 'mapping' ? 'page' : undefined}
          disabled={busy === 'execute'}
          onClick={() => setPage('mapping')}
        >
          {tConnector('columnMapping')}
          <span>{input.mappings.length}</span>
        </button>
        <button
          type="button"
          aria-current={page === 'review' ? 'page' : undefined}
          onClick={() => setPage('review')}
        >
          {tConnector('prepareAndExecute')}
        </button>
        <p>{tConnector('sourceTotalRowCountNotReadYet')}</p>
      </nav>
      {page === 'mapping' && (
        <fieldset className={styles.config} disabled={pending || completed}>
          <TransferMappingTable
            source={source}
            target={target}
            mappings={input.mappings}
            onChange={(mappings) => update({ ...input, mappings })}
          />
          <div className={styles.settings}>
            <label>
              {tConnector('safeRowLimit')}
              <input
                aria-label={tConnector('transferSafeRowLimit')}
                type="number"
                min={1}
                max={100000}
                value={input.maxRows}
                onChange={(event) => update({ ...input, maxRows: Number(event.target.value) })}
              />
            </label>
            <label>
              {tConnector('rowsReadPerBatch')}
              <input
                aria-label={tConnector('transferRowsPerBatch')}
                type="number"
                min={1}
                max={1000}
                value={input.batchSize}
                onChange={(event) => update({ ...input, batchSize: Number(event.target.value) })}
              />
            </label>
            <div className={styles.limit}>
              <label>
                <input
                  aria-label={tConnector('transferAtMostNRows')}
                  type="checkbox"
                  checked={input.rowLimitMode === 'first-rows'}
                  onChange={(event) =>
                    update({
                      ...input,
                      rowLimitMode: event.target.checked ? 'first-rows' : 'require-complete',
                    })
                  }
                />
                {tConnector('transferAtMostNRows3738')}
              </label>
              <p>
                {input.rowLimitMode === 'first-rows'
                  ? tConnector('explicitLimitedAppendCommitOnlyTheFirstRowsEvenIf', {
                      p0: String(input.maxRows.toLocaleString(locale)),
                    })
                  : tConnector('completeTransferIsRequiredByDefaultOneAdditionalRowIs')}
              </p>
            </div>
          </div>
          <p className={styles.hint}>
            {tConnector('sourceReadsDoNotUseAConsistentSnapshotAcrossBatches')}
          </p>
        </fieldset>
      )}
      {page === 'review' && (
        <div className={styles.review}>
          {plan ? (
            <>
              <div className={styles.planSummary}>
                <b>
                  {plan.executable
                    ? tConnector('transferPlanReady')
                    : tConnector('mappingNeedsAdjustment')}
                </b>
                <span>
                  {plan.columns.length}
                  {tConnector('columnsPerBatchUpTo')}
                  {plan.effectiveBatchSize}
                  {tConnector('rows')}
                  {plan.input.rowLimitMode === 'first-rows'
                    ? tConnector('firstRowsOnly', {
                        p0: String(plan.input.maxRows.toLocaleString(locale)),
                      })
                    : tConnector('rollbackIfTheRowLimitIsExceeded')}
                </span>
              </div>
              <div className={styles.reviewGrid}>
                <div>
                  <h4>{tConnector('sourceReadSql')}</h4>
                  <pre aria-label={tConnector('transferSourceReadSql')}>
                    {plan.sourcePreviewSql}
                  </pre>
                  <h4>{tConnector('parameterizedTargetAppend')}</h4>
                  <pre aria-label={tConnector('transferTargetWriteSql')}>
                    {plan.targetPreviewSql}
                  </pre>
                  <p className={styles.hint}>
                    {tConnector('moreSourceRowsUnknownExecutionReadsUpToNRows')}
                  </p>
                </div>
                <aside>
                  <h4>{tConnector('impactsAndLimitations')}</h4>
                  {plan.issues.map((issue, index) => (
                    <p
                      key={index}
                      className={issue.severity === 'error' ? styles.errorIssue : styles.warning}
                    >
                      <Warning size={14} />
                      <span>
                        {issue.targetColumn && <b>{issue.targetColumn} · </b>}
                        {issue.message}
                      </span>
                    </p>
                  ))}
                </aside>
              </div>
              {plan.executable && !result && busy !== 'execute' && (
                <label className={styles.confirm}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  {tConnector('confirmTheSourceTargetColumnMappingAnd')}
                  {plan.input.rowLimitMode === 'first-rows'
                    ? tConnector('limitedAppend')
                    : tConnector('completeTransfer')}
                  {tConnector('rules')}
                </label>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <ArrowsLeftRight size={32} />
              <h3>{tConnector('prepareATransferPlanFirst')}</h3>
              <p>
                {tConnector('checkTargetGeneratedColumnsMissingDefaultValuesTypeCompatibilityAnd')}
              </p>
            </div>
          )}
          {(progress || busy === 'execute') && (
            <div
              className={styles.progress}
              role="status"
              aria-label={tConnector('tableTransferProgress')}
            >
              <div className={styles.phase}>
                <span data-active={phase === 'reading'}>{tConnector('readSource')}</span>
                <ArrowRight size={13} />
                <span data-active={phase === 'writing'}>
                  {tConnector('writeTargetTransaction')}
                </span>
                <ArrowRight size={13} />
                <span data-active={phase === 'committing' || phase === 'completed'}>
                  {tConnector('commit')}
                </span>
              </div>
              <div className={styles.metrics}>
                <span>
                  <b>{(progress?.rowsRead ?? 0).toLocaleString(locale)}</b>
                  {tConnector('rowsRead')}
                </span>
                <span>
                  <b>{(progress?.rowsWritten ?? 0).toLocaleString(locale)}</b>
                  {tConnector('rowsWrittenToTransaction')}
                </span>
                <span>
                  <b>{progress?.batchesWritten ?? 0}</b>
                  {tConnector('writeBatches')}
                </span>
                <span>
                  <b>{formatBytes(progress?.bytesRead ?? 0)}</b>
                  {tConnector('sourceData')}
                </span>
              </div>
              {busy === 'execute' && (
                <div className={styles.indeterminate}>
                  <i />
                </div>
              )}
              <p>
                {cancelRequested
                  ? tConnector('cancellationRequestedWaitingForTheCurrentReadWriteBatchTo')
                  : phase === 'committing'
                    ? tConnector('committingTargetTransactionWaitingForDatabaseConfirmation')
                    : phase === 'rolling-back'
                      ? tConnector('targetTransactionRollbackRequestedAfterFailureCancellation')
                      : phase === 'completed'
                        ? tConnector('targetTransactionCommitConfirmed')
                        : tConnector('rowsWrittenToTheTransactionAreNotCommittedYetThe')}
              </p>
            </div>
          )}
          {result && (
            <div
              className={result.status === 'committed' ? styles.resultSuccess : styles.resultError}
              role="status"
            >
              <h3>
                {result.status === 'committed'
                  ? result.sourceHasMore
                    ? tConnector('limitedTransferCommittedMoreSourceRowsRemain')
                    : tConnector('readScopeTransferredAndCommitted')
                  : result.status === 'cancelled'
                    ? tConnector('transferCancelled')
                    : result.status === 'unknown'
                      ? tConnector('transactionOutcomeAwaitingConfirmation')
                      : tConnector('transferFailed')}
              </h3>
              <p>
                {result.transaction === 'committed'
                  ? tConnector('rowsCommittedBatchesSeconds', {
                      p0: String(result.rowsCommitted?.toLocaleString(locale)),
                      p1: String(result.batchesWritten),
                      p2: String((result.elapsedMs / 1000).toFixed(1)),
                    })
                  : result.transaction === 'unknown'
                    ? tConnector('connectionInterruptedDuringCommitReadTheTargetAgainToVerify')
                    : result.transaction === 'rolled-back'
                      ? tConnector('targetRollbackRequestedNoRowsFromThisTransferHaveA')
                      : tConnector('targetTransactionHasNotStarted')}
              </p>
              {result.error && <p>{result.error}</p>}
            </div>
          )}
        </div>
      )}
      {validation.length > 0 && (
        <div className={styles.validation} role="alert">
          {validation.slice(0, 3).map((message, index) => (
            <p key={index}>{message}</p>
          ))}
          {validation.length > 3 && (
            <p>
              {tConnector('another')}
              {validation.length - 3}
              {tConnector('itemsNeedCorrection')}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <footer className={styles.footer}>
        <span>
          {busy === 'prepare' ? (
            tConnector('checkingNativeMetadata')
          ) : busy === 'execute' ? (
            tConnector('targetTransactionRunning')
          ) : result ? (
            tConnector('thisTransferHasEndedReadTargetDataAgain')
          ) : (
            <>
              <CheckCircle size={13} />
              {tConnector('preparationDoesNotWriteToTheDatabase')}
            </>
          )}
        </span>
        {busy === 'execute' ? (
          <button
            type="button"
            className={styles.cancel}
            disabled={cancelRequested}
            onClick={cancel}
          >
            {cancelRequested ? tConnector('cancelling') : tConnector('cancelAndRollBack')}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending || completed || Boolean(validation.length)}
              onClick={() => void prepare()}
            >
              {tConnector('preparePlan')}
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={pending || completed || !plan?.executable || !confirmed}
              onClick={() => void execute()}
            >
              {tConnector('startAppendTransfer')}
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
function formatBytes(value: number): string {
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MiB`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} KiB`
      : `${value} B`;
}
