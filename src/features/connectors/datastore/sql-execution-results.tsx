'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-execution-results.messages';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CircleNotch,
  Clock,
  PushPin,
  SkipForward,
  Stop,
  Table,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  sqlExecutionActive,
  type RelationalProvider,
  type SqlExecutionSnapshot,
  type SqlStatementExecution,
  type SqlResultView as ResultView,
} from '@fouc/shared';
import type { SqlExecutionUI } from './use-sql-executions';
import { SqlQueryResult } from './query-result';
import { sqlResultLabel, sqlResultTabLabel } from './sql-result-label';
import type { SqlResultHeaderHost } from './sql-result-header';
import headerStyles from './sql-result-header.module.css';
import { navigateWorkbenchTabs } from './workbench-tab-navigation';
import { Button } from '@/components/ui/button';
import styles from './sql-execution.module.css';
const labels = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    running: tConnector('executing'),
    cancelling: tConnector('stopping'),
    completed: tConnector('executionComplete'),
    failed: tConnector('executionInterrupted'),
    cancelled: tConnector('cancelled'),
  };
};
function StatementIcon({ statement }: { statement: SqlStatementExecution }) {
  return statement.status === 'running' ? (
    <CircleNotch size={13} className="mw-spin" />
  ) : statement.status === 'succeeded' ? (
    <Table size={13} />
  ) : statement.status === 'failed' ? (
    <WarningCircle size={13} />
  ) : statement.status === 'cancelled' ? (
    <Stop size={13} />
  ) : (
    <SkipForward size={13} />
  );
}
function Elapsed({ execution, active }: { execution: SqlExecutionSnapshot; active: boolean }) {
  const [now, setNow] = useState(execution.startedAt);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [active, execution.id]);
  const duration = Math.max(0, (execution.finishedAt ?? now) - execution.startedAt);
  return (
    <span className={styles.elapsed}>
      <Clock size={12} />
      {duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} s`}
    </span>
  );
}
/** DBX's per-statement result tabs and terminal feedback, using Fouc's native result renderer. */
export function SqlExecutionResults({
  execution,
  provider,
  layoutScopeKey,
  view,
  onViewChange,
  onCancel,
  onReveal,
  onSelect,
  onPin,
  currentPinned,
  headerHost,
  base,
  onExplainTarget,
  onRefresh,
  autoRefresh,
  onAutoRefresh,
  onCloseLastResult,
}: {
  execution?: SqlExecutionUI;
  provider: RelationalProvider;
  layoutScopeKey?: string;
  view: ResultView;
  onViewChange: (view: ResultView) => void;
  onCancel: () => void;
  onReveal: (statement: SqlStatementExecution) => void;
  onSelect: (index: number) => void;
  onPin?: (statement: SqlStatementExecution, index: number) => void;
  currentPinned?: boolean;
  headerHost: SqlResultHeaderHost;
  base: string;
  onExplainTarget: (target: HTMLDivElement | null) => void;
  onRefresh: () => void;
  autoRefresh: boolean;
  onAutoRefresh: () => void;
  onCloseLastResult: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [closedResults, setClosedResults] = useState<number[]>([]);
  const selected = execution?.selectedResult ?? 0,
    setSelected = onSelect;
  const snapshot = execution?.snapshot,
    statement = snapshot?.statements[selected] ?? snapshot?.statements[0];
  if (!execution)
    return (
      <div className="mw-result-state">
        <Table size={26} />
        <strong>{tConnector('queryResults')}</strong>
        <span>{tConnector('runTheCurrentStatementOrAllStatementsToViewSeparate')}</span>
        <small>
          <kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd>
          {tConnector('run')}
          <kbd>Ctrl / ⌘</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>
          {tConnector('runAll')}
        </small>
      </div>
    );
  if (execution.error)
    return (
      <div className="mw-result-state mw-result-failed" role="alert">
        <WarningCircle size={25} />
        <strong>{tConnector('queryRequestCouldNotComplete')}</strong>
        <p>{execution.error}</p>
        <small>{tConnector('yourEditsWereKeptModifyTheSqlAndRunIt')}</small>
      </div>
    );
  if (!snapshot)
    return (
      <div className="mw-result-state" role="status">
        <CircleNotch size={26} className="mw-spin" />
        <strong>{tConnector('submittingQuery')}</strong>
        <span>{tConnector('preparingTargetContextAndExecutionRecord')}</span>
      </div>
    );
  const lost = !execution.running && sqlExecutionActive(snapshot);
  const active = execution.running;
  const openStatements = snapshot.statements
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => !closedResults.includes(index));
  const sourceLabels = snapshot.statements.map((item, index) =>
    sqlResultLabel(
      item.sql,
      provider,
      snapshot.schema,
      tConnector('result', { p0: String(index + 1) }),
    ),
  );
  const tabLabels = sourceLabels.map((label, index) =>
    sqlResultTabLabel(label, [...headerHost.pinnedLabels, ...sourceLabels.slice(0, index)]),
  );
  function closeResult(index: number) {
    if (openStatements.length === 1) onCloseLastResult();
    setClosedResults((previous) => [...previous, index]);
    if (index === selected)
      onSelect(openStatements.find((entry) => entry.index !== index)?.index ?? 0);
  }
  return (
    <div className={styles.results} data-execution-id={snapshot.id}>
      {headerHost.tabs &&
        createPortal(
          openStatements.map(({ item, index }) => (
            <div
              key={index}
              role="tab"
              id={`sql-result-${snapshot.id}-${index}`}
              aria-controls={`sql-result-panel-${snapshot.id}`}
              aria-label={tabLabels[index]}
              aria-selected={headerHost.active && index === selected}
              tabIndex={headerHost.active && index === selected ? 0 : -1}
              className={`${headerStyles.tab} fouc-action`}
              data-status={item.status}
              title={item.sql}
              onClick={() => {
                headerHost.onActivate();
                setSelected(index);
              }}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  headerHost.onActivate();
                  setSelected(index);
                }
                navigateWorkbenchTabs(event);
              }}
            >
              {item.status !== 'succeeded' && <StatementIcon statement={item} />}
              <span>{tabLabels[index]}</span>
              <button
                type="button"
                className={headerStyles.close}
                aria-label={tConnector('closeResult', { p0: String(index + 1) })}
                disabled={item.status === 'running' || item.status === 'pending'}
                onClick={(event) => {
                  event.stopPropagation();
                  closeResult(index);
                }}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          )),
          headerHost.tabs,
        )}
      {headerHost.pin &&
        onPin &&
        createPortal(
          <button
            type="button"
            className={`fouc-action ${styles.pin}`}
            aria-label={tConnector('pinCurrentResult')}
            disabled={
              !openStatements.length ||
              !statement?.result ||
              statement.status !== 'succeeded' ||
              currentPinned
            }
            title={
              currentPinned
                ? tConnector('currentResultPinned')
                : tConnector('pinTheCurrentResultSoRunningAgainDoesNotReplace')
            }
            onClick={() => statement && onPin(statement, selected)}
          >
            <PushPin size={19} weight={currentPinned ? 'fill' : 'bold'} />
          </button>,
          headerHost.pin,
        )}
      {headerHost.actions &&
        createPortal(
          <>
            {(active || snapshot.status !== 'completed' || lost) && (
              <span role="status" className={styles.state}>
                {active ? (
                  <CircleNotch size={16} className="mw-spin" />
                ) : snapshot.status === 'failed' || lost ? (
                  <WarningCircle size={16} />
                ) : (
                  <Stop size={16} />
                )}
                {lost ? tConnector('executionStateLost') : labels(locale)[snapshot.status]}
              </span>
            )}
            {active && (
              <>
                <span className={styles.count}>
                  {snapshot.completedCount} / {snapshot.statements.length}
                </span>
                <Elapsed execution={snapshot} active={active} />
              </>
            )}
            <div ref={setHeaderTarget} className={styles.headerTools} />
            {active && (
              <Button
                variant="ghost"
                size="sm"
                data-variant="destructive"
                className={styles.cancel}
                loading={snapshot.status === 'cancelling' && !execution.connectionError}
                aria-label={tConnector('cancelQuery')}
                onClick={onCancel}
              >
                <Stop size={16} weight="fill" />
                {tConnector('cancelQuery')}
              </Button>
            )}
          </>,
          headerHost.actions,
        )}
      {active && (
        <div
          className={styles.progress}
          role="progressbar"
          aria-label={tConnector('sqlExecutionProgress')}
          aria-valuemin={0}
          aria-valuemax={snapshot.statements.length}
          aria-valuenow={snapshot.completedCount}
        >
          <i
            style={{ width: `${(snapshot.completedCount / snapshot.statements.length) * 100}%` }}
          />
        </div>
      )}
      {execution.connectionError && (
        <p className={styles.connectionError} role="alert">
          {execution.connectionError}
          {active && (
            <button type="button" onClick={onCancel}>
              {tConnector('retryCancellation')}
            </button>
          )}
        </p>
      )}
      {!openStatements.length && (
        <div className="mw-result-state">
          <Table size={26} />
          <strong>{tConnector('thisResultWasClosed')}</strong>
          <span>{tConnector('runTheQueryAgainToViewTheResult')}</span>
        </div>
      )}
      {openStatements.length > 0 && statement && (
        <div
          className={styles.body}
          role="tabpanel"
          id={`sql-result-panel-${snapshot.id}`}
          aria-labelledby={`sql-result-${snapshot.id}-${selected}`}
        >
          {statement.result || view === 'summary' ? (
            <>
              {statement.result?.messages
                .filter((message) => message.severity === 'warning')
                .map((message, index) => (
                  <p key={index} className={styles.connectionError} role="alert">
                    {message.message}
                  </p>
                ))}
              <SqlQueryResult
                key={`${snapshot.id}:${selected}`}
                scopeKey={`${snapshot.id}:${selected}`}
                layoutScopeKey={layoutScopeKey ? `${layoutScopeKey}:${selected}` : undefined}
                provider={provider}
                result={statement.result}
                executionSummary={snapshot}
                executionLost={lost}
                view={view}
                onViewChange={onViewChange}
                headerTarget={headerTarget}
                queryContext={{ base, sql: statement.sql, schema: snapshot.schema }}
                active={headerHost.active}
                onExplainTarget={onExplainTarget}
                onRefresh={onRefresh}
                autoRefresh={autoRefresh}
                onAutoRefresh={onAutoRefresh}
              />
            </>
          ) : statement.error ? (
            <div className={styles.failure} role="alert">
              <div>
                <WarningCircle size={19} />
                <strong>
                  {tConnector('statement')}
                  {selected + 1}
                  {tConnector('executionFailed')}
                </strong>
                {statement.error.code && <code>{statement.error.code}</code>}
              </div>
              <p>{statement.error.message}</p>
              {statement.error.detail && <p>{statement.error.detail}</p>}
              {statement.error.hint && <small>{statement.error.hint}</small>}
              <button type="button" onClick={() => onReveal(statement)}>
                {tConnector('goToSql')}
              </button>
              <details>
                <summary>{tConnector('viewSqlForThisExecution')}</summary>
                <pre>{statement.sql}</pre>
              </details>
              <span>
                {tConnector(
                  'previouslyCompletedResultsRemainAvailableSubsequentStatementsWereNotEx',
                )}
              </span>
            </div>
          ) : (
            <div className="mw-result-state">
              {lost ? (
                <WarningCircle size={26} />
              ) : statement.status === 'running' ? (
                <CircleNotch size={26} className="mw-spin" />
              ) : statement.status === 'cancelled' ? (
                <X size={26} />
              ) : (
                <SkipForward size={26} />
              )}
              <strong>
                {lost
                  ? tConnector('unableToConfirmThisStatementSResult')
                  : statement.status === 'running'
                    ? tConnector('executingThisStatement')
                    : statement.status === 'cancelled'
                      ? tConnector('thisStatementWasCancelled')
                      : statement.status === 'skipped'
                        ? tConnector('thisStatementWasNotExecuted')
                        : tConnector('waitingForPrecedingStatementsToFinish')}
              </strong>
              <span>
                {statement.status === 'cancelled' || statement.status === 'skipped'
                  ? tConnector('yourEditsAndCompletedResultsWereKeptYouCanRun')
                  : tConnector('viewCompletedResultsOrSwitchToAnotherQueryTab')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
