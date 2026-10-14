'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './event-details.messages';
import { useState } from 'react';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type { MySqlEventDetails } from '@fouc/shared/database-admin-objects';
import { AdminObjectSource } from './source';
import styles from './admin-objects.module.css';
const propertyLabels = (locale?: Locale): Record<string, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    sql_mode: 'SQL Mode',
    character_set_client: tConnector('clientCharacterSet'),
    collation_connection: tConnector('connectionCollation'),
    database_collation: tConnector('databaseCollation'),
  };
};
export function MySqlEventDetailsView({ details }: { details: MySqlEventDetails }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [tab, setTab] = useState<'overview' | 'body' | 'source'>('overview');
  const recurring = details.eventType === 'RECURRING';
  const schedule = recurring
    ? details.intervalValue === null || details.intervalUnit === null
      ? tConnector('unknown')
      : `EVERY ${details.intervalValue} ${details.intervalUnit}`
    : details.executeAt === null
      ? tConnector('unknown')
      : `AT ${details.executeAt}`;
  const properties: Array<[string, string | null]> = [
    [tConnector('definer'), details.definer],
    [tConnector('eventTimeZone'), details.timeZone],
    [tConnector('createdSessionTimeZone'), details.createdAt],
    [tConnector('modifiedSessionTimeZone'), details.updatedAt],
    [tConnector('lastExecutedEventTimeZone'), details.lastExecuted],
    [tConnector('completionPolicy'), details.completion],
    ...Object.entries(details.properties).map(
      ([key, value]) => [propertyLabels(locale)[key] ?? key, value] as [string, string | null],
    ),
  ];
  return (
    <>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.kind}>{tConnector('mysqlEvent')}</span>
          <h3>{details.name}</h3>
          <code>{details.schema}</code>
        </div>
        <span
          className={styles.status}
          data-tone={details.status === 'ENABLED' ? 'success' : 'neutral'}
        >
          {details.status ?? tConnector('unknownStatus')}
        </span>
      </header>
      <nav className={styles.detailTabs} aria-label={tConnector('eventDetailType')}>
        {(
          [
            ['overview', tConnector('scheduleAndProperties')],
            ['body', tConnector('executionBody')],
            ['source', tConnector('nativeDdl')],
          ] as const
        ).map(([key, label]) => (
          <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      <div className={styles.detailContent}>
        {tab === 'overview' && (
          <>
            <section className={styles.schedule}>
              <div>
                <Clock size={17} />
                <strong>{details.eventType ?? tConnector('unknownScheduleType')}</strong>
                <small>{details.timeZone ?? tConnector('unknownTimeZone')}</small>
              </div>
              <code>{schedule}</code>
              {recurring && (
                <dl>
                  <div>
                    <dt>{tConnector('startEventTimeZone')}</dt>
                    <dd>{details.starts ?? tConnector('notSpecified')}</dd>
                  </div>
                  <div>
                    <dt>{tConnector('endEventTimeZone')}</dt>
                    <dd>{details.ends ?? tConnector('notSpecified')}</dd>
                  </div>
                </dl>
              )}
            </section>
            <div className={styles.scheduler}>
              <strong>{tConnector('serverScheduler')}</strong>
              <span
                className={styles.status}
                data-tone={details.scheduler.status === 'ON' ? 'success' : 'neutral'}
              >
                {details.scheduler.status ?? tConnector('unknown')}
              </span>
              <small>
                {tConnector('sessionTimeZone')}
                {details.scheduler.sessionTimeZone ?? tConnector('unknown')}
                {tConnector('systemTimeZone')}
                {details.scheduler.systemTimeZone ?? tConnector('unknown')}
              </small>
            </div>
            {details.scheduler.error && (
              <p className={styles.warning}>
                <Warning size={14} />
                {tConnector('cannotReadSchedulerStatus')}
                {details.scheduler.error}
              </p>
            )}
            {details.comment && <p className={styles.comment}>{details.comment}</p>}
            <dl className={styles.properties}>
              {properties.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd data-unknown={value === null}>{value ?? tConnector('unknownNotProvided')}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {tab === 'body' && (
          <AdminObjectSource
            key="body"
            source={details.body}
            name={`${details.schema}.${details.name}.body`}
            label={tConnector('eventBodySql')}
            provider="mysql"
          />
        )}
        {tab === 'source' && (
          <AdminObjectSource
            key="source"
            source={details.source}
            name={`${details.schema}.${details.name}`}
            label={tConnector('nativeEventDdl')}
            provider="mysql"
          />
        )}
        <div className={styles.notices}>
          {details.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      </div>
    </>
  );
}
