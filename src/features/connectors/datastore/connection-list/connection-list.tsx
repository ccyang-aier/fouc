'use client'

import { useMemo, useState } from 'react'
import {
  ArrowSquareOut, CaretDown, CaretLeft, CaretRight,
  CaretUpDown, Copy, Database, DotsThree, GearSix, LockSimple,
  MagnifyingGlass, PencilSimple, Plus, SpinnerGap, Star, Tag, Trash, X,
} from '@phosphor-icons/react'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ConnectionListProps, ConnectionListRow, ConnectionListStatus } from './types'
import styles from './connection-list.module.css'

type Column = 'target' | 'projects' | 'tags' | 'access' | 'status'
type SortColumn = 'name' | 'target' | 'projects' | 'tags' | 'status'
const statusNames: Record<ConnectionListStatus, string> = {
  untested: '未测试', testing: '测试中', passed: '测试通过', failed: '连接失败',
}
const columnNames: Record<Exclude<Column, 'target'>, string> = {
  projects: '关联项目', tags: '标签', access: '访问方式', status: '状态',
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

function RowActions({ row, pending, onOpen, onEdit, onCopy, onRemove, onOrganize }: {
  row: ConnectionListRow
  pending: boolean
} & Pick<ConnectionListProps, 'onOpen' | 'onEdit' | 'onCopy' | 'onRemove' | 'onOrganize'>) {
  return <div className={styles.rowActions}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={styles.iconButton} aria-label={`打开 ${row.name} 工作台`}
          disabled={pending} onClick={() => onOpen(row)}><ArrowSquareOut size={16} /></button>
      </TooltipTrigger>
      <TooltipContent>打开工作台</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={styles.iconButton} aria-label={`编辑 ${row.name}`}
          disabled={pending} onClick={() => onEdit(row)}><PencilSimple size={16} /></button>
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
        <DropdownMenuItem onSelect={() => onOrganize(row)}><Tag />管理项目与标签</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopy(row)}><Copy />复制连接</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={styles.danger} onSelect={() => onRemove(row)}><Trash />删除连接</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
}

