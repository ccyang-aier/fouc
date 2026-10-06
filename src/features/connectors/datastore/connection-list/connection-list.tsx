'use client'

import { useMemo, useRef, useState } from 'react'
import {
  ArrowSquareOut, CaretDown, CaretLeft, CaretRight,
  CaretUpDown, Database, DotsThree, GearSix,
  MagnifyingGlass, PencilSimple, Plus, SpinnerGap, Tag, Trash, X,
} from '@phosphor-icons/react'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ConnectionListProps, ConnectionListRow, ConnectionListStatus } from './types'
import { ConnectionFilterMenu } from './filter-menu'
import { filterConnections, unassignedProject } from './filter'
import { ConnectionProjectLinks } from './project-links'
import { ConnectionSelectionDock } from './selection-dock'
import { ConnectionTarget } from './connection-target'
import { ConnectionFavoriteButton } from './favorite-button'
import { useDirectoryColumnWidths, type DirectoryColumn } from './use-column-widths'
import styles from './connection-list.module.css'

type Column = 'target' | 'projects' | 'tags' | 'account' | 'authSource' | 'status'
type SortColumn = 'name' | 'target' | 'projects' | 'tags' | 'status'
const statusNames: Record<ConnectionListStatus, string> = {
  untested: '未测试', testing: '测试中', passed: '测试通过', failed: '连接失败',
}
const tagColors = ['blue', 'violet', 'green', 'orange', 'neutral'] as const

function tagColor(tag: string) {
  const known: Record<string, typeof tagColors[number]> = {
    开发: 'blue', 缓存: 'blue', 分析: 'violet', 索引: 'green',
    测试: 'orange', 本机: 'neutral', 归档: 'neutral',
  }
  if (known[tag]) return known[tag]
  let hash = 0
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return tagColors[hash % tagColors.length]
}

function RowActions({ row, pending, onOpen, onEdit, onRemove, onManageTags }: {
  row: ConnectionListRow
  pending: boolean
} & Pick<ConnectionListProps, 'onOpen' | 'onEdit' | 'onRemove' | 'onManageTags'>) {
  return <div className={styles.rowActions}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={`fouc-action ${styles.iconButton}`} aria-label={`打开 ${row.name} 工作台`}
          disabled={pending || row.status !== 'passed'} onClick={() => onOpen(row)}><ArrowSquareOut size={16} weight="bold" /></button>
      </TooltipTrigger>
      <TooltipContent>{row.status === 'passed' ? '打开工作台' : '请先测试连接'}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={`fouc-action ${styles.iconButton}`} aria-label={`编辑 ${row.name}`}
          disabled={pending} onClick={() => onEdit(row)}><PencilSimple size={16} weight="bold" /></button>
      </TooltipTrigger>
      <TooltipContent>编辑连接</TooltipContent>
    </Tooltip>
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.iconButton} aria-label={`${row.name} 更多操作`}
              disabled={pending}><DotsThree size={20} weight="bold" /></button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>更多操作</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onManageTags(row)}><Tag weight="bold" />管理标签</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onRemove(row)}><Trash weight="bold" />删除连接</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
}

