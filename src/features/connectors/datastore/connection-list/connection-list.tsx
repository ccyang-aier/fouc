'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connection-list.messages';
import { useMemo, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUpDown,
  Database,
  DotsThree,
  GearSix,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SpinnerGap,
  Tag,
  Trash,
  X,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectorBackButton } from '../../connector-back-button';
import type { ConnectionListProps, ConnectionListRow, ConnectionListStatus } from './types';
import { ConnectionFilterMenu } from './filter-menu';
import { filterConnections, unassignedProject } from './filter';
import { ConnectionProjectLinks } from './project-links';
import { ConnectionSelectionDock } from './selection-dock';
import { ConnectionTarget } from './connection-target';
import { ConnectionFavoriteButton } from './favorite-button';
import { useDirectoryColumnWidths, type DirectoryColumn } from './use-column-widths';
import styles from './connection-list.module.css';
type Column = 'target' | 'projects' | 'tags' | 'account' | 'authSource' | 'status';
type SortColumn = 'name' | 'target' | 'projects' | 'tags' | 'status';
const statusNames = (locale?: Locale): Record<ConnectionListStatus, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    untested: tConnector('notTested'),
    testing: tConnector('testing'),
    passed: tConnector('testPassed'),
    failed: tConnector('connectionFailed'),
  };
};
const tagColors = ['blue', 'violet', 'green', 'orange', 'neutral'] as const;
function tagColor(tag: string) {
  const known: Record<string, (typeof tagColors)[number]> = {
    开发: 'blue',
    缓存: 'blue',
    分析: 'violet',
    索引: 'green',
    测试: 'orange',
    本机: 'neutral',
    归档: 'neutral',
  };
  if (known[tag]) return known[tag];
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tagColors[hash % tagColors.length];
}
function RowActions({
  row,
  pending,
  onOpen,
  onEdit,
  onRemove,
  onManageTags,
}: {
  row: ConnectionListRow;
  pending: boolean;
} & Pick<ConnectionListProps, 'onOpen' | 'onEdit' | 'onRemove' | 'onManageTags'>) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`fouc-action ${styles.iconButton}`}
            aria-label={tConnector('openWorkbench', { p0: String(row.name) })}
            disabled={pending || row.status === 'testing'}
            onClick={() => onOpen(row)}
          >
            <ArrowSquareOut size={16} weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {row.status === 'passed'
            ? tConnector('openWorkbench470')
            : row.status === 'testing'
              ? tConnector('testingConnection')
              : tConnector('editAndTestConnection')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`fouc-action ${styles.iconButton}`}
            aria-label={tConnector('edit', { p0: String(row.name) })}
            disabled={pending}
            onClick={() => onEdit(row)}
          >
            <PencilSimple size={16} weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{tConnector('editConnection')}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={tConnector('moreActionsFor', { p0: String(row.name) })}
                disabled={pending}
              >
                <DotsThree size={20} weight="bold" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{tConnector('moreActions')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onManageTags(row)}>
            <Tag weight="bold" />
            {tConnector('manageTags')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onRemove(row)}>
            <Trash weight="bold" />
            {tConnector('deleteConnection')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
export function ConnectionList(props: ConnectionListProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const {
    label,
    targetLabel,
    accountLabel,
    authSourceLabel,
    scopeKey,
    rows,
    projects,
    loading,
    error,
    pendingIds,
    headerActions,
    onBack,
    onCreate,
    onRetry,
    onOpen,
    onEdit,
    onRemove,
    onOpenProject,
    onManageTags,
    onFavorite,
    onSelectionChange: changeSelection,
    selectedIds: selection,
    batchProgress,
    batchResult,
    onBatchAction,
    onDismissBatchResult,
  } = props;
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Column[]>([]);
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: 1 | -1;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const projectNames = useMemo(
    () => new Map(projects.map((item) => [item.id, item.name])),
    [projects],
  );
  const tags = useMemo(
    () => [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [rows],
  );
  const projectOptions = useMemo(
    () => [
      ...projects.map((item) => ({ value: item.id, label: item.name })),
      { value: unassignedProject, label: tConnector('noLinkedProjects') },
    ],
    [projects, tConnector],
  );
  const filtered = useMemo(() => {
    const results = filterConnections(
      rows,
      { search, projects: projectFilter, tags: tagFilter, onlyFavorites },
      projectNames,
    );
    if (sort) {
      const value = (row: ConnectionListRow) =>
        sort.column === 'projects'
          ? row.projectIds.map((id) => projectNames.get(id) ?? id).join(' ')
          : sort.column === 'tags'
            ? row.tags.join(' ')
            : row[sort.column];
      results.sort(
        (a, b) => sort.direction * value(a).localeCompare(value(b), 'zh-CN', { numeric: true }),
      );
    }
    return results;
  }, [rows, search, projectFilter, tagFilter, onlyFavorites, projectNames, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedIds = selection.filter((id) => rows.some((row) => row.id === id));
  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  const somePageSelected = pageRows.some((row) => selectedIds.includes(row.id));
  const filteredActive = Boolean(
    search || projectFilter.length || tagFilter.length || onlyFavorites,
  );
  const columnNames = {
    target: targetLabel,
    projects: tConnector('linkedProjects'),
    tags: tConnector('tags'),
    account: accountLabel,
    authSource: authSourceLabel,
    status: tConnector('status'),
  };
  const columns = (Object.keys(columnNames) as Column[]).filter((column) => columnNames[column]);
  const visibleColumnCount = 3 + columns.filter((column) => !hiddenColumns.includes(column)).length;
  const table = useRef<HTMLTableElement>(null);
  const layout = useDirectoryColumnWidths(scopeKey, table, [
    'name',
    ...columns.filter((column) => !hiddenColumns.includes(column)),
    'actions',
  ]);
  function selectPage(checked: boolean) {
    const pageIds = new Set(pageRows.map((row) => row.id));
    changeSelection(
      checked
        ? [...new Set([...selectedIds, ...pageIds])]
        : selectedIds.filter((id) => !pageIds.has(id)),
    );
  }
  function sortBy(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current?.column === column && current.direction === 1 ? -1 : 1,
    }));
    setPage(1);
  }
  function resizeHandle(column: Exclude<DirectoryColumn, 'actions'>, title: string) {
    return (
      <button
        type="button"
        className={`fouc-resize-handle ${styles.resizeHandle}`}
        data-resize-axis="x"
        aria-label={tConnector('resizeTheColumn', { p0: String(title) })}
        title={tConnector('dragToResize')}
        {...layout.handleProps(column)}
      />
    );
  }
  function sortHeader(column: SortColumn, title: string) {
    return (
      <th
        scope="col"
        data-directory-column={column}
        aria-sort={
          sort?.column === column ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'
        }
      >
        <button type="button" className={styles.sortButton} onClick={() => sortBy(column)}>
          <span>{title}</span>
          <CaretUpDown size={12} data-active={sort?.column === column} />
        </button>
        {resizeHandle(column, title)}
      </th>
    );
  }
  function resetFilters() {
    setSearch('');
    setProjectFilter([]);
    setTagFilter([]);
    setOnlyFavorites(false);
    setPage(1);
  }
  return (
    <section
      className={styles.directory}
      aria-label={tConnector('connectionList', { p0: String(label) })}
      data-scope={scopeKey}
      data-resizing={Boolean(layout.resizing)}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <ConnectorBackButton onBack={onBack} />
            <div className={styles.titleLine}>
              <h1>{tConnector('providerConnections', { provider: label })}</h1>
              <span className={styles.titleDivider} aria-hidden="true" />
              <span className={styles.count}>
                {rows.length}
                {tConnector('connections')}
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.createButton}
              disabled={Boolean(batchProgress)}
              onClick={onCreate}
            >
              <Plus size={16} />
              {tConnector('newConnection')}
            </button>
            {headerActions}
          </div>
        </header>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              aria-label={tConnector('searchConnectionsProjectsOrTags')}
              placeholder={tConnector('searchConnectionsProjectsOrTags')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                className="fouc-action"
                aria-label={tConnector('clearSearch')}
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <ConnectionFilterMenu
            label={tConnector('linkedProjects')}
            values={projectFilter}
            options={projectOptions}
            onChange={(values) => {
              setProjectFilter(values);
              setPage(1);
            }}
          />
          <ConnectionFilterMenu
            label={tConnector('tags')}
            values={tagFilter}
            options={tags.map((value) => ({ value, label: value }))}
            onChange={(values) => {
              setTagFilter(values);
              setPage(1);
            }}
          />
          <label className={`fouc-action ${styles.favoriteFilter}`}>
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(event) => {
                setOnlyFavorites(event.target.checked);
                setPage(1);
              }}
            />
            {tConnector('favoritesOnly')}
          </label>
          <div className={styles.toolbarEnd}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={styles.columnButton}>
                  <GearSix size={16} />
                  {tConnector('columnSettings')}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{tConnector('visibleColumns')}</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked disabled>
                  {tConnector('connectionName')}
                </DropdownMenuCheckboxItem>
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={!hiddenColumns.includes(column)}
                    onCheckedChange={(checked) =>
                      setHiddenColumns((current) =>
                        checked ? current.filter((item) => item !== column) : [...current, column],
                      )
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {columnNames[column]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry} disabled={loading}>
              {tConnector('retry')}
            </button>
          </div>
        )}
        <ScrollArea className={styles.tableViewport} orientation="horizontal">
          <table ref={table} className={styles.table} style={layout.tableStyle} aria-busy={loading}>
            <colgroup>
              <col className={styles.selectionCol} />
              <col className={styles.nameCol} style={{ width: layout.widths.name }} />
              {!hiddenColumns.includes('target') && (
                <col className={styles.targetCol} style={{ width: layout.widths.target }} />
              )}
              {!hiddenColumns.includes('projects') && (
                <col className={styles.projectCol} style={{ width: layout.widths.projects }} />
              )}
              {!hiddenColumns.includes('tags') && (
                <col className={styles.tagsCol} style={{ width: layout.widths.tags }} />
              )}
              {accountLabel && !hiddenColumns.includes('account') && (
                <col className={styles.accountCol} style={{ width: layout.widths.account }} />
              )}
              {authSourceLabel && !hiddenColumns.includes('authSource') && (
                <col className={styles.accountCol} style={{ width: layout.widths.authSource }} />
              )}
              {!hiddenColumns.includes('status') && (
                <col className={styles.statusCol} style={{ width: layout.widths.status }} />
              )}
              <col className={styles.actionsCol} />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.selectionCell} scope="col">
                  <input
                    type="checkbox"
                    aria-label={tConnector('selectAllConnectionsOnThisPage')}
                    checked={allPageSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    disabled={loading || pageRows.length === 0 || Boolean(batchProgress)}
                    onChange={(event) => selectPage(event.target.checked)}
                  />
                </th>
                {sortHeader('name', tConnector('connectionName'))}
                {!hiddenColumns.includes('target') && sortHeader('target', targetLabel)}
                {!hiddenColumns.includes('projects') &&
                  sortHeader('projects', tConnector('linkedProjects'))}
                {!hiddenColumns.includes('tags') && sortHeader('tags', tConnector('tags'))}
                {accountLabel && !hiddenColumns.includes('account') && (
                  <th scope="col" data-directory-column="account">
                    <span className={styles.columnTitle}>{accountLabel}</span>
                    {resizeHandle('account', accountLabel)}
                  </th>
                )}
                {authSourceLabel && !hiddenColumns.includes('authSource') && (
                  <th scope="col" data-directory-column="authSource">
                    <span className={styles.columnTitle}>{authSourceLabel}</span>
                    {resizeHandle('authSource', authSourceLabel)}
                  </th>
                )}
                {!hiddenColumns.includes('status') && sortHeader('status', tConnector('status'))}
                <th scope="col" data-directory-column="actions">
                  <span className={styles.columnTitle}>{tConnector('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <tr key={index} aria-hidden="true">
                    {Array.from({ length: visibleColumnCount }, (_, column) => (
                      <td key={column}>
                        <span className={styles.skeleton} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount} className={styles.emptyCell}>
                    <Database size={25} />
                    <strong>
                      {filteredActive
                        ? tConnector('noConnectionsMatchTheFilters')
                        : error
                          ? tConnector('connectionsAreTemporarilyUnavailable')
                          : tConnector('noConnectionsYet', { p0: String(label) })}
                    </strong>
                    {!error && (
                      <button
                        type="button"
                        className={styles.emptyAction}
                        onClick={filteredActive ? resetFilters : onCreate}
                      >
                        {filteredActive ? tConnector('clearFilters') : tConnector('newConnection')}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const pending = pendingIds.includes(row.id) || Boolean(batchProgress);
                  return (
                    <tr
                      key={row.id}
                      className={styles.dataRow}
                      data-selected={selectedIds.includes(row.id)}
                    >
                      <td className={styles.selectionCell}>
                        <input
                          type="checkbox"
                          aria-label={tConnector('select', { p0: String(row.name) })}
                          checked={selectedIds.includes(row.id)}
                          disabled={Boolean(batchProgress)}
                          onChange={(event) =>
                            changeSelection(
                              event.target.checked
                                ? [...selectedIds, row.id]
                                : selectedIds.filter((id) => id !== row.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.name} title={row.name}>
                            {row.name}
                          </span>
                          <ConnectionFavoriteButton
                            row={row}
                            pending={pendingIds.includes(row.id)}
                            disabled={Boolean(batchProgress)}
                            onFavorite={onFavorite}
                          />
                        </div>
                      </td>
                      {!hiddenColumns.includes('target') && (
                        <td>
                          <ConnectionTarget row={row} file={scopeKey === 'sqlite'} />
                        </td>
                      )}
                      {!hiddenColumns.includes('projects') && (
                        <td>
                          <ConnectionProjectLinks
                            ids={row.projectIds}
                            names={projectNames}
                            onOpen={onOpenProject}
                          />
                        </td>
                      )}
                      {!hiddenColumns.includes('tags') && (
                        <td>
                          <div className={styles.chips}>
                            {row.tags.slice(0, 2).map((item) => (
                              <button
                                type="button"
                                key={item}
                                className={styles.tagChip}
                                data-color={tagColor(item)}
                                title={tConnector('filterTag', { p0: String(item) })}
                                onClick={() => {
                                  setTagFilter([item]);
                                  setPage(1);
                                }}
                              >
                                {item}
                              </button>
                            ))}
                            {row.tags.length > 2 && (
                              <button
                                type="button"
                                className={styles.projectChip}
                                disabled={pending}
                                title={row.tags.join('、')}
                                onClick={() => onManageTags(row)}
                              >
                                +{row.tags.length - 2}
                              </button>
                            )}
                            {!row.tags.length && (
                              <span className={styles.absent} aria-label={tConnector('noTags')}>
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {accountLabel && !hiddenColumns.includes('account') && (
                        <td>
                          <span className={styles.account} title={row.account}>
                            {row.account || '—'}
                          </span>
                        </td>
                      )}
                      {authSourceLabel && !hiddenColumns.includes('authSource') && (
                        <td>
                          <span className={styles.account} title={row.authSource}>
                            {row.authSource || '—'}
                          </span>
                        </td>
                      )}
                      {!hiddenColumns.includes('status') && (
                        <td>
                          <span
                            className={styles.status}
                            data-status={row.status}
                            title={row.statusTitle ?? statusNames(locale)[row.status]}
                          >
                            {row.status === 'testing' ? (
                              <SpinnerGap size={12} className={styles.spinner} />
                            ) : (
                              <i aria-hidden="true" />
                            )}
                            {statusNames(locale)[row.status]}
                          </span>
                        </td>
                      )}
                      <td>
                        <RowActions
                          row={row}
                          pending={pending}
                          onOpen={onOpen}
                          onEdit={onEdit}
                          onRemove={onRemove}
                          onManageTags={onManageTags}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollArea>
        <footer className={styles.footer}>
          <span>
            {filteredActive
              ? tConnector('matchingConnectionsTotal', {
                  p0: String(filtered.length),
                  p1: String(rows.length),
                })
              : tConnector('connectionsTotal', { p0: String(rows.length) })}
          </span>
          <div className={styles.pagination}>
            <button
              type="button"
              aria-label={tConnector('previousPage')}
              title={tConnector('previousPage')}
              className={styles.pageButton}
              disabled={currentPage <= 1 || loading}
              onClick={() => setPage(currentPage - 1)}
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span
              className={styles.currentPage}
              aria-label={tConnector('pageOf', { p0: String(currentPage), p1: String(pageCount) })}
            >
              {currentPage}
            </span>
            <button
              type="button"
              aria-label={tConnector('nextPage')}
              title={tConnector('nextPage')}
              className={styles.pageButton}
              disabled={currentPage >= pageCount || loading}
              onClick={() => setPage(currentPage + 1)}
            >
              <CaretRight size={16} weight="bold" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={styles.pageSize}>
                  {pageSize}
                  {tConnector('perPage')}
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  {[10, 20, 50].map((size) => (
                    <DropdownMenuRadioItem key={size} value={String(size)}>
                      {size}
                      {tConnector('perPage')}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </footer>
      </div>
      <ConnectionSelectionDock
        count={selectedIds.length}
        progress={batchProgress}
        result={batchResult}
        onTags={() => onBatchAction('tags', selectedIds)}
        onTest={() => onBatchAction('test', selectedIds)}
        onDelete={() => onBatchAction('delete', selectedIds)}
        onClear={() => changeSelection([])}
        onDismiss={onDismissBatchResult}
      />
    </section>
  );
}
