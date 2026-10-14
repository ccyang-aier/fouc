'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useState } from 'react';
import { Pulse } from '@phosphor-icons/react/dist/csr/Pulse';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import type { RelationalProvider } from '@fouc/shared';
import {
  databaseActivityMetrics,
  formatDatabaseActivityMetric,
} from '@fouc/shared/database-activity';
import { ActivityProcesses } from './process-table';
import { ActivityTrend } from './trend';
import { useDatabaseActivity } from './use-activity';
import styles from './activity.module.css';
export function DatabaseActivityPanel(props: {
  base: string;
  provider: RelationalProvider;
  database: string;
  blocked: boolean;
}) {
  return <ActivityPanel key={props.base} {...props} />;
}
function ActivityPanel({
  base,
  provider,
  database,
  blocked,
}: {
  base: string;
  provider: RelationalProvider;
  database: string;
  blocked: boolean;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const activity = useDatabaseActivity(base, blocked);
  const [statusSearch, setStatusSearch] = useState('');
  const latest = activity.latest;
  const previous = activity.samples.at(-2);
  const metrics = latest ? databaseActivityMetrics(latest, previous) : [];
  return (
    <section
      className={styles.panel}
      aria-label={tConnector('databaseActivityMonitor')}
      aria-busy={activity.busy}
    >
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <span>
            <Pulse size={18} />
          </span>
          <div>
            <h2>
              {provider === 'sqlite'
                ? tConnector('fileAndConnectionOverview')
                : tConnector('instanceDashboard')}
            </h2>
            <p>
              {provider.toUpperCase()} · {database || tConnector('currentConnection')}
              {tConnector('readOnlySampling')}
            </p>
          </div>
        </div>
        <div className={styles.controls}>
          <label>
            {tConnector('refreshInterval')}
            <select
              aria-label={tConnector('monitorRefreshInterval')}
              value={activity.interval}
              onChange={(event) => activity.setIntervalSeconds(Number(event.target.value))}
            >
              {[5, 10, 30, 60].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds}
                  {tConnector('seconds')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.secondary}
            aria-label={
              activity.paused
                ? tConnector('resumeAutomaticMonitoring')
                : tConnector('pauseAutomaticMonitoring')
            }
            onClick={() => activity.pause(!activity.paused)}
          >
            {activity.paused ? <Play size={13} /> : <Pause size={13} />}
            <span>{activity.paused ? tConnector('resume') : tConnector('pause')}</span>
          </button>
          <button
            type="button"
            className={styles.secondary}
            aria-label={tConnector('refreshMonitorSnapshot')}
            disabled={activity.busy || blocked}
            onClick={() => void activity.refresh()}
          >
            {activity.busy ? (
              <SpinnerGap size={13} className={styles.spinner} />
            ) : (
              <ArrowClockwise size={13} />
            )}
            <span>{tConnector('refresh')}</span>
          </button>
        </div>
      </header>
      <div className={styles.meta}>
        <span className={styles.live} data-paused={activity.paused || blocked} />
        <span>
          {blocked
            ? tConnector('automaticSamplingIsDeferredWhileTheSessionHasPendingChanges')
            : activity.paused
              ? tConnector('pausedLastSnapshotRetained')
              : tConnector('sampleEverySecondsDeferredWhileThePageIsHidden', {
                  p0: String(activity.interval),
                })}
        </span>
        <span>
          {latest
            ? tConnector('msSamples', {
                p0: String(new Date(latest.capturedAt).toLocaleTimeString(locale)),
                p1: String(latest.durationMs),
                p2: String(activity.samples.length),
              })
            : tConnector('waitingForNativeSamples')}
        </span>
      </div>
      <div className={styles.content}>
        {activity.error && (
          <div className={styles.error} role="alert">
            {activity.error}
            <button
              type="button"
              disabled={activity.busy || blocked}
              onClick={() => void activity.refresh()}
            >
              {tConnector('retry')}
            </button>
          </div>
        )}
        {latest?.issues.map((issue) => (
          <div className={styles.error} role="alert" key={issue.section}>
            <strong>
              {issue.section === 'status'
                ? tConnector('couldNotReadMetrics')
                : issue.section === 'settings'
                  ? tConnector('couldNotReadSettings')
                  : tConnector('couldNotReadTheSessionDirectory')}
            </strong>
            <span>
              {issue.message}
              {issue.code ? ` (${issue.code})` : ''}
            </span>
            <small>
              {tConnector('thisSectionRemainsUnknownOtherSuccessfullyLoadedSectionsAreStill')}
            </small>
          </div>
        ))}
        {!latest && !activity.error && (
          <div className={styles.empty} role="status">
            {tConnector('readingNativeDatabaseStatusAndCatalog')}
          </div>
        )}
        {latest && (
          <>
            <div className={styles.metrics}>
              {metrics.map((metric) => (
                <article
                  key={metric.id}
                  className={styles.metric}
                  title={`${metric.source}${metric.counter === null ? '' : tConnector('rawCumulativeValue') + metric.counter}`}
                >
                  <span>{metric.label}</span>
                  <strong>{formatDatabaseActivityMetric(metric)}</strong>
                  <small>
                    {metric.value === null
                      ? tConnector('unknownWaitingForAValidSample')
                      : metric.unit === 'count'
                        ? tConnector('nativeCount')
                        : metric.unit === '%'
                          ? tConnector('cumulativeCountRatio')
                          : metric.unit === 's'
                            ? tConnector('secondsDuration')
                            : metric.unit}
                  </small>
                </article>
              ))}
            </div>
            <div className={styles.scope}>
              <strong>
                {latest.metricScope === 'file'
                  ? tConnector('currentSqliteFile')
                  : tConnector('instanceScopeNativelyVisibleToTheCurrentAccount')}
              </strong>
              <span>
                {latest.sources.status}
                {tConnector('sectionsAreReadSequentiallySoSnapshotValuesMayNotRepresent')}
              </span>
            </div>
            {provider !== 'sqlite' && (
              <div className={styles.charts}>
                <ActivityTrend
                  samples={activity.samples}
                  metricId="throughput"
                  label={
                    provider === 'mysql'
                      ? tConnector('queryThroughputQps')
                      : tConnector('transactionThroughputTps')
                  }
                />
                <ActivityTrend
                  samples={activity.samples}
                  metricId={provider === 'mysql' ? 'sent' : 'inserts'}
                  label={
                    provider === 'mysql'
                      ? tConnector('outboundTrafficBS')
                      : tConnector('insertedRowsS')
                  }
                />
              </div>
            )}
            <ActivityProcesses snapshot={latest} />
            <details className={styles.raw}>
              <summary>{tConnector('rawStatusAndSettingsOriginalDatabaseValuesPreserved')}</summary>
              <div className={styles.rawHead}>
                <span>
                  {tConnector('fieldsWithoutValuesRemainUnknownVersion')}
                  {latest.settings.version ?? tConnector('unknown')}
                  {tConnector('maximumConnections')}
                  {latest.settings.max_connections ?? tConnector('unknown')}
                </span>
                <input
                  aria-label={tConnector('filterRawMonitorStatus')}
                  value={statusSearch}
                  placeholder={tConnector('filterMetricNamesOrRawValues')}
                  onChange={(event) => setStatusSearch(event.target.value)}
                />
              </div>
              <div className={styles.rawTable}>
                <table>
                  <thead>
                    <tr>
                      <th>{tConnector('sectionSource')}</th>
                      <th>{tConnector('field')}</th>
                      <th>{tConnector('rawValue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['counters', 'settings'] as const).flatMap((group) =>
                      Object.entries(latest[group])
                        .sort(([a], [b]) => a.localeCompare(b))
                        .filter(
                          ([name, value]) =>
                            !statusSearch ||
                            `${name} ${value ?? ''}`
                              .toLocaleLowerCase()
                              .includes(statusSearch.toLocaleLowerCase()),
                        )
                        .map(([name, value]) => (
                          <tr key={`${group}:${name}`}>
                            <td>
                              {group === 'counters'
                                ? tConnector('nativeStatus')
                                : tConnector('nativeSettings')}
                            </td>
                            <td>{name}</td>
                            <td>{value ?? tConnector('unknown')}</td>
                          </tr>
                        )),
                    )}
                  </tbody>
                </table>
              </div>
            </details>
            <details className={styles.limitations}>
              <summary>{tConnector('sourcesPermissionsAndMonitoringLimits')}</summary>
              {latest.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              <p>{tConnector('samplingStopsWhenThisMonitorClosesItCannotTerminateProcesses')}</p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
