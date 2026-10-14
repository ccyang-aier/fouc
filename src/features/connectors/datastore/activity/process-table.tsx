'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './process-table.messages';
import { useMemo, useState } from 'react';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type {
  DatabaseActivityProcess,
  DatabaseActivitySnapshot,
} from '@fouc/shared/database-activity';
import styles from './activity.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type SortKey = 'id' | 'user' | 'database' | 'state' | 'ageSeconds';
function compareValues(a: string | null, b: string | null, numeric: boolean): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (numeric && /^-?\d+$/.test(a) && /^-?\d+$/.test(b)) return BigInt(a) < BigInt(b) ? -1 : 1;
  return a.localeCompare(b);
}
export function ActivityProcesses({ snapshot }: { snapshot: DatabaseActivitySnapshot }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{
    key: SortKey;
    desc: boolean;
  }>({ key: 'ageSeconds', desc: true });
  const [selected, setSelected] = useState<DatabaseActivityProcess | null>(null);
  const [copyMessageStored, setCopyMessage] = useState<UiMessage>('');
  const copyMessage = uiText(copyMessageStored, locale);
  const rows = useMemo(() => {
    const needle = search.toLocaleLowerCase();
    const filtered = snapshot.processes.filter(
      (row) =>
        !needle ||
        [
          row.id,
          row.user,
          row.database,
          row.client,
          row.application,
          row.backendType,
          row.command,
          row.state,
          row.wait,
          row.query,
        ].some((value) => value?.toLocaleLowerCase().includes(needle)),
    );
    return filtered.sort((a, b) => {
      if (a[sort.key] === null || b[sort.key] === null)
        return compareValues(a[sort.key], b[sort.key], false);
      return (
        compareValues(a[sort.key], b[sort.key], sort.key === 'id' || sort.key === 'ageSeconds') *
        (sort.desc ? -1 : 1)
      );
    });
  }, [snapshot.processes, search, sort]);
  function order(key: SortKey) {
    setSort((current) => ({
      key,
      desc: current.key === key ? !current.desc : key === 'ageSeconds',
    }));
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(selected?.query ?? '');
      setCopyMessage(connectorUiMessages.message('copiedTheSqlTextFromTheCurrentSnapshot'));
    } catch (reason) {
      setCopyMessage(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('copyFailedSelectTheTextAndCopyItManually'),
      );
    }
  }
  if (!snapshot.processesSupported)
    return (
      <div className={styles.unsupported}>
        <strong>{tConnector('sqliteDoesNotProvideAServerSessionDirectory')}</strong>
        <p>{tConnector('fileAndConnectionDetailsComeFromRealPragmaResultsNo')}</p>
      </div>
    );
  return (
    <section className={styles.processSection} aria-label={tConnector('nativeActiveSessions')}>
      <div className={styles.sectionHead}>
        <div>
          <h3>{tConnector('activeSessions')}</h3>
          <p>
            {snapshot.sources.processes} · {snapshot.processes.length}
            {snapshot.processesTruncated ? '+' : ''}
            {tConnector('visibleRecords')}
          </p>
        </div>
        <input
          aria-label={tConnector('filterActiveSessions')}
          placeholder={tConnector('filterUserDatabaseStatusOrSql')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {snapshot.processesTruncated && (
        <p className={styles.notice}>
          {tConnector('theRowSamplingLimitHasBeenReachedTheRecordCount')}
        </p>
      )}
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              {(
                [
                  ['id', tConnector('sessionId')],
                  ['user', tConnector('user')],
                  ['database', tConnector('database')],
                  ['state', tConnector('status')],
                  ['ageSeconds', tConnector('ageSeconds')],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                >
                  <button type="button" onClick={() => order(key)}>
                    {label}
                    {sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
              <th>{tConnector('clientWait')}</th>
              <th>{tConnector('sqlInformation')}</th>
              <th>{tConnector('details')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.id ?? 'unknown'}:${index}`}
                data-own={row.own}
                data-masked={row.masked}
              >
                <td>
                  {row.id ?? tConnector('unknown')}
                  {row.own && (
                    <span className={styles.own}>{tConnector('samplingConnection')}</span>
                  )}
                </td>
                <td>{row.user ?? tConnector('unknown')}</td>
                <td>{row.database ?? '—'}</td>
                <td>
                  <span
                    className={styles.state}
                    data-active={row.state === 'active' || row.command === 'Query'}
                  >
                    {row.state ?? row.command ?? row.backendType ?? tConnector('unknown')}
                    {row.masked ? tConnector('hiddenByPermissions') : ''}
                  </span>
                </td>
                <td>{row.ageSeconds ?? tConnector('unknown')}</td>
                <td title={row.wait ?? undefined}>
                  {row.client ?? '—'}
                  <small>{row.wait ?? row.application ?? ''}</small>
                </td>
                <td className={styles.sqlCell}>
                  <span title={row.query?.slice(0, 512)}>
                    {row.query ?? tConnector('notProvided')}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.detailButton}
                    aria-label={tConnector('viewDetailsForSession', {
                      p0: String(row.id ?? index),
                    })}
                    onClick={() => {
                      setSelected({ ...row });
                      setCopyMessage('');
                    }}
                  >
                    {tConnector('view')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className={styles.empty}>
            {tConnector('noSessionsMatchTheCurrentSampleNativePermissionsOrFilters')}
          </div>
        )}
      </div>
      {selected && (
        <aside className={styles.detail} aria-label={tConnector('activeSessionSnapshotDetails')}>
          <header>
            <div>
              <h3>
                {tConnector('session')}
                {selected.id ?? tConnector('unknown')}
              </h3>
              <p>{tConnector('frozenSnapshotLaterRefreshesDoNotReplaceTheseDetails')}</p>
            </div>
            <button
              type="button"
              aria-label={tConnector('closeActiveSessionDetails')}
              onClick={() => setSelected(null)}
            >
              <X size={16} />
            </button>
          </header>
          <dl>
            {[
              [tConnector('user'), selected.user],
              [tConnector('database'), selected.database],
              [tConnector('client'), selected.client],
              [tConnector('application'), selected.application],
              [tConnector('nativeBackendType'), selected.backendType],
              [tConnector('command'), selected.command],
              [tConnector('status'), selected.state],
              [tConnector('waitEvent'), selected.wait],
              [tConnector('ageSeconds'), selected.ageSeconds],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? tConnector('unknown')}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.detailSqlHead}>
            <strong>{tConnector('sqlNativeInformation')}</strong>
            <button
              type="button"
              disabled={!selected.query || selected.masked}
              onClick={() => void copy()}
            >
              <Copy size={13} />
              {tConnector('copySql')}
            </button>
          </div>
          <pre tabIndex={0}>
            {selected.query ?? tConnector('theCurrentAccountCannotReadTheSqlText')}
          </pre>
          {(selected.queryTruncated || snapshot.provider === 'postgres') && (
            <p className={styles.notice}>
              {tConnector('thisTextIsLimitedToClientCharactersAndTheDatabase')}
            </p>
          )}
          {copyMessage && (
            <p role="status" className={styles.copyMessage}>
              {copyMessage}
            </p>
          )}
        </aside>
      )}
    </section>
  );
}
