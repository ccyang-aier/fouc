'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './query-result.messages';
import { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppAlert } from '@/components/app-alert-provider';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CaretDown,
  ChartBar,
  ChatText,
  CheckCircle,
  Clock,
  Copy,
  FloppyDisk,
  IconContext,
  ListChecks,
  Plus,
  Table,
  Timer,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DatabaseQueryResult, RelationalProvider, SqlExecutionSnapshot } from '@fouc/shared';
import type { SqlResultView } from '@fouc/shared';
import { formatDelimited, formatJson } from './result-format';
import { QueryChartBuilder } from './charts';
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid';
import { ResultExportDialog, type ResultExportDialogProps } from './result-export';
import { SqlResultTools } from './sql-result-tools';
import { SqlResultDdlAction, type SqlResultQueryContext } from './sql-result-ddl-action';
import { SqlResultSummary } from './sql-result-summary';
import styles from './query-result.module.css';
type ResultView = SqlResultView;
const views = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { id: 'table', label: tConnector('dataTable'), icon: Table },
    { id: 'summary', label: tConnector('summary'), icon: ListChecks },
    { id: 'chart', label: tConnector('chart'), icon: ChartBar },
    { id: 'messages', label: tConnector('messages'), icon: ChatText },
  ] as const;
};
export function SqlQueryResult({
  result,
  executionSummary,
  executionLost,
  provider,
  scopeKey,
  layoutScopeKey,
  view: controlledView,
  onViewChange,
  headerTarget,
  queryContext,
  active = true,
  onExplainTarget,
  onRefresh,
  autoRefresh = false,
  onAutoRefresh,
}: {
  result: DatabaseQueryResult | null;
  executionSummary?: SqlExecutionSnapshot;
  executionLost?: boolean;
  provider: RelationalProvider;
  scopeKey: string;
  layoutScopeKey?: string;
  view?: ResultView;
  onViewChange?: (view: ResultView) => void;
  headerTarget?: HTMLElement | null;
  queryContext?: SqlResultQueryContext;
  active?: boolean;
  onExplainTarget?: (target: HTMLDivElement | null) => void;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onAutoRefresh?: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId();
  const [localHeaderTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null),
    [toolsTarget, setToolsTarget] = useState<HTMLDivElement | null>(null);
  const [localView, setLocalView] = useState<ResultView>('table');
  const view = controlledView ?? localView;
  const [exportSnapshot, setExportSnapshot] = useState<Omit<
      ResultExportDialogProps,
      'onClose'
    > | null>(null),
    [selectionScope, setSelectionScope] = useState<ResultGridSelectionScope | null>(null);
  const [filteredRows, setFilteredRows] = useState<readonly number[] | null>(null);
  const shownResult = useMemo(
    () =>
      result && filteredRows
        ? { ...result, rows: filteredRows.map((index) => result.rows[index]) }
        : result,
    [result, filteredRows],
  );
  const shownRows = shownResult?.rows ?? [];
  const selectScope = useCallback(
    (scope: ResultGridSelectionScope | null) =>
      setSelectionScope(
        scope && filteredRows
          ? { ...scope, rows: scope.rows.map((index) => filteredRows[index]) }
          : scope,
      ),
    [filteredRows],
  );
  function setView(next: ResultView) {
    setSelectionScope(null);
    (onViewChange ?? setLocalView)(next);
  }
  const { notify } = useAppAlert();
  const hasRows = Boolean(result?.rows.length),
    gridView = view === 'table' || view === 'text' || view === 'json';
  async function copy() {
    if (!shownResult) return;
    try {
      const content =
        view === 'json' ? formatJson(shownResult) : formatDelimited(shownResult, '\t');
      await navigator.clipboard.writeText(content);
      notify(
        'success',
        tConnector('copiedRowsFromTheCurrentView', { p0: String(shownRows.length) }),
      );
    } catch {
      notify('error', tConnector('copyFailedCheckClipboardPermissions'));
    }
  }
  return (
    <IconContext.Provider value={{ weight: 'bold', size: 16 }}>
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <div className={styles.views} role="tablist" aria-label={tConnector('queryResultView')}>
            {views(locale).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${id}-${item.id}`}
                aria-controls={`${id}-panel`}
                tabIndex={view === item.id ? 0 : -1}
                aria-selected={view === item.id}
                data-empty={(item.id === 'messages' && !result?.messages.length) || undefined}
                className="fouc-action"
                onClick={() => setView(item.id)}
                onKeyDown={(event) => {
                  const index = views().findIndex((entry) => entry.id === item.id);
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % views().length
                      : event.key === 'ArrowLeft'
                        ? (index - 1 + views().length) % views().length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? views().length - 1
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    setView(views()[next].id);
                    document.getElementById(`${id}-${views()[next].id}`)?.focus();
                  }
                }}
              >
                <item.icon />
                {item.label}
                {item.id === 'messages' && result && result.messages.length > 0
                  ? ` ${result.messages.length}`
                  : ''}
              </button>
            ))}
          </div>
          {gridView && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`fouc-action ${styles.rowsFilter}`}
                aria-label={tConnector('queryResultRowRange')}
              >
                {view === 'text'
                  ? tConnector('text')
                  : view === 'json'
                    ? 'JSON'
                    : filteredRows
                      ? tConnector('selectedRows')
                      : tConnector('allRows')}
                <CaretDown size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuCheckboxItem
                    checked={!filteredRows}
                    onCheckedChange={() => {
                      setFilteredRows(null);
                      setSelectionScope(null);
                    }}
                  >
                    {tConnector('allReturnedRows')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    disabled={!selectionScope?.rows.length}
                    checked={Boolean(filteredRows)}
                    onCheckedChange={() => {
                      if (selectionScope) {
                        setFilteredRows(selectionScope.rows);
                        setSelectionScope(null);
                      }
                    }}
                  >
                    {tConnector('viewSelectedRowsOnly')}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setView('text')}>
                    {tConnector('textView')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setView('json')}>
                    {tConnector('jsonView')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className={styles.toolbarActions}>
            {!headerTarget && <div ref={setHeaderTarget} className={styles.headerTools} />}
            <div ref={active ? onExplainTarget : undefined} className={styles.explainSlot} />
            <button
              type="button"
              className="fouc-action"
              aria-label={tConnector('exportQueryResults')}
              disabled={!hasRows}
              onClick={() =>
                result &&
                setExportSnapshot({
                  result,
                  provider,
                  title: 'query-result',
                  selectedRows: selectionScope?.rectangular
                    ? selectionScope.rows
                    : (filteredRows ?? undefined),
                  selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined,
                })
              }
            >
              <UploadSimple />
              <span>{tConnector('saveResults')}</span>
            </button>
            {gridView && (
              <>
                <span className={styles.divider} />
                <button
                  type="button"
                  className="fouc-action"
                  aria-label={tConnector('refreshCurrentQuery')}
                  title={
                    onRefresh
                      ? tConnector('rerunTheCurrentSql')
                      : tConnector('pinnedSnapshotsCannotBeRefreshed')
                  }
                  disabled={!onRefresh}
                  onClick={onRefresh}
                >
                  <ArrowsClockwise />
                  <span>{tConnector('refresh')}</span>
                </button>
                <button
                  type="button"
                  className="fouc-action"
                  aria-label={tConnector('automaticallyRefreshQuery')}
                  title={
                    onAutoRefresh
                      ? tConnector('refreshEverySecondsPauseWhenLeavingTheQueryPageOr')
                      : tConnector('pinnedSnapshotsDoNotRefreshAutomatically')
                  }
                  disabled={!onAutoRefresh}
                  aria-pressed={autoRefresh}
                  onClick={onAutoRefresh}
                >
                  <Timer />
                  <span>{tConnector('automatic')}</span>
                </button>
                <div
                  className={styles.readonlyActions}
                  role="group"
                  aria-label={tConnector('queryResultWriteActions')}
                  aria-describedby={`${id}-readonly`}
                  title={tConnector('queryResultsAreReadOnlySnapshotsEditInTheData')}
                >
                  <span id={`${id}-readonly`} className="sr-only">
                    {tConnector('queryResultsAreReadOnlySnapshotsEditInTheData')}
                  </span>
                  <div className={styles.addRow}>
                    <button
                      type="button"
                      className="fouc-action"
                      aria-label={tConnector('addRow')}
                      aria-describedby={`${id}-readonly`}
                      disabled
                    >
                      <Plus />
                      <span>{tConnector('addRow')}</span>
                    </button>
                    <button
                      type="button"
                      className="fouc-action"
                      aria-label={tConnector('addRowOptions')}
                      aria-describedby={`${id}-readonly`}
                      disabled
                    >
                      <CaretDown />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="fouc-action"
                    data-variant="destructive"
                    aria-label={tConnector('deleteRows')}
                    aria-describedby={`${id}-readonly`}
                    disabled
                  >
                    <Trash />
                    <span>{tConnector('deleteRows')}</span>
                  </button>
                  <button
                    type="button"
                    className={`fouc-action ${styles.submit}`}
                    aria-label={tConnector('commit')}
                    aria-describedby={`${id}-readonly`}
                    disabled
                  >
                    <FloppyDisk />
                    <span>{tConnector('commit')}</span>
                  </button>
                  <button
                    type="button"
                    className={`fouc-action ${styles.rollback}`}
                    aria-label={tConnector('rollBack')}
                    aria-describedby={`${id}-readonly`}
                    disabled
                  >
                    <ArrowCounterClockwise />
                    <span>{tConnector('rollBack')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
          {view === 'table' &&
            (headerTarget ?? localHeaderTarget) &&
            createPortal(
              <>
                <SqlResultDdlAction context={queryContext} provider={provider} />
                <SqlResultTools
                  onTarget={setToolsTarget}
                  disabled={!result}
                  extraActions={
                    <button
                      type="button"
                      className="fouc-menu-item"
                      disabled={!hasRows}
                      onClick={() => void copy()}
                    >
                      <Copy size={16} />
                      {tConnector('copyQueryResults')}
                    </button>
                  }
                />
              </>,
              (headerTarget ?? localHeaderTarget)!,
            )}
        </div>
        <div
          className={styles.content}
          role="tabpanel"
          id={`${id}-panel`}
          aria-label={
            view === 'text'
              ? tConnector('textView')
              : view === 'json'
                ? tConnector('jsonView')
                : undefined
          }
          aria-labelledby={view !== 'text' && view !== 'json' ? `${id}-${view}` : undefined}
        >
          {view === 'table' && shownResult && (
            <ResultGrid
              result={shownResult}
              rowNumbers={filteredRows?.map((index) => index + 1)}
              scopeKey={`${scopeKey}:${filteredRows?.join(',') ?? 'all'}`}
              layoutScopeKey={layoutScopeKey}
              onSelectionChange={selectScope}
              headerTarget={headerTarget ?? localHeaderTarget}
              toolsTarget={toolsTarget}
            />
          )}
          {view === 'text' && shownResult && (
            <pre className="mw-live-result-pre">{formatDelimited(shownResult, '\t')}</pre>
          )}
          {view === 'json' && shownResult && (
            <pre className="mw-live-result-pre">{formatJson(shownResult)}</pre>
          )}
          {view === 'chart' && shownResult && (
            <QueryChartBuilder result={shownResult} scopeKey={layoutScopeKey} />
          )}
          {view === 'summary' && (
            <SqlResultSummary
              execution={executionSummary}
              result={result}
              sql={queryContext?.sql}
              lost={executionLost}
            />
          )}
          {view === 'messages' && result && (
            <div className="mw-result-summary">
              {result.messages.length ? (
                result.messages.map((message, index) => (
                  <div className="mw-live-result-message" key={index}>
                    <strong>
                      {message.severity}
                      {message.code ? ` · ${message.code}` : ''}
                    </strong>
                    <p>{message.message}</p>
                    {message.detail && <p>{message.detail}</p>}
                    {message.hint && <p>{message.hint}</p>}
                  </div>
                ))
              ) : (
                <p>{tConnector('thisQueryReturnedNoServerMessages')}</p>
              )}
            </div>
          )}
        </div>
        {result && (
          <footer className={styles.footer}>
            <span>
              <CheckCircle size={13} color="var(--ok-ink)" />
              {shownRows.length}
              {tConnector('row')}
              {filteredRows ? tConnector('returned', { p0: String(result.rows.length) }) : ''}
            </span>
            <span>
              <Clock size={12} />
              {result.executionTimeMs} ms
            </span>
            <span>
              {result.truncated || result.hasMore
                ? tConnector('showingReturnedRowsOnly')
                : tConnector('completeResponse')}
              {tConnector('readOnly')}
            </span>
          </footer>
        )}
        {exportSnapshot && (
          <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />
        )}
      </div>
    </IconContext.Provider>
  );
}
