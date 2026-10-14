'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-history-panel.messages';
import { useState } from 'react';
import {
  Copy,
  ArrowCounterClockwise,
  BookmarkSimple,
  Trash,
  X,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import type { SqlHistoryEntry, SqlHistorySearch } from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { useSqlResource, useSqlHistory } from './use-sql-resource';
import { SqlDialog } from './sql-library-dialog';
import common from './relational.module.css';
import styles from './sql-library.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export function SqlHistoryPanel({
  base,
  revision,
  canSave,
  onClose,
  onRestore,
  onSave,
}: {
  base: string;
  revision: number;
  canSave: boolean;
  onClose: () => void;
  onRestore: (entry: SqlHistoryEntry) => void;
  onSave: (entry: SqlHistoryEntry) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [search, setSearch] = useState(''),
    [success, setSuccess] = useState('all'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState('');
  const [schema, setSchema] = useState(''),
    [filter, setFilter] = useState({ search: '', success: 'all', start: '', end: '', schema: '' });
  const [cursor, setCursor] = useState<{
      generation: number;
      value: SqlHistorySearch['cursor'];
    } | null>(null),
    [localRevision, setLocalRevision] = useState(0);
  const [selection, setSelection] = useState<string | null>(null),
    [actionBusy, setActionBusy] = useState(false),
    [errorStored, setError] = useState<UiMessage>(''),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const notice = uiText(noticeStored, locale);
  const [confirmation, setConfirmation] = useState<'clear' | string | null>(null);
  const generation = revision + localRevision;
  const request = {
    search: filter.search,
    success: filter.success === 'all' ? null : filter.success === 'true',
    schema: filter.schema || null,
    startedAt: filter.start ? new Date(`${filter.start}T00:00:00`).getTime() : null,
    endedAt: filter.end ? new Date(`${filter.end}T23:59:59.999`).getTime() : null,
    cursor: cursor?.generation === generation ? cursor.value : null,
    limit: 50,
  };
  const history = useSqlHistory(`${base}/search`, request, generation),
    pages = history.data;
  const detail = useSqlResource<SqlHistoryEntry>(
    selection ? `${base}/${selection}` : null,
    undefined,
    localRevision,
  );
  function refresh() {
    setCursor(null);
    setLocalRevision((value) => value + 1);
  }
  async function copy(sql: string) {
    try {
      await navigator.clipboard.writeText(sql);
      setNotice(connectorUiMessages.message('fullSqlCopied'));
    } catch {
      setError(connectorUiMessages.message('copyFailedSelectTheContentInDetailsToCopyIt'));
    }
  }
  async function remove() {
    if (!confirmation) return;
    setActionBusy(true);
    setError('');
    try {
      await backendFetch(`${base}${confirmation === 'clear' ? '' : `/${confirmation}`}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmed: true }),
      });
      setSelection(null);
      setConfirmation(null);
      refresh();
      setNotice(
        confirmation === 'clear'
          ? connectorUiMessages.message('historyClearedForThisConnection')
          : connectorUiMessages.message('historyRecordDeleted'),
      );
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setActionBusy(false);
    }
  }
  return (
    <aside className={styles.panel} aria-label={tConnector('sqlQueryHistory')}>
      <header>
        <div>
          <strong>{tConnector('queryHistory')}</strong>
          <small>
            {pages?.persistent
              ? tConnector('currentConnectionSavedOnDevice')
              : tConnector('temporarySessionNotKeptAfterDisconnecting')}
            {tConnector('latest')}
            {pages?.limit ?? 1000}
            {tConnector('records')}
          </small>
        </div>
        <button
          type="button"
          aria-label={tConnector('refreshSqlHistory')}
          disabled={history.busy || actionBusy}
          onClick={refresh}
        >
          <ArrowsClockwise size={16} />
        </button>
        <button
          type="button"
          aria-label={tConnector('clearSqlHistory')}
          disabled={!pages?.total || actionBusy}
          onClick={() => setConfirmation('clear')}
        >
          <Trash size={16} />
        </button>
        <button type="button" aria-label={tConnector('closeSqlHistory')} onClick={onClose}>
          <X size={17} />
        </button>
      </header>
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          if (start && end && start > end) {
            setError(connectorUiMessages.message('startDateMustNotBeAfterTheEndDate'));
            return;
          }
          setError('');
          setCursor(null);
          setSelection(null);
          setFilter({ search, success, start, end, schema });
        }}
      >
        <input
          aria-label={tConnector('searchSqlHistory')}
          placeholder={tConnector('searchSqlTargetsOrErrors')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label={tConnector('historicalExecutionStatus')}
          value={success}
          onChange={(event) => setSuccess(event.target.value)}
        >
          <option value="all">{tConnector('allStatuses')}</option>
          <option value="true">{tConnector('succeeded')}</option>
          <option value="false">{tConnector('failed')}</option>
        </select>
        <input
          aria-label={tConnector('historicalSchema')}
          placeholder={tConnector('allSchemas')}
          value={schema}
          onChange={(event) => setSchema(event.target.value)}
        />
        <label>
          {tConnector('from')}
          <input
            aria-label={tConnector('historyStartDate')}
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          {tConnector('to')}
          <input
            aria-label={tConnector('historyEndDate')}
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <button type="submit" disabled={history.busy}>
          {tConnector('filter')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setSuccess('all');
            setStart('');
            setEnd('');
            setSchema('');
            setCursor(null);
            setFilter({ search: '', success: 'all', start: '', end: '', schema: '' });
            setSelection(null);
            setError('');
          }}
        >
          {tConnector('reset')}
        </button>
      </form>
      {(error || history.error) && (
        <p role="alert" className={styles.error}>
          {error || history.error}
          <button type="button" onClick={refresh}>
            {tConnector('retry')}
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {history.busy && (
        <p role="status" className={styles.notice}>
          {tConnector('readingHistory')}
        </p>
      )}
      <div className={styles.list} aria-label={tConnector('sqlHistoryList')}>
        {pages?.entries.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-pressed={selection === entry.id}
            disabled={history.busy || actionBusy}
            onClick={() => {
              setSelection(entry.id);
              setNotice('');
            }}
          >
            <div>
              <span className={entry.success ? styles.success : styles.failure}>
                {entry.success ? tConnector('succeeded') : tConnector('failed')}
              </span>
              <small>
                {new Date(entry.executedAt).toLocaleString(locale)} · {entry.executionTimeMs} ms
              </small>
            </div>
            <code>{entry.sqlPreview}</code>
            <small>
              {entry.database}
              {entry.schema && entry.schema !== entry.database ? ` / ${entry.schema}` : ''} ·{' '}
              {entry.rowCount}
              {tConnector('row')}
              {entry.truncated && tConnector('moreResultRowsAvailable')}
            </small>
          </button>
        ))}
        {!history.busy && !pages?.entries.length && !history.error && (
          <p className={styles.empty}>{tConnector('noHistoryRecordsMatchYourFilters')}</p>
        )}
      </div>
      <footer>
        <span>
          {pages?.total ?? 0}
          {tConnector('recordsLoaded')}
          {pages?.entries.length ?? 0}
          {history.error && tConnector('lastReadResults')}
        </span>
        <button
          type="button"
          disabled={history.busy || Boolean(history.error) || !pages?.nextCursor}
          onClick={() => setCursor({ generation, value: pages?.nextCursor ?? null })}
        >
          {tConnector('loadMore')}
        </button>
      </footer>
      {selection && (
        <section className={styles.detail} aria-label={tConnector('sqlHistoryDetails')}>
          <header>
            <strong>
              {tConnector('fullSql')}
              {detail.data?.connectionName}
            </strong>
            <button
              type="button"
              aria-label={tConnector('closeSqlHistoryDetails')}
              onClick={() => setSelection(null)}
            >
              <X size={15} />
            </button>
          </header>
          {detail.busy ? (
            <p role="status">{tConnector('readingFullSql')}</p>
          ) : detail.error ? (
            <p role="alert" className={styles.error}>
              {detail.error}
            </p>
          ) : (
            detail.data && (
              <>
                <small>
                  {detail.data.database}
                  {detail.data.schema && detail.data.schema !== detail.data.database
                    ? ` / ${detail.data.schema}`
                    : ''}{' '}
                  · {detail.data.executionTimeMs} ms
                </small>
                <pre tabIndex={0}>{detail.data.sql}</pre>
                {detail.data.error && (
                  <p role="alert" className={styles.error}>
                    {detail.data.error}
                  </p>
                )}
                <footer>
                  <button type="button" onClick={() => void copy(detail.data!.sql)}>
                    <Copy size={13} />
                    {tConnector('copy')}
                  </button>
                  <button
                    type="button"
                    disabled={!canSave}
                    title={!canSave ? tConnector('saveTheConnectionToBookmarkSql') : undefined}
                    onClick={() => onSave(detail.data!)}
                  >
                    <BookmarkSimple size={13} />
                    {tConnector('saveSql')}
                  </button>
                  <button type="button" onClick={() => onRestore(detail.data!)}>
                    <ArrowCounterClockwise size={13} />
                    {tConnector('restoreEdits')}
                  </button>
                  <button type="button" onClick={() => setConfirmation(selection)}>
                    <Trash size={13} />
                    {tConnector('delete')}
                  </button>
                </footer>
              </>
            )
          )}
        </section>
      )}
      {confirmation && (
        <SqlDialog
          title={tConnector('confirmSqlHistoryDeletion')}
          role="alertdialog"
          busy={actionBusy}
          onClose={() => setConfirmation(null)}
        >
          <div className={common.formBody}>
            <p>
              {confirmation === 'clear'
                ? tConnector('clearQueryHistoryForAllDatabasesAndSchemasInThis')
                : tConnector('deleteThisQueryHistoryRecord')}
              {tConnector('thisActionDoesNotChangeTheDataSource')}
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
          </div>
          <footer className={common.dialogFooter}>
            <button
              type="button"
              className={common.secondary}
              disabled={actionBusy}
              onClick={() => setConfirmation(null)}
            >
              {tConnector('cancel')}
            </button>
            <span />
            <button
              type="button"
              className={common.primary}
              disabled={actionBusy}
              onClick={() => void remove()}
            >
              {tConnector('confirmHistoryDeletion')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </aside>
  );
}