function FilterMenu({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  const selected = options.find(option => option.value === value)
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" className={styles.filterButton} data-active={Boolean(value)}>
        <span>{selected?.label ?? label}</span><CaretDown size={12} />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className={styles.filterMenu}>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
        <DropdownMenuRadioItem value="">全部{label === '关联项目' ? '项目' : '标签'}</DropdownMenuRadioItem>
        {options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}

export function ConnectionList(props: ConnectionListProps) {
  const {
    label, targetLabel, scopeKey, rows, projects, loading, error, pendingIds,
    headerActions, onBack, onCreate, onRetry, onOpen, onEdit, onCopy,
    onRemove, onOrganize, onFavorite, onSelectionChange,
  } = props
  const [search, setSearch] = useState('')
  const [project, setProject] = useState('')
  const [tag, setTag] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<Column[]>([])
  const [sort, setSort] = useState<{ column: SortColumn; direction: 1 | -1 } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const projectNames = useMemo(() => new Map(projects.map(item => [item.id, item.name])), [projects])
  const tags = useMemo(() => [...new Set(rows.flatMap(row => row.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [rows])
  const projectOptions = useMemo(() => [
    ...projects.map(item => ({ value: item.id, label: item.name })),
    { value: '__unassigned__', label: '未关联项目' },
  ], [projects])
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    const results = rows.filter(row => {
      if (onlyFavorites && !row.favorite) return false
      if (tag && !row.tags.includes(tag)) return false
      if (project === '__unassigned__' ? row.projectIds.length > 0 : project && !row.projectIds.includes(project)) return false
      return !needle || [row.name, row.target, row.targetTitle, ...row.tags,
        ...row.projectIds.map(id => projectNames.get(id) ?? '')].join(' ').toLocaleLowerCase().includes(needle)
    })
    if (sort) {
      const value = (row: ConnectionListRow) => sort.column === 'projects'
        ? row.projectIds.map(id => projectNames.get(id) ?? id).join(' ')
        : sort.column === 'tags' ? row.tags.join(' ') : row[sort.column]
      results.sort((a, b) => sort.direction * value(a).localeCompare(value(b), 'zh-CN', { numeric: true }))
    }
    return results
  }, [rows, search, project, tag, onlyFavorites, projectNames, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedIds = selected.filter(id => rows.some(row => row.id === id))
  const allPageSelected = pageRows.length > 0 && pageRows.every(row => selectedIds.includes(row.id))
  const somePageSelected = pageRows.some(row => selectedIds.includes(row.id))
  const filteredActive = Boolean(search || project || tag || onlyFavorites)
  const visibleColumnCount = 8 - hiddenColumns.length

  function changeSelection(ids: string[]) {
    setSelected(ids)
    onSelectionChange(ids)
  }
  function selectPage(checked: boolean) {
    const pageIds = new Set(pageRows.map(row => row.id))
    changeSelection(checked ? [...new Set([...selectedIds, ...pageIds])] : selectedIds.filter(id => !pageIds.has(id)))
  }
  function sortBy(column: SortColumn) {
    setSort(current => ({ column, direction: current?.column === column && current.direction === 1 ? -1 : 1 }))
    setPage(1)
  }
  function sortHeader(column: SortColumn, title: string) {
    return <th scope="col" aria-sort={sort?.column === column ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}>
      <button type="button" className={styles.sortButton} onClick={() => sortBy(column)}>
        {title}<CaretUpDown size={12} data-active={sort?.column === column} />
      </button>
    </th>
  }
  function resetFilters() {
    setSearch(''); setProject(''); setTag(''); setOnlyFavorites(false); setPage(1)
  }

  return <section className={styles.directory} aria-label={`${label} 连接列表`} data-scope={scopeKey}>
    <nav className={styles.breadcrumb} aria-label="面包屑">
      <button type="button" onClick={onBack}>连接器</button><span aria-hidden="true">/</span>
      <span aria-current="page">{label}</span>
    </nav>
    <div className={styles.content}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.titleLine}><h1>{label} 连接</h1><span className={styles.titleDivider} aria-hidden="true" /><span className={styles.count}>{rows.length} 个连接</span></div>
          <p>管理当前工作空间的 {label} 数据库连接，在工作台中浏览与查询。</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.createButton} onClick={onCreate}><Plus size={16} />新建连接</button>
          {headerActions}
        </div>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input aria-label="搜索连接、项目或标签" placeholder="搜索连接、项目或标签" value={search}
            onChange={event => { setSearch(event.target.value); setPage(1) }} />
          {search && <button type="button" aria-label="清除搜索" onClick={() => { setSearch(''); setPage(1) }}><X size={12} /></button>}
        </div>
        <FilterMenu label="关联项目" value={project} options={projectOptions} onChange={value => { setProject(value); setPage(1) }} />
        <FilterMenu label="标签" value={tag} options={tags.map(value => ({ value, label: value }))} onChange={value => { setTag(value); setPage(1) }} />
        <label className={styles.favoriteFilter}><input type="checkbox" checked={onlyFavorites}
          onChange={event => { setOnlyFavorites(event.target.checked); setPage(1) }} />仅收藏</label>
        <div className={styles.toolbarEnd}>
          {selectedIds.length > 0 && <button type="button" className={styles.selectedCount} onClick={() => changeSelection([])} title="清除选择">已选 {selectedIds.length} 项 <X size={11} /></button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.columnButton}><GearSix size={16} />列设置</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>显示列</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked disabled>连接名称</DropdownMenuCheckboxItem>
              {(['target', 'projects', 'tags', 'access', 'status'] as const).map(column => <DropdownMenuCheckboxItem key={column}
                checked={!hiddenColumns.includes(column)} onCheckedChange={checked => setHiddenColumns(current => checked ? current.filter(item => item !== column) : [...current, column])}
                onSelect={event => event.preventDefault()}>{column === 'target' ? targetLabel : columnNames[column]}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={onRetry} disabled={loading}>重试</button></div>}
      <div className={styles.tableViewport}>
        <table className={styles.table} aria-busy={loading}>
          <colgroup>
            <col className={styles.selectionCol} /><col className={styles.nameCol} />
            {!hiddenColumns.includes('target') && <col className={styles.targetCol} />}
            {!hiddenColumns.includes('projects') && <col className={styles.projectCol} />}
            {!hiddenColumns.includes('tags') && <col className={styles.tagsCol} />}
            {!hiddenColumns.includes('access') && <col className={styles.accessCol} />}
            {!hiddenColumns.includes('status') && <col className={styles.statusCol} />}
            <col className={styles.actionsCol} />
          </colgroup>
          <thead><tr>
            <th className={styles.selectionCell} scope="col"><input type="checkbox" aria-label="选择当前页所有连接" checked={allPageSelected}
              ref={input => { if (input) input.indeterminate = somePageSelected && !allPageSelected }} disabled={loading || pageRows.length === 0}
              onChange={event => selectPage(event.target.checked)} /></th>
            {sortHeader('name', '连接名称')}
            {!hiddenColumns.includes('target') && sortHeader('target', targetLabel)}
            {!hiddenColumns.includes('projects') && sortHeader('projects', '关联项目')}
            {!hiddenColumns.includes('tags') && sortHeader('tags', '标签')}
            {!hiddenColumns.includes('access') && <th scope="col">访问方式</th>}
            {!hiddenColumns.includes('status') && sortHeader('status', '状态')}
            <th scope="col" className={styles.actionsHeading}>操作</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }, (_, index) => <tr key={index} aria-hidden="true">{Array.from({ length: visibleColumnCount }, (_, column) => <td key={column}><span className={styles.skeleton} /></td>)}</tr>)
              : pageRows.length === 0 ? <tr><td colSpan={visibleColumnCount} className={styles.emptyCell}>
                <Database size={25} /><strong>{filteredActive ? '没有符合筛选条件的连接' : error ? '暂时无法加载连接' : `还没有 ${label} 连接`}</strong>
                <span>{filteredActive ? '试试其他名称、项目或标签。' : error ? '请重试，检查设备服务是否可用。' : '创建连接，开始浏览与查询你的数据。'}</span>
                {!error && <button type="button" className={styles.emptyAction} onClick={filteredActive ? resetFilters : onCreate}>{filteredActive ? '清除筛选' : '新建连接'}</button>}
              </td></tr> : pageRows.map(row => {
                const pending = pendingIds.includes(row.id)
                const projectLabels = row.projectIds.map(id => projectNames.get(id) ?? '项目不可用')
                return <tr key={row.id} className={styles.dataRow} data-selected={selectedIds.includes(row.id)}>
                  <td className={styles.selectionCell}><input type="checkbox" aria-label={`选择 ${row.name}`} checked={selectedIds.includes(row.id)}
                    onChange={event => changeSelection(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))} /></td>
                  <td><div className={styles.nameCell}>
                    <button type="button" className={styles.nameButton} onClick={() => onOpen(row)} disabled={pending} title={row.name}>{row.name}</button>
                    <button type="button" className={styles.favoriteButton} data-favorite={row.favorite} aria-label={`${row.favorite ? '取消收藏' : '收藏'} ${row.name}`}
                      title={row.favorite ? '取消收藏' : '收藏连接'} aria-pressed={row.favorite} disabled={pending}
                      onClick={() => onFavorite(row, !row.favorite)}><Star size={15} weight={row.favorite ? 'fill' : 'regular'} /></button>
                  </div></td>
                  {!hiddenColumns.includes('target') && <td><span className={styles.target} title={row.targetTitle}>{row.target}</span></td>}
                  {!hiddenColumns.includes('projects') && <td><div className={styles.chips}>
                    {row.projectIds.length ? <><button type="button" className={styles.projectChip} disabled={pending}
                      title={projectNames.has(row.projectIds[0]) ? projectLabels.join('、') : `项目不可用：${row.projectIds[0]}`} onClick={() => onOrganize(row)}>{projectLabels[0]}</button>
                      {row.projectIds.length > 1 && <button type="button" className={styles.projectChip} disabled={pending} title={projectLabels.join('、')}
                        onClick={() => onOrganize(row)}>+{row.projectIds.length - 1}</button>}</>
                      : <button type="button" className={`${styles.projectChip} ${styles.unassigned}`} disabled={pending} onClick={() => onOrganize(row)}>未关联</button>}
                  </div></td>}
                  {!hiddenColumns.includes('tags') && <td><div className={styles.chips}>
                    {row.tags.slice(0, 2).map(item => <button type="button" key={item} className={styles.tagChip} data-color={tagColor(item)}
                      title={`筛选标签：${item}`} onClick={() => { setTag(item); setPage(1) }}>{item}</button>)}
                    {row.tags.length > 2 && <button type="button" className={styles.projectChip} title={row.tags.join('、')} onClick={() => onOrganize(row)}>+{row.tags.length - 2}</button>}
                    {!row.tags.length && <span className={styles.absent} aria-label="无标签">—</span>}
                  </div></td>}
                  {!hiddenColumns.includes('access') && <td><span className={styles.access} title="默认只读；进入工作台后可显式解锁写入。"><LockSimple size={15} />只读</span></td>}
                  {!hiddenColumns.includes('status') && <td><span className={styles.status} data-status={row.status}
                    title={row.statusTitle ?? statusNames[row.status]}>{row.status === 'testing' ? <SpinnerGap size={12} className={styles.spinner} /> : <i aria-hidden="true" />}{statusNames[row.status]}</span></td>}
                  <td><RowActions row={row} pending={pending} onOpen={onOpen} onEdit={onEdit} onCopy={onCopy} onRemove={onRemove} onOrganize={onOrganize} /></td>
                </tr>
              })}
          </tbody>
        </table>
      </div>
      <footer className={styles.footer}>
        <span>{filteredActive ? `${filtered.length} 个匹配连接 · 共 ${rows.length} 个连接` : `共 ${rows.length} 个连接`}</span>
        <div className={styles.pagination}>
          <button type="button" aria-label="上一页" className={styles.pageButton} disabled={currentPage <= 1 || loading} onClick={() => setPage(currentPage - 1)}><CaretLeft size={14} /></button>
          <span className={styles.currentPage} aria-label={`第 ${currentPage} 页，共 ${pageCount} 页`}>{currentPage}</span>
          <button type="button" aria-label="下一页" className={styles.pageButton} disabled={currentPage >= pageCount || loading} onClick={() => setPage(currentPage + 1)}><CaretRight size={14} /></button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.pageSize}>{pageSize} 条/页<CaretDown size={12} /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuRadioGroup value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1) }}>
              {[10, 20, 50].map(size => <DropdownMenuRadioItem key={size} value={String(size)}>{size} 条/页</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup></DropdownMenuContent>
          </DropdownMenu>
        </div>
      </footer>
    </div>
  </section>
}
