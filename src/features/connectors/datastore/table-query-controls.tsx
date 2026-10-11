"use client"

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowsClockwise, ArrowsDownUp, CaretDown, Check, Copy, DotsThree, Eye, Funnel, MagnifyingGlass, Plus, Timer, Trash } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { RelationalTablePage, RelationalTableQuery, RelationalTableQueryPreview } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { buildFilter, draftFilter, isolateFilter, newCondition, newGroup } from "./table-filter-model"
import { buildSort, draftSort, newSort } from "./table-sort-model"
import { TableFilterBuilder } from "./table-filter-builder"
import { TableSortBuilder } from "./table-sort-builder"
import { TableQueryPopover } from "./table-query-popover"
import styles from "./table-query.module.css"

export function TableQueryControls({ base, schema, page, query, limit, search, open, disabled, busy, onToggle, onSearch, onApply, onLimit, onRefresh, active = true, footerTarget, onActionTarget }: {
  base: string; schema: string; page: RelationalTablePage; query: RelationalTableQuery; limit: number; search: string
  open: boolean; disabled: boolean; busy: boolean; onToggle: () => void; onSearch: (text: string) => void
  onApply: (query: RelationalTableQuery) => void; onLimit: (size: number) => void; onRefresh: () => void
  active?: boolean; footerTarget?: HTMLElement | null; onActionTarget?: (node: HTMLDivElement | null) => void
}) {
  const id = useId()
  const whereAnchor = useRef<HTMLDivElement>(null), sortAnchor = useRef<HTMLDivElement>(null)
  const previewRequest = useRef(0)
  const initialFilter = () => query.filter ? draftFilter(query.filter, page.columns) : newGroup([newCondition("")])
  const initialSort = () => query.sort.length ? draftSort(query.sort) : [newSort()]
  const [filter, setFilter] = useState(initialFilter)
  const [sort, setSort] = useState(initialSort)
  const [sourceQuery, setSourceQuery] = useState(query)
  const [tab, setTab] = useState<"filter" | "sort">("filter")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<RelationalTableQueryPreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [autoSeconds, setAutoSeconds] = useState(0)
  // Column commands replace the applied query; our own application retains disabled drafts.
  if (query !== sourceQuery) {
    setSourceQuery(query)
    if (query.filter !== sourceQuery.filter) setFilter(initialFilter())
    if (query.sort !== sourceQuery.sort) setSort(initialSort())
    setPreview(null)
    setPreviewBusy(false)
    setCopied(false)
    setError("")
  }
  useLayoutEffect(() => { previewRequest.current += 1 }, [query])
  const autoRefresh = useEffectEvent(() => { if (active && !disabled && !busy && !previewBusy && !open) onRefresh() })
  useEffect(() => {
    if (!autoSeconds) return
    const timer = window.setInterval(() => autoRefresh(), autoSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [autoSeconds])
  const controlsDisabled = disabled || busy || previewBusy
  function close() { previewRequest.current += 1; setPreviewBusy(false); if (open) onToggle() }
  function changed() { previewRequest.current += 1; setPreviewBusy(false); setPreview(null); setCopied(false); setError("") }
  function show(next: "filter" | "sort") { setTab(next); changed(); if (!open || tab === next) onToggle() }
  function build(): RelationalTableQuery {
    return tab === "filter" ? { filter: buildFilter(filter, page.columns), sort: query.sort } : { filter: query.filter, sort: buildSort(sort, page.columns) }
  }
  async function previewQuery() {
    const request = ++previewRequest.current
    setError(""); setPreview(null); setPreviewBusy(true)
    try {
      const result = await backendFetch<RelationalTableQueryPreview>(`${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(page.table)}/rows/preview`, { method: "POST", body: JSON.stringify({ ...build(), offset: 0, limit }) })
      if (request === previewRequest.current) setPreview(result)
    } catch (reason) { if (request === previewRequest.current) setError(reason instanceof Error ? reason.message : "无法预览查询") }
    finally { if (request === previewRequest.current) setPreviewBusy(false) }
  }
  function apply(clear = false) {
    setError("")
    try {
      const next = clear ? tab === "filter" ? { ...query, filter: null } : { ...query, sort: [] } : build()
      onApply(next)
      setSourceQuery(next)
      if (clear) {
        if (tab === "filter") setFilter(newGroup([newCondition("")]))
        else setSort([newSort()])
      }
      close()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "条件无效") }
  }
  async function copy() {
    if (!preview) return
    try { await navigator.clipboard.writeText(preview.statement.sql + "\n-- 绑定参数: " + JSON.stringify(preview.statement.parameters)); setCopied(true) }
    catch { setError("无法访问剪贴板，请选中 SQL 手动复制") }
  }
  const pageSize = <select aria-label="每页行数" disabled={disabled || busy} value={limit} onChange={event => onLimit(Number(event.target.value))}>{[25, 50, 100, 250, 500].map(size => <option key={size} value={size}>{size} 行 / 页</option>)}</select>
  return <section className={styles.controls} aria-label="表查询控制">
    <div className={styles.toolbar}>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={`fouc-action ${styles.rowScope}`}>{search ? "当前页搜索" : "全部行"}<CaretDown size={11} /></button></DropdownMenuTrigger><DropdownMenuContent align="start"><label className={styles.pageSearch}><MagnifyingGlass size={13} /><input aria-label="当前页搜索" value={search} placeholder="搜索当前页" onChange={event => onSearch(event.target.value)} /></label></DropdownMenuContent></DropdownMenu>
      <div ref={whereAnchor} className={styles.condition} data-kind="where"><button type="button" className={`fouc-action ${styles.conditionIcon}`} data-table-query-trigger={id} aria-label="WHERE 筛选条件" aria-haspopup="dialog" aria-controls={`${id}-filter`} aria-expanded={open && tab === "filter"} disabled={disabled || busy} onClick={() => show("filter")}><Funnel size={16} /></button><b>WHERE</b><span title={query.filter ? "已应用数据库筛选" : undefined}>{query.filter ? "已应用筛选" : ""}</span><CaretDown size={12} aria-hidden /></div>
      <div ref={sortAnchor} className={styles.condition} data-kind="sort"><button type="button" className={`fouc-action ${styles.conditionIcon}`} data-table-query-trigger={id} aria-label="ORDER BY 排序规则" aria-haspopup="dialog" aria-controls={`${id}-sort`} aria-expanded={open && tab === "sort"} disabled={disabled || busy} onClick={() => show("sort")}><ArrowsDownUp size={16} /></button><b>ORDER BY</b><span title={query.sort.map(item => `${item.column} ${item.direction.toUpperCase()}`).join(", ")}>{query.sort.map(item => `${item.column} ${item.direction.toUpperCase()}`).join(", ")}</span><CaretDown size={12} aria-hidden /></div>
      <Button variant="ghost" aria-label="刷新表数据" disabled={disabled} loading={busy} onClick={onRefresh}><ArrowsClockwise size={14} />刷新</Button>
      <label className={styles.auto}><Timer size={14} /><select aria-label="自动刷新表数据" value={autoSeconds} disabled={disabled || busy} onChange={event => setAutoSeconds(Number(event.target.value))}><option value={0}>自动</option>{[5, 10, 30, 60].map(seconds => <option key={seconds} value={seconds}>{seconds}s</option>)}</select></label>
      <div ref={onActionTarget} className={styles.actionTarget} />
      {footerTarget ? createPortal(pageSize, footerTarget) : null}
    </div>
    <TableQueryPopover id={`${id}-${tab}`} open={active && open} interactionScope={id} anchor={tab === "filter" ? whereAnchor : sortAnchor} onClose={close} label={tab === "filter" ? "筛选" : "排序"} className={styles.queryForm} width={tab === "filter" ? 560 : 500}>
      <header className={styles.popoverHeader}><strong>{tab === "filter" ? "筛选" : "排序"}</strong><span className={styles.spacer} /><button type="button" className="fouc-action" data-variant="destructive" disabled={controlsDisabled} onClick={() => apply(true)}><Trash size={16} />{tab === "filter" ? "清除筛选" : "清除排序"}</button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className={styles.options} aria-label="查询预览选项" disabled={disabled || busy} loading={previewBusy}><DotsThree size={18} weight="bold" /></Button></DropdownMenuTrigger><DropdownMenuContent className={styles.popoverMenu} data-table-query-menu="" align="end" density="compact"><DropdownMenuItem disabled={controlsDisabled} onSelect={() => void previewQuery()}><Eye />预览数据库查询</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header>
      <div className={styles.editor}>
        {tab === "filter" ? <TableFilterBuilder node={filter} columns={page.columns} disabled={controlsDisabled} onChange={value => { if (value.kind === "group") setFilter(value); changed() }} onOnly={onlyId => { const value = isolateFilter(filter, onlyId); if (value.kind === "group") setFilter(value); changed() }} /> : <TableSortBuilder sort={sort} columns={page.columns} disabled={controlsDisabled} onChange={value => { setSort(value); changed() }} />}
      </div>
      {preview && <div className={styles.preview} aria-label="查询 SQL 预览"><header><strong>查询 SQL</strong><button type="button" className="fouc-action" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "已复制" : "复制 SQL 与参数"}</button></header><pre>{preview.statement.sql}</pre><small>绑定参数</small><pre>{JSON.stringify(preview.statement.parameters, null, 2)}</pre></div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <footer className={styles.popoverFooter}>
        {tab === "filter" ? <div className={styles.addCondition}><button type="button" className="fouc-action" disabled={controlsDisabled} onClick={() => { setFilter({ ...filter, children: [...filter.children, newCondition("")] }); changed() }}><Plus size={16} />新增条件</button><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="fouc-action" disabled={controlsDisabled} title="添加条件分组" aria-label="添加条件分组"><CaretDown size={12} /></button></DropdownMenuTrigger><DropdownMenuContent className={styles.popoverMenu} data-table-query-menu="" density="compact" align="start"><DropdownMenuItem disabled={controlsDisabled} onSelect={() => { setFilter({ ...filter, children: [...filter.children, newGroup([newCondition("")])] }); changed() }}><Plus />新增条件分组</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div> : <button type="button" className="fouc-action" disabled={controlsDisabled || sort.length >= 8 || sort.length >= page.columns.length} onClick={() => { setSort([...sort, newSort()]); changed() }}><Plus size={16} />新增字段</button>}
        <span className={styles.spacer} />
        <button type="button" className="fouc-action" disabled={controlsDisabled} onClick={() => { if (tab === "filter") setFilter(initialFilter()); else setSort(initialSort()); changed() }}>{tab === "filter" ? "重置条件" : "重置排序"}</button>
        <button type="button" className={styles.apply} disabled={controlsDisabled} onClick={() => apply()}>{tab === "filter" ? "应用筛选" : "应用排序"}</button>
      </footer>
    </TableQueryPopover>
  </section>
}