export function ConnectionList(props: ConnectionListProps) {
  const {
    label, targetLabel, accountLabel, authSourceLabel, scopeKey, rows, projects, loading, error, pendingIds,
    headerActions, onBack, onCreate, onRetry, onOpen, onEdit,
    onRemove, onOpenProject, onManageTags, onFavorite, onSelectionChange: changeSelection,
    selectedIds: selection, batchProgress, batchResult, onBatchAction, onDismissBatchResult,
  } = props
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState<Column[]>([])
  const [sort, setSort] = useState<{ column: SortColumn; direction: 1 | -1 } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const projectNames = useMemo(() => new Map(projects.map(item => [item.id, item.name])), [projects])
  const tags = useMemo(() => [...new Set(rows.flatMap(row => row.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [rows])
  const projectOptions = useMemo(() => [
    ...projects.map(item => ({ value: item.id, label: item.name })),
    { value: unassignedProject, label: '未关联项目' },
  ], [projects])
  const filtered = useMemo(() => {
    const results = filterConnections(rows, { search, projects: projectFilter, tags: tagFilter, onlyFavorites }, projectNames)
    if (sort) {
      const value = (row: ConnectionListRow) => sort.column === 'projects'
        ? row.projectIds.map(id => projectNames.get(id) ?? id).join(' ')
        : sort.column === 'tags' ? row.tags.join(' ') : row[sort.column]
      results.sort((a, b) => sort.direction * value(a).localeCompare(value(b), 'zh-CN', { numeric: true }))
    }
    return results
  }, [rows, search, projectFilter, tagFilter, onlyFavorites, projectNames, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedIds = selection.filter(id => rows.some(row => row.id === id))
  const allPageSelected = pageRows.length > 0 && pageRows.every(row => selectedIds.includes(row.id))
  const somePageSelected = pageRows.some(row => selectedIds.includes(row.id))
  const filteredActive = Boolean(search || projectFilter.length || tagFilter.length || onlyFavorites)
  const columnNames = { target: targetLabel, projects: '关联项目', tags: '标签', account: accountLabel, authSource: authSourceLabel, status: '状态' }
  const columns = (Object.keys(columnNames) as Column[]).filter(column => columnNames[column])
  const visibleColumnCount = 3 + columns.filter(column => !hiddenColumns.includes(column)).length
  const table = useRef<HTMLTableElement>(null)
  const layout = useDirectoryColumnWidths(scopeKey, table, ['name', ...columns.filter(column => !hiddenColumns.includes(column)), 'actions'])

  function selectPage(checked: boolean) {
    const pageIds = new Set(pageRows.map(row => row.id))
    changeSelection(checked ? [...new Set([...selectedIds, ...pageIds])] : selectedIds.filter(id => !pageIds.has(id)))
  }
  function sortBy(column: SortColumn) {
    setSort(current => ({ column, direction: current?.column === column && current.direction === 1 ? -1 : 1 }))
    setPage(1)
  }
  function resizeHandle(column: DirectoryColumn, title: string) {
    return <button type="button" className={styles.resizeHandle} aria-label={`调整${title}列宽`} title="拖动调整列宽 · ← / →"
      {...layout.handleProps(column)} />
  }
  function sortHeader(column: SortColumn, title: string) {
    return <th scope="col" data-directory-column={column} aria-sort={sort?.column === column ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}>
      <button type="button" className={styles.sortButton} onClick={() => sortBy(column)}>
        <span>{title}</span><CaretUpDown size={12} data-active={sort?.column === column} />
      </button>
      {resizeHandle(column, title)}
    </th>
  }
  function resetFilters() {
    setSearch(''); setProjectFilter([]); setTagFilter([]); setOnlyFavorites(false); setPage(1)
  }

  return <section className={styles.directory} aria-label={`${label} 连接列表`} data-scope={scopeKey} data-resizing={Boolean(layout.resizing)}>
    <nav className={styles.breadcrumb} aria-label="面包屑">
      <button type="button" onClick={onBack}>连接器</button><span aria-hidden="true">/</span>
      <span aria-current="page">{label}</span>
    </nav>
    <div className={styles.content}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.titleLine}><h1>{label} 连接</h1><span className={styles.titleDivider} aria-hidden="true" /><span className={styles.count}>{rows.length} 个连接</span></div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.createButton} disabled={Boolean(batchProgress)} onClick={onCreate}><Plus size={16} />新建连接</button>
          {headerActions}
        </div>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input aria-label="搜索连接、项目或标签" placeholder="搜索连接、项目或标签" value={search}
            onChange={event => { setSearch(event.target.value); setPage(1) }} />
          {search && <button type="button" className="fouc-action" aria-label="清除搜索" onClick={() => { setSearch(''); setPage(1) }}><X size={12} /></button>}
        </div>
        <ConnectionFilterMenu label="关联项目" values={projectFilter} options={projectOptions} onChange={values => { setProjectFilter(values); setPage(1) }} />
        <ConnectionFilterMenu label="标签" values={tagFilter} options={tags.map(value => ({ value, label: value }))} onChange={values => { setTagFilter(values); setPage(1) }} />
        <label className={`fouc-action ${styles.favoriteFilter}`}><input type="checkbox" checked={onlyFavorites}
          onChange={event => { setOnlyFavorites(event.target.checked); setPage(1) }} />仅收藏</label>
        <div className={styles.toolbarEnd}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.columnButton}><GearSix size={16} />列设置</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>显示列</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked disabled>连接名称</DropdownMenuCheckboxItem>
              {columns.map(column => <DropdownMenuCheckboxItem key={column}
                checked={!hiddenColumns.includes(column)} onCheckedChange={checked => setHiddenColumns(current => checked ? current.filter(item => item !== column) : [...current, column])}
                onSelect={event => event.preventDefault()}>{columnNames[column]}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={onRetry} disabled={loading}>重试</button></div>}
      <div className={styles.tableViewport}>
        <table ref={table} className={styles.table} style={layout.tableStyle} aria-busy={loading}>
          <colgroup>
            <col className={styles.selectionCol} /><col className={styles.nameCol} style={{ width: layout.widths.name }} />
            {!hiddenColumns.includes('target') && <col className={styles.targetCol} style={{ width: layout.widths.target }} />}
            {!hiddenColumns.includes('projects') && <col className={styles.projectCol} style={{ width: layout.widths.projects }} />}
            {!hiddenColumns.includes('tags') && <col className={styles.tagsCol} style={{ width: layout.widths.tags }} />}
            {accountLabel && !hiddenColumns.includes('account') && <col className={styles.accountCol} style={{ width: layout.widths.account }} />}
            {authSourceLabel && !hiddenColumns.includes('authSource') && <col className={styles.accountCol} style={{ width: layout.widths.authSource }} />}
            {!hiddenColumns.includes('status') && <col className={styles.statusCol} style={{ width: layout.widths.status }} />}
            <col className={styles.actionsCol} style={{ width: layout.widths.actions }} />
          </colgroup>
          <thead><tr>
            <th className={styles.selectionCell} scope="col"><input type="checkbox" aria-label="选择当前页所有连接" checked={allPageSelected}
              ref={input => { if (input) input.indeterminate = somePageSelected && !allPageSelected }} disabled={loading || pageRows.length === 0 || Boolean(batchProgress)}
              onChange={event => selectPage(event.target.checked)} /></th>
            {sortHeader('name', '连接名称')}
            {!hiddenColumns.includes('target') && sortHeader('target', targetLabel)}
            {!hiddenColumns.includes('projects') && sortHeader('projects', '关联项目')}
            {!hiddenColumns.includes('tags') && sortHeader('tags', '标签')}
            {accountLabel && !hiddenColumns.includes('account') && <th scope="col" data-directory-column="account"><span className={styles.columnTitle}>{accountLabel}</span>{resizeHandle('account', accountLabel)}</th>}
            {authSourceLabel && !hiddenColumns.includes('authSource') && <th scope="col" data-directory-column="authSource"><span className={styles.columnTitle}>{authSourceLabel}</span>{resizeHandle('authSource', authSourceLabel)}</th>}
            {!hiddenColumns.includes('status') && sortHeader('status', '状态')}
            <th scope="col" data-directory-column="actions"><span className={styles.columnTitle}>操作</span>{resizeHandle('actions', '操作')}</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }, (_, index) => <tr key={index} aria-hidden="true">{Array.from({ length: visibleColumnCount }, (_, column) => <td key={column}><span className={styles.skeleton} /></td>)}</tr>)
              : pageRows.length === 0 ? <tr><td colSpan={visibleColumnCount} className={styles.emptyCell}>
                <Database size={25} /><strong>{filteredActive ? '没有符合筛选条件的连接' : error ? '暂时无法加载连接' : `还没有 ${label} 连接`}</strong>
                {!error && <button type="button" className={styles.emptyAction} onClick={filteredActive ? resetFilters : onCreate}>{filteredActive ? '清除筛选' : '新建连接'}</button>}
              </td></tr> : pageRows.map(row => {
                const pending = pendingIds.includes(row.id) || Boolean(batchProgress)
                return <tr key={row.id} className={styles.dataRow} data-selected={selectedIds.includes(row.id)}>
                  <td className={styles.selectionCell}><input type="checkbox" aria-label={`选择 ${row.name}`} checked={selectedIds.includes(row.id)} disabled={Boolean(batchProgress)}
                    onChange={event => changeSelection(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))} /></td>
                  <td><div className={styles.nameCell}>
                    <span className={styles.name} title={row.name}>{row.name}</span>
                    <ConnectionFavoriteButton row={row} pending={pendingIds.includes(row.id)} disabled={Boolean(batchProgress)} onFavorite={onFavorite} />
                  </div></td>
                  {!hiddenColumns.includes('target') && <td><ConnectionTarget row={row} label={targetLabel} /></td>}
                  {!hiddenColumns.includes('projects') && <td><ConnectionProjectLinks ids={row.projectIds} names={projectNames} onOpen={onOpenProject} /></td>}
                  {!hiddenColumns.includes('tags') && <td><div className={styles.chips}>
                    {row.tags.slice(0, 2).map(item => <button type="button" key={item} className={styles.tagChip} data-color={tagColor(item)}
                      title={`筛选标签：${item}`} onClick={() => { setTagFilter([item]); setPage(1) }}>{item}</button>)}
                    {row.tags.length > 2 && <button type="button" className={styles.projectChip} disabled={pending} title={row.tags.join('、')} onClick={() => onManageTags(row)}>+{row.tags.length - 2}</button>}
                    {!row.tags.length && <span className={styles.absent} aria-label="无标签">—</span>}
                  </div></td>}
                  {accountLabel && !hiddenColumns.includes('account') && <td><span className={styles.account} title={row.account}>{row.account || '—'}</span></td>}
                  {authSourceLabel && !hiddenColumns.includes('authSource') && <td><span className={styles.account} title={row.authSource}>{row.authSource || '—'}</span></td>}
                  {!hiddenColumns.includes('status') && <td><span className={styles.status} data-status={row.status}
                    title={row.statusTitle ?? statusNames[row.status]}>{row.status === 'testing' ? <SpinnerGap size={12} className={styles.spinner} /> : <i aria-hidden="true" />}{statusNames[row.status]}</span></td>}
                  <td><RowActions row={row} pending={pending} onOpen={onOpen} onEdit={onEdit} onRemove={onRemove} onManageTags={onManageTags} /></td>
                </tr>
              })}
          </tbody>
        </table>
      </div>
      <footer className={styles.footer}>
        <span>{filteredActive ? `${filtered.length} 个匹配连接 · 共 ${rows.length} 个连接` : `共 ${rows.length} 个连接`}</span>
        <div className={styles.pagination}>
          <button type="button" aria-label="上一页" title="上一页" className={styles.pageButton} disabled={currentPage <= 1 || loading} onClick={() => setPage(currentPage - 1)}><CaretLeft size={16} weight="bold" /></button>
          <span className={styles.currentPage} aria-label={`第 ${currentPage} 页，共 ${pageCount} 页`}>{currentPage}</span>
          <button type="button" aria-label="下一页" title="下一页" className={styles.pageButton} disabled={currentPage >= pageCount || loading} onClick={() => setPage(currentPage + 1)}><CaretRight size={16} weight="bold" /></button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.pageSize}>{pageSize} 条/页<CaretDown size={12} /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuRadioGroup value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1) }}>
              {[10, 20, 50].map(size => <DropdownMenuRadioItem key={size} value={String(size)}>{size} 条/页</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup></DropdownMenuContent>
          </DropdownMenu>
        </div>
      </footer>
    </div>
    <ConnectionSelectionDock count={selectedIds.length} progress={batchProgress} result={batchResult}
      onTags={() => onBatchAction('tags', selectedIds)} onTest={() => onBatchAction('test', selectedIds)} onDelete={() => onBatchAction('delete', selectedIds)}
      onClear={() => changeSelection([])} onDismiss={onDismissBatchResult} />
  </section>
}
