'use client';
import { uiText } from '../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-pagination.messages';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowsClockwise,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
  X,
} from '@phosphor-icons/react';
import type { RelationalTableCount, RelationalTablePage, RelationalTableQuery } from '@fouc/shared';
import { RELATIONAL_PAGE_LIMITS } from '@fouc/shared';
import { Button } from '@/components/ui/button';
import { useAppAlert } from '@/components/app-alert-provider';
import { backendFetch } from '@/lib/backend';
import { TablePageSize } from './table-page-size';
import { lastTablePageOffset, loadedTableTotal, tablePageOffset } from './table-pagination-model';
import styles from './table-pagination.module.css';
type Props = {
  base: string;
  schema: string;
  page: RelationalTablePage;
  query: RelationalTableQuery;
  revision: number;
  offset: number;
  limit: number;
  defaultSize: number;
  loadTimeMs: number | null;
  disabled: boolean;
  onNavigate: (offset: number) => void;
  onLimit: (limit: number) => void;
  onDefault: (limit: number) => void;
  onClose: () => void;
  exportAction: ReactNode;
};
export function TablePagination({
  base,
  schema,
  page,
  query,
  revision,
  offset,
  limit,
  defaultSize,
  loadTimeMs,
  disabled,
  onNavigate,
  onLimit,
  onDefault,
  onClose,
  exportAction,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const alerts = useAppAlert();
  const scope = JSON.stringify([base, schema, page.table, query, revision]),
    requestKey = JSON.stringify([scope, offset, limit]);
  const [count, setCount] = useState<{
    scope: string;
    total: string;
  } | null>(null);
  const [operation, setOperation] = useState({ key: '', busy: false });
  const request = useRef<AbortController | null>(null),
    live = useRef(true);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current?.abort();
    };
  }, []);
  useLayoutEffect(() => () => request.current?.abort(), [requestKey, disabled]);
  const counting = operation.key === requestKey && operation.busy,
    blocked = disabled || counting;
  const total = count?.scope === scope ? count.total : disabled ? null : loadedTableTotal(page);
  const currentPage = Math.floor(offset / limit) + 1,
    lastOffset = total === null ? null : lastTablePageOffset(total, limit);
  const [input, setInput] = useState({ page: currentPage, draft: String(currentPage) });
  if (input.page !== currentPage) setInput({ page: currentPage, draft: String(currentPage) });
  async function countRows(goLast = false) {
    if (blocked) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setOperation({ key: requestKey, busy: true });
    try {
      const result = await backendFetch<RelationalTableCount>(
        `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(page.table)}/count`,
        { method: 'POST', body: JSON.stringify(query), signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setCount({ scope, total: result.totalRows });
      if (goLast) {
        const last = lastTablePageOffset(result.totalRows, limit);
        if (last === null)
          alerts.notify(
            'warning',
            tConnector('totalRowsExceedTheCurrentPaginationNavigationRange'),
          );
        else if (last !== offset) onNavigate(last);
      }
    } catch (reason) {
      if (!controller.signal.aborted)
        alerts.notify(
          'error',
          tConnector('failedToReadTotalRowCount'),
          reason instanceof Error ? uiText(reason, locale) : String(reason),
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (live.current) setOperation({ key: requestKey, busy: false });
      }
    }
  }
  function jump() {
    if (blocked) return;
    const next = tablePageOffset(input.draft, limit, total);
    if (next === null) alerts.notify('warning', tConnector('enterAValidPageNumber'));
    else if (next !== offset) onNavigate(next);
    setInput({
      page: currentPage,
      draft: next === null ? String(currentPage) : String(Math.floor(next / limit) + 1),
    });
  }
  return (
    <footer className={styles.footer} aria-label={tConnector('tableDataPaginationAndStatistics')}>
      <div className={styles.summary}>
        <span
          title={tConnector('theDatabaseReturnedRowsForThisPage', { p0: String(page.rows.length) })}
        >
          {tConnector('total')}
          {page.rows.length}
          {tConnector('row')}
        </span>
        <Button
          className={styles.count}
          variant="ghost"
          disabled={disabled}
          loading={counting}
          aria-label={tConnector('refreshTotalRowCount')}
          title={tConnector('readTotalRowsUnderTheCurrentDatabaseFilter')}
          onClick={() => void countRows()}
        >
          <ArrowsClockwise size={12} />
          <span
            className={styles.countLabel}
            title={
              total === null
                ? tConnector('totalRowCountNotReadYet')
                : tConnector('rowsInTotal', { p0: String(total) })
            }
          >
            {tConnector('total3627')}
            {total === null ? '—' : BigInt(total).toLocaleString(locale)}
            {tConnector('row')}
          </span>
        </Button>
        {loadTimeMs !== null ? (
          <span
            title={tConnector('tableDataRequestTookMsIncludingNetworkTransfer', {
              p0: String(loadTimeMs),
            })}
          >
            {loadTimeMs} ms
          </span>
        ) : null}
      </div>
      <code title={page.statement.sql}>{page.statement.sql}</code>
      <div className={styles.pagination}>
        <TablePageSize
          size={limit}
          defaultSize={defaultSize}
          disabled={blocked}
          onChange={onLimit}
          onDefault={onDefault}
        />
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('firstPageData')}
          title={tConnector('firstPage')}
          disabled={!offset || blocked}
          onClick={() => onNavigate(0)}
        >
          <CaretDoubleLeft size={13} />
        </button>
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('previousPageData')}
          title={tConnector('previousPage')}
          disabled={!offset || blocked}
          onClick={() => onNavigate(Math.max(0, offset - limit))}
        >
          <CaretLeft size={13} />
        </button>
        <input
          className={styles.pageInput}
          aria-label={tConnector('goToDataPage')}
          title={tConnector('enterAPageNumberAndPressEnter')}
          inputMode="numeric"
          value={input.draft}
          disabled={blocked}
          onChange={(event) => setInput({ page: currentPage, draft: event.target.value })}
          onBlur={() => setInput({ page: currentPage, draft: String(currentPage) })}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              jump();
            }
          }}
        />
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('nextPageData')}
          title={tConnector('nextPage')}
          disabled={!page.hasMore || blocked || offset + limit > RELATIONAL_PAGE_LIMITS.offset}
          onClick={() => onNavigate(offset + limit)}
        >
          <CaretRight size={13} />
        </button>
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('lastPageData')}
          title={tConnector('lastPage')}
          disabled={
            blocked ||
            !page.hasMore ||
            (total !== null && (lastOffset === null || lastOffset <= offset))
          }
          onClick={() => {
            if (lastOffset === null) void countRows(true);
            else onNavigate(lastOffset);
          }}
        >
          <CaretDoubleRight size={13} />
        </button>
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('closeDataTable')}
          title={tConnector('closeDataTable')}
          disabled={blocked}
          onClick={onClose}
        >
          <X size={13} />
        </button>
      </div>
      <span className={styles.export}>{exportAction}</span>
    </footer>
  );
}
