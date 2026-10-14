'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useEffect, useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Package } from '@phosphor-icons/react/dist/csr/Package';
import type { RelationalSession } from '@fouc/shared';
import {
  DATABASE_ADMIN_OBJECT_LIMITS,
  type DatabaseAdminObjectDetails,
  type DatabaseAdminObjectList,
} from '@fouc/shared/database-admin-objects';
import { useSchemaObjectResource } from '../schema-objects/resource';
import { MySqlEventDetailsView } from './event-details';
import { PostgresExtensionDetailsView } from './extension-details';
import styles from './admin-objects.module.css';
export interface DatabaseAdminObjectsPanelProps {
  base: string;
  session: RelationalSession;
  schema: string;
}
export function DatabaseAdminObjectsPanel(props: DatabaseAdminObjectsPanelProps) {
  const { t: tConnector } = useTranslation(connectorMessages);
  if (props.session.provider === 'sqlite')
    return (
      <p className={styles.empty}>
        {tConnector('sqliteHasNoMysqlEventOrPostgresqlExtensionCatalog')}
      </p>
    );
  return (
    <ObjectBrowser key={`${props.base}:${props.session.provider}:${props.schema}`} {...props} />
  );
}
function ObjectBrowser({ base, session, schema }: DatabaseAdminObjectsPanelProps) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const mysql = session.provider === 'mysql';
  const [search, setSearch] = useState('');
  const [request, setRequest] = useState<{
    search: string;
    filter: 'all' | 'installed' | 'available';
    offset: number;
  }>({ search: '', filter: 'installed', offset: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState(0),
    [detailRevision, setDetailRevision] = useState(0);
  useEffect(() => {
    if (search === request.search) return;
    const timer = setTimeout(() => {
      setRequest((current) => ({ ...current, search, offset: 0 }));
      setSelected(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, request.search]);
  const input = mysql
    ? {
        kind: 'event',
        schema,
        search: request.search,
        offset: request.offset,
        limit: DATABASE_ADMIN_OBJECT_LIMITS.page,
      }
    : {
        kind: 'extension',
        filter: request.filter,
        search: request.search,
        offset: request.offset,
        limit: DATABASE_ADMIN_OBJECT_LIMITS.page,
      };
  const list = useSchemaObjectResource<DatabaseAdminObjectList>(
    `${base}/admin-objects/list`,
    JSON.stringify(input),
    revision,
  );
  const current =
    list.data?.items.find((item) => item.id === selected) ?? list.data?.items[0] ?? null;
  const detailInput =
    current?.kind === 'event'
      ? { kind: 'event', schema: current.schema, name: current.name }
      : { kind: 'extension', name: current?.name };
  const details = useSchemaObjectResource<DatabaseAdminObjectDetails>(
    current ? `${base}/admin-objects/details` : null,
    JSON.stringify(detailInput),
    revision + detailRevision,
  );
  function nextPage(offset: number) {
    setSelected(null);
    setRequest((value) => ({ ...value, offset }));
  }
  return (
    <section
      className={styles.panel}
      aria-label={tConnector('nativeProviderSpecificObjectCatalog')}
    >
      <header className={styles.toolbar}>
        {mysql ? <Clock size={17} /> : <Package size={17} />}
        <div>
          <strong>{mysql ? tConnector('mysqlEvents') : tConnector('postgresqlExtensions')}</strong>
          <code>{mysql ? schema : session.database}</code>
        </div>
        <span className={styles.readOnly}>{tConnector('readOnlyCatalog')}</span>
        <button
          type="button"
          aria-label={tConnector('refreshProviderSpecificObjectCatalog')}
          onClick={() => setRevision((value) => value + 1)}
        >
          <ArrowsClockwise size={15} />
        </button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <label className={styles.search}>
            <MagnifyingGlass size={14} />
            <input
              aria-label={tConnector('searchProviderSpecificObjects')}
              placeholder={
                mysql
                  ? tConnector('searchEventNamesOrComments')
                  : tConnector('searchExtensionNamesOrDescriptions')
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {!mysql && (
            <div
              className={styles.filters}
              aria-label={tConnector('filterExtensionInstallationStatus')}
            >
              {(
                [
                  ['installed', tConnector('installed')],
                  ['available', tConnector('availableToInstall')],
                  ['all', tConnector('all')],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={request.filter === filter}
                  onClick={() => {
                    setSelected(null);
                    setRequest((value) => ({ ...value, filter, offset: 0 }));
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className={styles.listCaption}>
            <span>{mysql ? 'EVENTS' : 'EXTENSIONS'}</span>
            <small>
              {list.loading
                ? tConnector('reading')
                : list.data
                  ? tConnector('items', { p0: String(list.data.items.length) })
                  : '—'}
            </small>
          </div>
          <div className={styles.objectList}>
            {list.loading ? (
              <p className={styles.empty} role="status">
                {tConnector('readingNativeCatalog')}
              </p>
            ) : list.error ? (
              <div className={styles.listError}>
                <p role="alert">{list.error}</p>
                <button type="button" onClick={() => setRevision((value) => value + 1)}>
                  {tConnector('retryCatalog')}
                </button>
              </div>
            ) : list.data?.items.length ? (
              list.data.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={tConnector('view', {
                    p0: String(
                      item.kind === 'event' ? tConnector('event') : tConnector('extension'),
                    ),
                    p1: String(item.name),
                  })}
                  aria-pressed={item.id === current?.id}
                  onClick={() => setSelected(item.id)}
                >
                  {mysql ? <Clock size={14} /> : <Package size={14} />}
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {mysql
                        ? `${item.status ?? tConnector('unknownStatus')} · ${item.schedule ?? tConnector('unknownSchedule')}`
                        : item.installedVersion
                          ? tConnector('installed250', {
                              p0: String(item.installedVersion),
                              p1: String(item.schema ?? tConnector('unknownSchema')),
                            })
                          : tConnector('available', {
                              p0: String(item.defaultVersion ?? tConnector('unknownVersion')),
                            })}
                    </small>
                    {item.comment && <em title={item.comment}>{item.comment}</em>}
                  </span>
                </button>
              ))
            ) : (
              <p className={styles.empty}>
                {search
                  ? tConnector('noMatchingProviderSpecificObjects')
                  : mysql
                    ? tConnector('noEventsAreVisibleToTheCurrentRole')
                    : tConnector('noExtensionsMatchTheCurrentFilters')}
              </p>
            )}
          </div>
          <footer className={styles.listFooter}>
            <span>
              {list.data?.items.length
                ? `${request.offset + 1}–${request.offset + list.data.items.length}`
                : '—'}
            </span>
            <button
              type="button"
              aria-label={tConnector('previousProviderSpecificObjectPage')}
              disabled={list.loading || request.offset === 0}
              onClick={() =>
                nextPage(Math.max(0, request.offset - DATABASE_ADMIN_OBJECT_LIMITS.page))
              }
            >
              <CaretLeft size={13} />
            </button>
            <button
              type="button"
              aria-label={tConnector('nextProviderSpecificObjectPage')}
              disabled={list.loading || !list.data?.hasMore}
              onClick={() => nextPage(request.offset + DATABASE_ADMIN_OBJECT_LIMITS.page)}
            >
              <CaretRight size={13} />
            </button>
          </footer>
        </aside>
        <main className={styles.details}>
          {details.loading ? (
            <p className={styles.loading} role="status">
              {tConnector('readingNativeObjectDetails')}
            </p>
          ) : details.error ? (
            <div className={styles.detailError}>
              <p role="alert">{details.error}</p>
              <button type="button" onClick={() => setDetailRevision((value) => value + 1)}>
                {tConnector('retryDetails')}
              </button>
            </div>
          ) : details.data?.kind === 'event' ? (
            <MySqlEventDetailsView key={current?.id} details={details.data} />
          ) : details.data?.kind === 'extension' ? (
            <PostgresExtensionDetailsView key={current?.id} details={details.data} />
          ) : (
            <p className={styles.loading}>{tConnector('selectAnObjectToReadItsNativeDetails')}</p>
          )}
        </main>
      </div>
      <div className={styles.catalogNotice}>
        {list.data?.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </div>
    </section>
  );
}
