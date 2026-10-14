'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-query-controls.messages';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsDownUp,
  CaretDown,
  Funnel,
  MagnifyingGlass,
  Plus,
  Timer,
  Trash,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RelationalTablePage, RelationalTableQuery } from '@fouc/shared';
import {
  buildFilter,
  draftFilter,
  isolateFilter,
  newCondition,
  newGroup,
} from './table-filter-model';
import { buildSort, draftSort, newSort } from './table-sort-model';
import { TableFilterBuilder } from './table-filter-builder';
import { TableSortBuilder } from './table-sort-builder';
import { TableQueryPopover } from './table-query-popover';
import styles from './table-query.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export function TableQueryControls({
  page,
  query,
  search,
  open,
  disabled,
  busy,
  onToggle,
  onSearch,
  onApply,
  onRefresh,
  active = true,
  onActionTarget,
}: {
  page: RelationalTablePage;
  query: RelationalTableQuery;
  search: string;
  open: boolean;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
  onSearch: (text: string) => void;
  onApply: (query: RelationalTableQuery) => void;
  onRefresh: () => void;
  active?: boolean;
  onActionTarget?: (node: HTMLDivElement | null) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId();
  const whereAnchor = useRef<HTMLDivElement>(null),
    sortAnchor = useRef<HTMLDivElement>(null);
  const initialFilter = () =>
    query.filter ? draftFilter(query.filter, page.columns) : newGroup([newCondition('')]);
  const initialSort = () => (query.sort.length ? draftSort(query.sort) : [newSort()]);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);
  const [sourceQuery, setSourceQuery] = useState(query);
  const [tab, setTab] = useState<'filter' | 'sort'>('filter');
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [autoSeconds, setAutoSeconds] = useState(0);
  // Column commands replace the applied query; our own application retains disabled drafts.
  if (query !== sourceQuery) {
    setSourceQuery(query);
    if (query.filter !== sourceQuery.filter) setFilter(initialFilter());
    if (query.sort !== sourceQuery.sort) setSort(initialSort());
    setError('');
  }
  const autoRefresh = useEffectEvent(() => {
    if (active && !disabled && !busy && !open) onRefresh();
  });
  useEffect(() => {
    if (!autoSeconds) return;
    const timer = window.setInterval(() => autoRefresh(), autoSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoSeconds]);
  const controlsDisabled = disabled || busy;
  function close() {
    if (open) onToggle();
  }
  function changed() {
    setError('');
  }
  function show(next: 'filter' | 'sort') {
    setTab(next);
    changed();
    if (!open || tab === next) onToggle();
  }
  function build(): RelationalTableQuery {
    return tab === 'filter'
      ? { filter: buildFilter(filter, page.columns, locale), sort: query.sort }
      : { filter: query.filter, sort: buildSort(sort, page.columns) };
  }
  function apply(clear = false) {
    setError('');
    try {
      const next = clear
        ? tab === 'filter'
          ? { ...query, filter: null }
          : { ...query, sort: [] }
        : build();
      onApply(next);
      setSourceQuery(next);
      if (clear) {
        if (tab === 'filter') setFilter(newGroup([newCondition('')]));
        else setSort([newSort()]);
      }
      close();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('invalidCondition'),
      );
    }
  }
  return (
    <section className={styles.controls} aria-label={tConnector('tableQueryControls')}>
      <div className={styles.toolbar}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={`fouc-action ${styles.rowScope}`}>
              {search ? tConnector('currentPageSearch') : tConnector('allRows')}
              <CaretDown size={11} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <label className={styles.pageSearch}>
              <MagnifyingGlass size={13} />
              <input
                aria-label={tConnector('currentPageSearch')}
                value={search}
                placeholder={tConnector('searchCurrentPage')}
                onChange={(event) => onSearch(event.target.value)}
              />
            </label>
          </DropdownMenuContent>
        </DropdownMenu>
        <div ref={whereAnchor} className={styles.condition} data-kind="where">
          <button
            type="button"
            className={`fouc-action ${styles.conditionIcon}`}
            data-table-query-trigger={id}
            aria-label={tConnector('whereFilterConditions')}
            aria-haspopup="dialog"
            aria-controls={`${id}-filter`}
            aria-expanded={open && tab === 'filter'}
            disabled={disabled || busy}
            onClick={() => show('filter')}
          >
            <Funnel size={16} />
          </button>
          <b>WHERE</b>
          <span title={query.filter ? tConnector('databaseFilterApplied') : undefined}>
            {query.filter ? tConnector('filterApplied') : ''}
          </span>
          <CaretDown size={12} aria-hidden />
        </div>
        <div ref={sortAnchor} className={styles.condition} data-kind="sort">
          <button
            type="button"
            className={`fouc-action ${styles.conditionIcon}`}
            data-table-query-trigger={id}
            aria-label={tConnector('orderBySortRules')}
            aria-haspopup="dialog"
            aria-controls={`${id}-sort`}
            aria-expanded={open && tab === 'sort'}
            disabled={disabled || busy}
            onClick={() => show('sort')}
          >
            <ArrowsDownUp size={16} />
          </button>
          <b>ORDER BY</b>
          <span
            title={query.sort
              .map((item) => `${item.column} ${item.direction.toUpperCase()}`)
              .join(', ')}
          >
            {query.sort.map((item) => `${item.column} ${item.direction.toUpperCase()}`).join(', ')}
          </span>
          <CaretDown size={12} aria-hidden />
        </div>
        <Button
          variant="ghost"
          aria-label={tConnector('refreshTableData')}
          disabled={disabled}
          loading={busy}
          onClick={onRefresh}
        >
          <ArrowsClockwise size={14} />
          {tConnector('refresh')}
        </Button>
        <label className={styles.auto}>
          <Timer size={14} />
          <select
            aria-label={tConnector('autoRefreshTableData')}
            value={autoSeconds}
            disabled={disabled || busy}
            onChange={(event) => setAutoSeconds(Number(event.target.value))}
          >
            <option value={0}>{tConnector('automatic')}</option>
            {[5, 10, 30, 60].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds}s
              </option>
            ))}
          </select>
        </label>
        <div ref={onActionTarget} className={styles.actionTarget} />
      </div>
      <TableQueryPopover
        id={`${id}-${tab}`}
        open={active && open}
        interactionScope={id}
        anchor={tab === 'filter' ? whereAnchor : sortAnchor}
        onClose={close}
        label={tab === 'filter' ? tConnector('filter') : tConnector('sort')}
        className={styles.queryForm}
        width={tab === 'filter' ? 560 : 500}
      >
        <header className={styles.popoverHeader}>
          <strong>{tab === 'filter' ? tConnector('filter') : tConnector('sort')}</strong>
          <span className={styles.spacer} />
          <button
            type="button"
            className="fouc-action"
            data-variant="destructive"
            disabled={controlsDisabled}
            onClick={() => apply(true)}
          >
            <Trash size={16} />
            {tab === 'filter' ? tConnector('clearFilters') : tConnector('clearSort')}
          </button>
        </header>
        <div className={styles.editor}>
          {tab === 'filter' ? (
            <TableFilterBuilder
              node={filter}
              columns={page.columns}
              disabled={controlsDisabled}
              onChange={(value) => {
                if (value.kind === 'group') setFilter(value);
                changed();
              }}
              onOnly={(onlyId) => {
                const value = isolateFilter(filter, onlyId);
                if (value.kind === 'group') setFilter(value);
                changed();
              }}
            />
          ) : (
            <TableSortBuilder
              sort={sort}
              columns={page.columns}
              disabled={controlsDisabled}
              onChange={(value) => {
                setSort(value);
                changed();
              }}
            />
          )}
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <footer className={styles.popoverFooter}>
          {tab === 'filter' ? (
            <div className={styles.addCondition}>
              <button
                type="button"
                className="fouc-action"
                disabled={controlsDisabled}
                onClick={() => {
                  setFilter({ ...filter, children: [...filter.children, newCondition('')] });
                  changed();
                }}
              >
                <Plus size={16} />
                {tConnector('addCondition')}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="fouc-action"
                    disabled={controlsDisabled}
                    title={tConnector('addConditionGroup')}
                    aria-label={tConnector('addConditionGroup')}
                  >
                    <CaretDown size={12} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={styles.popoverMenu}
                  data-table-query-menu=""
                  density="compact"
                  align="start"
                >
                  <DropdownMenuItem
                    disabled={controlsDisabled}
                    onSelect={() => {
                      setFilter({
                        ...filter,
                        children: [...filter.children, newGroup([newCondition('')])],
                      });
                      changed();
                    }}
                  >
                    <Plus />
                    {tConnector('addConditionGroup3486')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <button
              type="button"
              className="fouc-action"
              disabled={controlsDisabled || sort.length >= 8 || sort.length >= page.columns.length}
              onClick={() => {
                setSort([...sort, newSort()]);
                changed();
              }}
            >
              <Plus size={16} />
              {tConnector('addColumn')}
            </button>
          )}
          <span className={styles.spacer} />
          <button
            type="button"
            className="fouc-action"
            disabled={controlsDisabled}
            onClick={() => {
              if (tab === 'filter') setFilter(initialFilter());
              else setSort(initialSort());
              changed();
            }}
          >
            {tab === 'filter' ? tConnector('resetConditions') : tConnector('resetSorting')}
          </button>
          <button
            type="button"
            className={styles.apply}
            disabled={controlsDisabled}
            onClick={() => apply()}
          >
            {tab === 'filter' ? tConnector('applyFilter') : tConnector('applySorting')}
          </button>
        </footer>
      </TableQueryPopover>
    </section>
  );
}
