"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowUUpLeft, ArrowsClockwise, CaretDown, CaretDoubleLeft, CaretDoubleRight,
  CaretLeft, CaretRight, Database, GridFour, MagnifyingGlass, Table,
} from "@phosphor-icons/react"
import { canUseDatabaseCapability, type DatabaseCapabilitySnapshot, type DatabaseCell, type DatabaseObjectInfo, type DatabaseTablePage } from "@fouc/shared"

import { backendFetch } from "@/lib/backend"
import type { MysqlConnection } from "../mysql-connections-data"
import "./mysql-workbench.css"

type Props = { connection: MysqlConnection; onBack: () => void; onConnectorBack: () => void }

function cellText(value: DatabaseCell): string {
  if (value === null) return "NULL"
  if (typeof value === "object") return !Array.isArray(value) && value.type === "binary" ? "[二进制数据]" : JSON.stringify(value)
  return String(value)
}

export function MysqlLiveWorkbench({ connection, onBack, onConnectorBack }: Props) {
  const sessionId = connection.liveSessionId!
  const [capabilities, setCapabilities] = useState<DatabaseCapabilitySnapshot | null>(null)
  const [databases, setDatabases] = useState<DatabaseObjectInfo[]>([])
  const [database, setDatabase] = useState("")
  const [tables, setTables] = useState<DatabaseObjectInfo[]>([])
  const [openTables, setOpenTables] = useState<string[]>([])
  const [table, setTable] = useState("")
  const [page, setPage] = useState<DatabaseTablePage | null>(null)
  const [offset, setOffset] = useState(0)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [inspectorView, setInspectorView] = useState<"ai" | "info">("info")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState<"connection" | "tables" | "rows" | null>("connection")
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setLoading("connection")
    setError("")
    setPage(null)
    setSelectedRow(null)
    setRefreshKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      backendFetch<DatabaseCapabilitySnapshot>(`/api/database/connections/${sessionId}/capabilities`),
      backendFetch<DatabaseObjectInfo[]>(`/api/database/mysql/sessions/${sessionId}/databases`),
    ]).then(([snapshot, items]) => {
      if (cancelled) return
      setCapabilities(snapshot)
      setDatabases(items)
      setDatabase((current) => current && items.some((item) => item.name === current) ? current
        : items.some((item) => item.name === connection.database) ? connection.database
          : items.find((item) => !["information_schema", "mysql", "performance_schema", "sys"].includes(item.name))?.name ?? items[0]?.name ?? "")
      setLoading("tables")
    }).catch((reason) => {
      if (cancelled) return
      setCapabilities(null)
      setError(reason instanceof Error ? reason.message : "连接已断开")
      setLoading(null)
    })
    return () => { cancelled = true }
  }, [connection.database, sessionId, refreshKey])

  useEffect(() => {
    if (!database || !canUseDatabaseCapability(capabilities, "metadataBrowse")) return
    let cancelled = false
    void backendFetch<DatabaseObjectInfo[]>(`/api/database/mysql/sessions/${sessionId}/databases/${encodeURIComponent(database)}/tables`)
      .then((items) => {
        if (cancelled) return
        setTables(items)
        setLoading(null)
      }).catch((reason) => {
        if (cancelled) return
        setTables([])
        setError(reason instanceof Error ? reason.message : "表列表读取失败")
        setLoading(null)
      })
    return () => { cancelled = true }
  }, [capabilities, database, sessionId, refreshKey])

  useEffect(() => {
    if (!database || !table || !canUseDatabaseCapability(capabilities, "metadataBrowse")) return
    let cancelled = false
    void backendFetch<DatabaseTablePage>(`/api/database/mysql/sessions/${sessionId}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/rows?offset=${offset}&limit=100`)
      .then((result) => {
        if (cancelled) return
        setPage(result)
        setLoading(null)
      }).catch((reason) => {
        if (cancelled) return
        setPage(null)
        setError(reason instanceof Error ? reason.message : "表数据读取失败")
        setLoading(null)
      })
    return () => { cancelled = true }
  }, [capabilities, database, table, offset, sessionId, refreshKey])

  const visibleTables = useMemo(() => tables.filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [tables, search])
  const columns = page?.columns ?? []
  const gridColumns = `38px ${columns.map(() => "minmax(120px, 1fr)").join(" ")}`
  const gridWidth = Math.max(38 + columns.length * 120, 700)
  const selected = selectedRow === null ? null : page?.rows[selectedRow] ?? null

  function openTable(name: string) {
    setLoading("rows")
    setError("")
    setOpenTables((current) => current.includes(name) ? current : [...current, name])
    setTable(name)
    setOffset(0)
    setPage(null)
    setSelectedRow(null)
  }

  function closeTable(name: string) {
    const next = openTables.filter((item) => item !== name)
    setOpenTables(next)
    if (table === name) { setTable(next.at(-1) ?? ""); setPage(null); setSelectedRow(null); setOffset(0) }
  }

  return <section aria-label={`${connection.name} MySQL 工作台`} className="mw">
    <header className="mw-breadcrumb"><button type="button" aria-label="返回 MySQL 连接列表" onClick={onBack}><ArrowUUpLeft size={16} /></button><nav aria-label="面包屑"><button type="button" onClick={onConnectorBack}>连接器</button><span className="mw-breadcrumb-separator">/</span><button type="button" onClick={onBack}>MySQL</button><span className="mw-breadcrumb-separator">/</span><span>{connection.name}</span></nav></header>
    <div className="mw-body">
      <aside className={`mw-explorer ${explorerCollapsed ? "mw-explorer-collapsed" : ""}`} aria-label="数据库资源">
        {explorerCollapsed ? <button type="button" className="mw-icon-button" aria-label="展开数据库资源" onClick={() => setExplorerCollapsed(false)}><CaretDoubleRight size={15} /></button> : <>
          <div className="mw-explorer-head"><strong>数据库资源</strong><div className="mw-head-actions"><button type="button" className="mw-icon-button" aria-label="刷新数据库资源" onClick={refresh}><ArrowsClockwise size={15} /></button><button type="button" className="mw-icon-button" aria-label="收起数据库资源" onClick={() => setExplorerCollapsed(true)}><CaretDoubleLeft size={14} /></button></div></div>
          <div className="mw-search-row"><label className="mw-search"><MagnifyingGlass size={14} /><input aria-label="搜索表名" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索表名或视图" /></label></div>
          <div className="mw-tree-scroll"><div className="mw-tree-row mw-connection-row"><CaretDown size={12} /><Database size={16} className="mw-mysql-icon" /><span className="mw-ellipsis">MySQL - {connection.name}</span><span className="mw-online-dot" /></div>
            {databases.map((item) => <div key={item.name}><button type="button" className={`mw-tree-row mw-schema-row ${database === item.name ? "mw-tree-selected" : ""}`} onClick={() => { setLoading("tables"); setError(""); setDatabase(item.name); setTables([]); setOpenTables([]); setTable(""); setPage(null) }}><span>{database === item.name ? <CaretDown size={12} /> : <CaretRight size={12} />}</span><Database size={15} className="mw-schema-icon" /><span className="mw-ellipsis">{item.name}</span></button>
              {database === item.name && <><div className="mw-tree-row mw-group-row"><CaretDown size={12} /><Table size={15} className="mw-folder-icon" /><span>表与视图</span><span className="mw-tree-count">({tables.length})</span></div>{visibleTables.map((entry) => <button type="button" key={entry.name} className={`mw-tree-row mw-table-row ${table === entry.name ? "mw-tree-selected" : ""}`} onClick={() => openTable(entry.name)}><CaretRight size={12} /><GridFour size={15} weight="duotone" className="mw-blue" /><span className="mw-ellipsis">{entry.name}</span></button>)}</>}
            </div>)}
          </div>
        </>}
      </aside>
      <main className="mw-center">
        <div className="mw-tab-strip"><div className="mw-document-tabs" role="tablist" aria-label="打开的工作标签">{openTables.map((name) => <div key={name} className={`mw-document-tab ${table === name ? "mw-document-active" : ""}`}><button type="button" role="tab" aria-selected={table === name} onClick={() => { setLoading("rows"); setError(""); setTable(name); setPage(null); setOffset(0); setSelectedRow(null) }}><GridFour size={15} weight="duotone" /><span>{name}</span></button><button type="button" className="mw-close-tab" aria-label={`关闭 ${name}`} onClick={() => closeTable(name)}>×</button></div>)}</div></div>
        {error && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error} <button type="button" onClick={refresh} className="ml-2 underline">重试</button></div>}
        {!canUseDatabaseCapability(capabilities, "metadataBrowse") ? <div className="m-auto text-xs text-[var(--muted-strong)]">{loading ? "正在验证连接…" : "当前连接没有已验证的元数据浏览能力"}</div>
          : !table ? <div className="m-auto text-xs text-[var(--muted-strong)]">从左侧选择一张表或视图</div>
            : <div className="mw-grid-workspace"><div className="mw-table-heading"><div className="mw-table-identity"><GridFour size={17} weight="duotone" className="mw-blue" /><strong>{table}</strong><span>{connection.name} / {database} / {table}</span></div><div className="mw-table-heading-end"><span>{columns.length} 字段</span><button type="button" className="mw-tool-button" onClick={refresh}><ArrowsClockwise size={14} />刷新</button></div></div>
              <div className="mw-sheet-body"><div className="mw-sheet-scroll"><div role="grid" aria-label={`${table} 数据表`} className="mw-data-grid" style={{ width: `max(100%, ${gridWidth}px)` }}><div role="row" className="mw-grid-header" style={{ gridTemplateColumns: gridColumns }}><div className="mw-row-number">#</div>{columns.map((column) => <div role="columnheader" key={column.name} className="mw-column-head"><strong>{column.name}</strong><small>{column.dataType}</small></div>)}</div>{page?.rows.map((row, index) => <div role="row" key={`${offset}-${index}`} className={`mw-grid-row ${selectedRow === index ? "mw-row-active" : ""}`} style={{ gridTemplateColumns: gridColumns }}><div role="rowheader" className="mw-row-number">{offset + index + 1}</div>{row.map((cell, columnIndex) => <button type="button" role="gridcell" aria-selected={selectedRow === index} key={columnIndex} className="mw-grid-cell" onClick={() => { setSelectedRow(index); setInspectorView("info") }} title={cellText(cell)}><span>{cellText(cell)}</span></button>)}</div>)}</div>{loading === "rows" && <p className="p-4 text-xs text-[var(--muted-strong)]">正在读取表数据…</p>}{page && page.rows.length === 0 && <p className="p-4 text-xs text-[var(--muted-strong)]">此页没有记录</p>}</div></div>
              <div className="mw-grid-footer mw-live-footer"><span>只读预览 · {page?.rows.length ?? 0} 行</span><span className="ml-auto">{page?.rows.length ? offset + 1 : 0}–{offset + (page?.rows.length ?? 0)}</span><button type="button" className="mw-tool-button" disabled={offset === 0 || loading === "rows"} onClick={() => { setLoading("rows"); setPage(null); setSelectedRow(null); setOffset(Math.max(0, offset - 100)) }}><CaretLeft size={13} />上一页</button><button type="button" className="mw-tool-button" disabled={!page?.hasMore || loading === "rows"} onClick={() => { setLoading("rows"); setPage(null); setSelectedRow(null); setOffset(offset + 100) }}>下一页<CaretRight size={13} /></button></div>
            </div>}
      </main>
      <aside className={`mw-inspector ${inspectorCollapsed ? "mw-inspector-collapsed" : ""}`} aria-label="信息侧栏">{inspectorCollapsed ? <button type="button" className="mw-inspector-expand" aria-label="展开信息侧栏" onClick={() => setInspectorCollapsed(false)}><CaretDoubleLeft size={16} /></button> : <><div className="mw-inspector-head"><div className="mw-inspector-tabs"><button type="button" className={inspectorView === "ai" ? "mw-inspector-tab-active" : ""} onClick={() => setInspectorView("ai")}>AI 助手</button><button type="button" className={inspectorView === "info" ? "mw-inspector-tab-active" : ""} onClick={() => setInspectorView("info")}>信息详情</button></div><button type="button" className="mw-inspector-toggle" aria-label="收起信息侧栏" onClick={() => setInspectorCollapsed(true)}><CaretDoubleRight size={14} /></button></div><div className="min-h-0 flex-1 overflow-auto p-4 text-[11px]">{inspectorView === "ai" ? <p className="text-[var(--muted-strong)]">AI 助手将在连接上下文与执行安全策略接入后开放。</p> : selected && page ? <><strong className="text-[12px]">{table} · 第 {offset + selectedRow! + 1} 行</strong><div className="mt-3 border-t border-[var(--mw-line)]">{columns.map((column, index) => <div key={column.name} className="grid grid-cols-[110px_1fr] gap-3 border-b border-[var(--mw-line)] py-2"><span className="truncate text-[var(--muted-strong)]" title={column.name}>{column.name}</span><span className="break-all text-[var(--ink)]">{cellText(selected[index] ?? null)}</span></div>)}</div></> : <p className="text-[var(--muted-strong)]">选择一行查看字段与值。</p>}</div></>}</aside>
    </div>
  </section>
}
