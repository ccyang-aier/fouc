'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-result-summary.messages';
import { Check, CircleNotch, Clock, Minus, Stop, WarningCircle } from '@phosphor-icons/react';
import type {
  DatabaseQueryResult,
  SqlExecutionSnapshot,
  SqlStatementExecution,
} from '@fouc/shared';
import styles from './sql-result-summary.module.css';
const executionLabels = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    running: tConnector('executing'),
    cancelling: tConnector('stopping'),
    completed: tConnector('executionComplete'),
    failed: tConnector('executionInterrupted'),
    cancelled: tConnector('cancelled'),
  };
};
const statusLabels = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    pending: tConnector('waitingToExecute'),
    running: tConnector('executing3177'),
    succeeded: tConnector('succeeded'),
    failed: tConnector('failed'),
    cancelled: tConnector('cancelled'),
    skipped: tConnector('notExecuted'),
  };
};
type SummaryStatement = Pick<
  SqlStatementExecution,
  'sql' | 'status' | 'result' | 'error' | 'startedAt' | 'finishedAt'
>;
export function SqlResultSummary({
  execution,
  result,
  sql,
  lost = false,
}: {
  execution?: SqlExecutionSnapshot;
  result: DatabaseQueryResult | null;
  sql?: string;
  lost?: boolean;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const statements: SummaryStatement[] =
    execution?.statements ??
    (result
      ? [
          {
            sql: sql ?? '',
            status: 'succeeded',
            result,
            error: null,
            startedAt: null,
            finishedAt: null,
          },
        ]
      : []);
  const completed = execution?.completedCount ?? statements.length,
    total = statements.length,
    percentage = total ? Math.round((completed / total) * 100) : 0;
  return (
    <section className={styles.summary} aria-label={tConnector('sqlExecutionSummary')}>
      <div className={styles.sheet}>
        <div className={styles.progress}>
          <div className={styles.caption}>
            <span>
              {lost
                ? tConnector('executionStateLost')
                : executionLabels(locale)[execution?.status ?? 'completed']}
            </span>
            <span>
              {completed} / {total}
            </span>
            <span>{percentage}%</span>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label={tConnector('statementExecutionCompletionRatio')}
            aria-valuemin={0}
            aria-valuemax={total || 1}
            aria-valuenow={completed}
          >
            <i style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <div className={styles.scroll}>
          <table>
            <colgroup>
              <col className={styles.number} />
              <col />
              <col className={styles.statusColumn} />
              <col className={styles.metric} />
              <col className={styles.metric} />
            </colgroup>
            <thead>
              <tr>
                <th>{tConnector('statement')}</th>
                <th>SQL</th>
                <th>{tConnector('status')}</th>
                <th>{tConnector('returnedRows')}</th>
                <th>{tConnector('duration')}</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((statement, index) => {
                const duration =
                  statement.result?.executionTimeMs ??
                  (statement.startedAt !== null && statement.finishedAt !== null
                    ? Math.max(0, statement.finishedAt - statement.startedAt)
                    : null);
                const status = statement.status,
                  Icon =
                    status === 'succeeded'
                      ? Check
                      : status === 'failed'
                        ? WarningCircle
                        : status === 'running'
                          ? CircleNotch
                          : status === 'cancelled'
                            ? Stop
                            : status === 'pending'
                              ? Clock
                              : Minus;
                return (
                  <tr key={index}>
                    <th>#{index + 1}</th>
                    <td>
                      <code title={statement.sql}>{statement.sql || '—'}</code>
                      {statement.error && <p className={styles.error}>{statement.error.message}</p>}
                    </td>
                    <td>
                      <span className={styles.status} data-status={status}>
                        <Icon
                          size={14}
                          className={status === 'running' && !lost ? 'mw-spin' : undefined}
                        />
                        {status === 'running' && lost
                          ? tConnector('unknownStatus')
                          : statusLabels(locale)[status]}
                      </span>
                    </td>
                    <td
                      title={
                        statement.result?.truncated || statement.result?.hasMore
                          ? tConnector('includesOnlyRowsReturnedInThisExecution')
                          : undefined
                      }
                    >
                      {statement.result ? statement.result.rows.length.toLocaleString(locale) : '—'}
                    </td>
                    <td>{duration !== null ? `${duration}ms` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
