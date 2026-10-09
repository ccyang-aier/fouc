"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { createPortal } from "react-dom"
import { Funnel, MagnifyingGlass, ArrowsClockwise, Eye, Copy, Check, CaretDown, ArrowsDownUp, Timer } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { RelationalTablePage, RelationalTableQuery, RelationalTableQueryPreview } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { buildFilter, draftFilter } from "./table-filter-model"
import { TableFilterBuilder } from "./table-filter-builder"
import { TableSortBuilder } from "./table-sort-builder"
import styles from "./table-query.module.css"
import common from "./relational.module.css"

export function TableQueryControls({
  base,
  schema,
  page,
  query,
  limit,
  search,
  open,
  disabled,
  busy,
  onToggle,
  onSearch,
  onApply,
  onLimit,
  onRefresh,
  active = true,
  footerTarget,
  onActionTarget
}: {
  base: string
  schema: string
  page: RelationalTablePage
  query: RelationalTableQuery
  limit: number
  search: string
  open: boolean
  disabled: boolean
  busy: boolean
  onToggle: () => void
  onSearch: (text: string) => void
  onApply: (query: RelationalTableQuery) => void
  onLimit: (size: number) => void
  onRefresh: () => void
  active?: boolean
  footerTarget?: HTMLElement | null
  onActionTarget?: (node: HTMLDivElement | null) => void
}) {
  const [filter, setFilter] = useState(() => draftFilter(query.filter, page.columns))
  const [sort, setSort] = useState(query.sort)
  const [tab, setTab] = useState<"filter" | "sort">("filter")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<RelationalTableQueryPreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [autoSeconds, setAutoSeconds] = useState(0)
  const autoRefresh = useEffectEvent(() => { if (active && !disabled && !busy && !previewBusy) onRefresh() })
  useEffect(() => {
    if (!autoSeconds) return
    const timer = window.setInterval(() => autoRefresh(), autoSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [autoSeconds])
  const controlsDisabled = disabled || busy || previewBusy
  function show(next: "filter" | "sort") { setTab(next); if (!open || tab === next) onToggle() }
  const pageSize = <select aria-label="每页行数" disabled={disabled || busy} value={limit} onChange={event => onLimit(Number(event.target.value))}>{[25, 50, 100, 250, 500].map(size => <option key={size} value={size}>{size} 行 / 页</option>)}</select>
  function build(): RelationalTableQuery {
    return { filter: buildFilter(filter, page.columns), sort }
  }
  async function previewQuery() {
    setError("")
    setPreview(null)
    setPreviewBusy(true)
    try {
      setPreview(
        await backendFetch<RelationalTableQueryPreview>(
          `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(page.table)}/rows/preview`,
          { method: "POST", body: JSON.stringify({ ...build(), offset: 0, limit }) }
        )
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法预览查询")
    } finally {
      setPreviewBusy(false)
    }
  }
  function apply() {
    setError("")
    try {
      onApply(build())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "条件无效")
    }
  }
  async function copy() {
    if (!preview) return
    try {
      await navigator.clipboard.writeText(
        preview.statement.sql + "\n-- 绑定参数: " + JSON.stringify(preview.statement.parameters)
      )
      setCopied(true)
    } catch {
      setError("无法访问剪贴板，请选中 SQL 手动复制")
    }
  }
  return (
    <section className={styles.controls} aria-label="表查询控制">
      <div className={styles.toolbar}>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={`fouc-action ${styles.rowScope}`}>{search ? "当前页搜索" : "全部行"}<CaretDown size={11} /></button></DropdownMenuTrigger><DropdownMenuContent align="start"><label className={styles.pageSearch}><MagnifyingGlass size={13} /><input aria-label="当前页搜索" value={search} placeholder="搜索当前页" onChange={event => onSearch(event.target.value)} /></label></DropdownMenuContent></DropdownMenu>
        <button type="button" className={styles.condition} data-kind="where" aria-label="WHERE 筛选条件" aria-expanded={open && tab === "filter"} disabled={disabled || busy} onClick={() => show("filter")}><Funnel size={14} /><b>WHERE</b><span>{query.filter ? "已应用筛选" : ""}</span><CaretDown size={11} /></button>
        <button type="button" className={styles.condition} data-kind="sort" aria-label="ORDER BY 排序规则" aria-expanded={open && tab === "sort"} disabled={disabled || busy} onClick={() => show("sort")}><ArrowsDownUp size={14} /><b>ORDER BY</b><span>{query.sort.map(item => `${item.column} ${item.direction.toUpperCase()}`).join(", ")}</span><CaretDown size={11} /></button>
        <button type="button" aria-label="刷新表数据" disabled={disabled || busy} onClick={onRefresh}>
          <ArrowsClockwise size={14} />刷新
        </button>
        <label className={styles.auto}><Timer size={14} /><select aria-label="自动刷新表数据" value={autoSeconds} onChange={event => setAutoSeconds(Number(event.target.value))}><option value={0}>自动</option>{[5, 10, 30, 60].map(seconds => <option key={seconds} value={seconds}>{seconds}s</option>)}</select></label>
        <div ref={onActionTarget} className={styles.actionTarget} />
        {footerTarget ? createPortal(pageSize, footerTarget) : null}
      </div>
      {open && (
        <div className={styles.panel}>
          <div className={styles.tabs} role="tablist" aria-label="筛选与排序编辑">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "filter"}
              onClick={() => setTab("filter")}
            >
              筛选条件
            </button>
            <button type="button" role="tab" aria-selected={tab === "sort"} onClick={() => setTab("sort")}>
              排序规则{sort.length ? ` (${sort.length})` : ""}
            </button>
            <span>编辑后点击应用，在完整表上执行</span>
          </div>
          <div
            className={styles.editor}
            role="tabpanel"
            aria-label={tab === "filter" ? "筛选条件" : "排序规则"}
          >
            {tab === "filter" ? (
              <TableFilterBuilder
                node={filter}
                columns={page.columns}
                disabled={controlsDisabled}
                onChange={(value) => {
                  if (value.kind === "group") setFilter(value)
                  setPreview(null)
                  setCopied(false)
                }}
              />
            ) : (
              <TableSortBuilder
                sort={sort}
                columns={page.columns}
                disabled={controlsDisabled}
                onChange={(value) => {
                  setSort(value)
                  setPreview(null)
                  setCopied(false)
                }}
              />
            )}
          </div>
          {preview && (
            <div className={styles.preview} aria-label="查询 SQL 预览">
              <header>
                <strong>数据库查询预览</strong>
                <button type="button" onClick={() => void copy()}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "已复制" : "复制 SQL 与参数"}
                </button>
              </header>
              <pre>{preview.statement.sql}</pre>
              <small>绑定参数 · 分页多读一行判断下一页</small>
              <pre>{JSON.stringify(preview.statement.parameters, null, 2)}</pre>
            </div>
          )}
          {error && (
            <p role="alert" className={common.error}>
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              disabled={controlsDisabled}
              onClick={() => {
                setFilter(draftFilter(query.filter, page.columns))
                setSort(query.sort)
                setError("")
                setPreview(null)
              }}
            >
              重置草稿
            </button>
            <button
              type="button"
              disabled={controlsDisabled}
              onClick={() => onApply({ filter: null, sort: [] })}
            >
              清除筛选与排序
            </button>
            <span />
            <button type="button" disabled={controlsDisabled} onClick={() => void previewQuery()}>
              <Eye size={13} />
              {previewBusy ? "生成预览…" : "预览查询"}
            </button>
            <button type="button" className={common.primary} disabled={controlsDisabled} onClick={apply}>
              应用到数据库
            </button>
          </footer>
          {disabled && <p className={styles.pending}>先提交或放弃表格变更，再修改数据库查询条件。</p>}
        </div>
      )}
    </section>
  )
}
