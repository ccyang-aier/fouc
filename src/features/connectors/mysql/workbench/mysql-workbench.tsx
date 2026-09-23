"use client"

import { useCallback, useState } from "react"
import { ArrowLeft, CaretRight, FileCode, Plus, Table, X } from "@phosphor-icons/react"

import { AppAlert, type AppAlertMessage } from "@/components/app-alert"
import type { MysqlConnection } from "../mysql-connections-data"
import { DEFAULT_SQL, getInitialRows, type DataRow, type WorkbenchTab } from "./mysql-workbench-data"
import { MysqlWorkbenchExplorer } from "./mysql-workbench-explorer"
import { MysqlWorkbenchGrid } from "./mysql-workbench-grid"
import { MysqlWorkbenchInspector } from "./mysql-workbench-inspector"
import { MysqlWorkbenchSql } from "./mysql-workbench-sql"
import "./mysql-workbench.css"

const INITIAL_TABS: WorkbenchTab[] = [
  { id: "table-customers", kind: "table", title: "customers", table: "customers" },
  { id: "table-orders", kind: "table", title: "orders", table: "orders" },
  { id: "sql-order-query", kind: "sql", title: "订单查询.sql" },
]

export function MysqlWorkbench({ connection, onBack, onConnectorBack }: { connection: MysqlConnection; onBack: () => void; onConnectorBack: () => void }) {
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [tabs, setTabs] = useState<WorkbenchTab[]>(INITIAL_TABS)
  const [activeTabId, setActiveTabId] = useState("table-customers")
  const [inspectorView, setInspectorView] = useState<"ai" | "info">("info")
  const [infoMode, setInfoMode] = useState<"row" | "schema">("row")
  const [selectedRowId, setSelectedRowId] = useState<number | null>(1003)
  const [draftRows, setDraftRows] = useState<Record<string, DataRow[]>>(() => ({ customers: getInitialRows("customers"), orders: getInitialRows("orders") }))
  const [committedRows, setCommittedRows] = useState<Record<string, DataRow[]>>(() => ({ customers: getInitialRows("customers"), orders: getInitialRows("orders") }))
  const [pendingByTable, setPendingByTable] = useState<Record<string, number>>({})
  const [sqlByTab, setSqlByTab] = useState<Record<string, string>>({ "sql-order-query": DEFAULT_SQL })
  const [aiFilter, setAiFilter] = useState<{ field: string; value: string } | null>(null)
  const [alert, setAlert] = useState<AppAlertMessage | null>(null)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const activeTable = activeTab.kind === "table" ? activeTab.table ?? "customers" : null
  const currentRows = activeTable ? draftRows[activeTable] ?? getInitialRows(activeTable) : []
  const selectedRow = currentRows.find((row) => Number(row.id) === selectedRowId) ?? null

  const notify = useCallback((title: string, tone: AppAlertMessage["tone"] = "success") => setAlert({ id: Date.now(), title, tone }), [])

  function openTable(table: string) {
    const id = `table-${table}`
    setTabs((current) => current.some((tab) => tab.id === id) ? current : [...current, { id, kind: "table", title: table, table }])
    setActiveTabId(id)
    setSelectedRowId(table === "customers" ? 1003 : null)
    setInfoMode("row")
    setAiFilter(null)
  }

  function newQuery() {
    const id = `sql-${Date.now()}`
    const title = `查询 ${tabs.filter((tab) => tab.kind === "sql").length + 1}.sql`
    setTabs((current) => [...current, { id, kind: "sql", title }])
    setSqlByTab((current) => ({ ...current, [id]: "SELECT *\nFROM orders.customers\nLIMIT 100;" }))
    setActiveTabId(id)
  }

  function closeTab(id: string) {
    if (tabs.length === 1) { notify("至少保留一个工作标签", "info"); return }
    const index = tabs.findIndex((tab) => tab.id === id)
    const next = tabs.filter((tab) => tab.id !== id)
    setTabs(next)
    if (activeTabId === id) setActiveTabId(next[Math.min(index, next.length - 1)].id)
  }

  function changeRows(rows: DataRow[]) {
    if (!activeTable) return
    setDraftRows((current) => ({ ...current, [activeTable]: rows }))
    const saved = committedRows[activeTable] ?? getInitialRows(activeTable)
    const savedById = new Map(saved.map((row) => [Number(row.id), row]))
    const draftIds = new Set(rows.map((row) => Number(row.id)))
    const changed = rows.filter((row) => JSON.stringify(row) !== JSON.stringify(savedById.get(Number(row.id)))).length
      + saved.filter((row) => !draftIds.has(Number(row.id))).length
    setPendingByTable((current) => ({ ...current, [activeTable]: changed }))
  }

  function commitRows() {
    if (!activeTable || !pendingByTable[activeTable]) { notify("没有待提交的更改", "info"); return }
    setCommittedRows((current) => ({ ...current, [activeTable]: currentRows }))
    setPendingByTable((current) => ({ ...current, [activeTable]: 0 }))
    notify("更改已提交到本地示例数据")
  }

  function rollbackRows() {
    if (!activeTable || !pendingByTable[activeTable]) { notify("没有可回滚的更改", "info"); return }
    setDraftRows((current) => ({ ...current, [activeTable]: committedRows[activeTable] ?? getInitialRows(activeTable) }))
    setPendingByTable((current) => ({ ...current, [activeTable]: 0 }))
    notify("未提交的更改已回滚", "info")
  }

  function updateFromInspector(values: DataRow) {
    if (!activeTable) return
    changeRows(currentRows.map((row) => Number(row.id) === Number(values.id) ? values : row))
  }

  function applyAiFilter(field: string, value: string) {
    if (!activeTable) openTable("customers")
    setAiFilter({ field, value })
  }

  return <section aria-label={`${connection.name} MySQL 工作台`} className="mw">
    <header className="mw-breadcrumb"><button type="button" aria-label="返回 MySQL 连接列表" onClick={onBack}><ArrowLeft size={15} /></button><nav aria-label="面包屑"><button type="button" onClick={onConnectorBack}>连接器</button><CaretRight size={11} /><button type="button" onClick={onBack}>MySQL</button><CaretRight size={11} /><span>{connection.name}</span></nav></header>
    <div className="mw-body">
      <MysqlWorkbenchExplorer connection={connection} collapsed={explorerCollapsed} activeTable={activeTable} onCollapse={() => setExplorerCollapsed((value) => !value)} onOpenTable={openTable} onNewQuery={newQuery} onRefresh={() => notify("数据库资源已刷新")} onNotice={(message) => notify(message, "info")} />
      <main className="mw-center">
        <div className="mw-document-tabs" role="tablist" aria-label="打开的工作标签">{tabs.map((tab) => <div key={tab.id} className={`mw-document-tab ${activeTabId === tab.id ? "mw-document-active" : ""}`}><button type="button" role="tab" aria-selected={activeTabId === tab.id} onClick={() => { setActiveTabId(tab.id); setInfoMode("row"); setAiFilter(null) }}>{tab.kind === "sql" ? <FileCode size={15} /> : <Table size={15} />}<span>{tab.title}</span></button><button type="button" aria-label={`关闭 ${tab.title}`} className="mw-close-tab" onClick={() => closeTab(tab.id)}><X size={12} /></button></div>)}<button type="button" className="mw-new-tab" aria-label="新建 SQL 查询" title="新建 SQL 查询" onClick={newQuery}><Plus size={17} /></button><button type="button" className="mw-tabs-more" aria-label="更多标签" title="更多标签" onClick={() => notify(`已打开 ${tabs.length} 个标签`, "info")}>···</button></div>
        {activeTab.kind === "table" ? <MysqlWorkbenchGrid key={activeTab.id} table={activeTable ?? "customers"} rows={currentRows} pendingCount={pendingByTable[activeTable ?? "customers"] ?? 0} selectedRowId={selectedRowId} onSelectRow={(id) => { setSelectedRowId(id); setInfoMode("row"); setInspectorView("info") }} onRowsChange={changeRows} onCommit={commitRows} onRollback={rollbackRows} onShowTableInfo={() => { setInfoMode("schema"); setInspectorView("info") }} onNotice={(message) => notify(message, "info")} appliedFilter={aiFilter} onClearAppliedFilter={() => setAiFilter(null)} /> : <MysqlWorkbenchSql key={activeTab.id} title={activeTab.title} query={sqlByTab[activeTab.id] ?? DEFAULT_SQL} onQueryChange={(query) => setSqlByTab((current) => ({ ...current, [activeTab.id]: query }))} onNotice={(message) => notify(message, "info")} />}
      </main>
      <MysqlWorkbenchInspector table={activeTable ?? "customers"} row={selectedRow} view={inspectorView} infoMode={infoMode} onViewChange={setInspectorView} onUpdateRow={updateFromInspector} onOpenOrders={() => openTable("orders")} onApplyFilter={applyAiFilter} onNotice={(message) => notify(message, "info")} />
    </div>
    <AppAlert alert={alert} onClose={() => setAlert(null)} duration={3200} />
  </section>
}
