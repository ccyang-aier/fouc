"use client"

import { useState } from "react"
import { Funnel, MagnifyingGlass, ArrowsClockwise, Eye, Copy, Check } from "@phosphor-icons/react"
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
  onRefresh
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
}) {
  const [filter, setFilter] = useState(() => draftFilter(query.filter, page.columns))
  const [sort, setSort] = useState(query.sort)
  const [tab, setTab] = useState<"filter" | "sort">("filter")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<RelationalTableQueryPreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const controlsDisabled = disabled || busy || previewBusy
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
        <button
          type="button"
          aria-expanded={open}
          className={query.filter || query.sort.length ? styles.active : ""}
          onClick={onToggle}
        >
          <Funnel size={14} />
          筛选与排序{query.filter || query.sort.length ? " · 已应用" : ""}
        </button>
        <label className={styles.pageSearch}>
          <MagnifyingGlass size={13} />
          <input
            aria-label="当前页搜索"
            value={search}
            placeholder="搜索当前页"
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <span className={styles.scope}>WHERE / ORDER BY 在数据库执行</span>
        <select
          aria-label="每页行数"
          disabled={disabled || busy}
          value={limit}
          onChange={(event) => onLimit(Number(event.target.value))}
        >
          {[25, 50, 100, 250, 500].map((size) => (
            <option key={size} value={size}>
              {size} 行 / 页
            </option>
          ))}
        </select>
        <button type="button" aria-label="刷新表数据" disabled={disabled || busy} onClick={onRefresh}>
          <ArrowsClockwise size={14} />
        </button>
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
