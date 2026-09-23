"use client"

import { useState } from "react"
import { ArrowRight, ArrowSquareOut, Check, Copy, DownloadSimple, PaperPlaneTilt, PencilSimple, Robot, Sparkle, X } from "@phosphor-icons/react"

import type { CellSelection, DataRow } from "./mysql-workbench-data"
import { getColumns } from "./mysql-workbench-data"

type Props = {
  table: string
  row: DataRow | null
  rows: DataRow[]
  orders: DataRow[]
  customers: DataRow[]
  selection: CellSelection | null
  view: "ai" | "info"
  infoMode: "row" | "schema"
  onViewChange: (view: "ai" | "info") => void
  onUpdateRow: (values: DataRow) => void
  onOpenTable: (table: string) => void
  onApplyFilter: (field: string, value: string) => void
  onNotice: (message: string) => void
}

type Message = { role: "user" | "assistant"; content: string; sql?: string }

const FIELD_LABELS: Record<string, string> = {
  id: "id", name: "name", customer_type: "customer_type", city: "city", contact: "contact",
  phone: "phone", created_at: "created_at", status: "status", order_no: "order_no",
  customer_id: "customer_id", total_amount: "total_amount",
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  id: "唯一标识", name: "名称", customer_type: "客户类型（个人 / 企业）", city: "所在城市",
  contact: "联系人", phone: "联系电话", created_at: "创建时间", status: "当前状态",
  order_no: "订单编号", customer_id: "关联客户 ID", total_amount: "订单金额",
}

export function MysqlWorkbenchInspector({ table, row, rows, orders, customers, selection, view, infoMode, onViewChange, onUpdateRow, onOpenTable, onApplyFilter, onNotice }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DataRow>({})
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const selectedRows = selection ? selection.rowIds.map((id) => rows.find((item) => Number(item.id) === id)).filter((item): item is DataRow => !!item) : []
  const selectedColumns = selection ? getColumns(table).filter((column) => selection.columnKeys.includes(column.key)) : []
  const showSelection = !!selection && selectedRows.length > 0 && (selectedRows.length > 1 || selectedColumns.length < getColumns(table).length)
  const selectedData = selectedRows.map((item) => Object.fromEntries(selectedColumns.map((column) => [column.key, item[column.key]])))
  const customerOrders = row && table === "customers" ? orders.filter((item) => Number(item.customer_id) === Number(row.id)) : []
  const relatedCustomer = row && table === "orders" ? customers.find((item) => Number(item.id) === Number(row.customer_id)) : null
  const spent = customerOrders.reduce((total, item) => total + Number(item.total_amount ?? 0), 0)

  function beginEdit() {
    if (!row) return
    setDraft({ ...row })
    setEditing(true)
  }

  function saveEdit() {
    onUpdateRow(draft)
    setEditing(false)
    onNotice("记录已修改，点击数据表中的「提交」保存")
  }

  async function copy(value: string, label = "内容") {
    try { await navigator.clipboard.writeText(value); onNotice(`${label}已复制`) }
    catch { onNotice("复制失败，请检查浏览器剪贴板权限") }
  }

  function exportJson() {
    if (!row) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${table}-${row.id}.json`
    link.click()
    URL.revokeObjectURL(url)
    onNotice("记录已导出为 JSON")
  }

  function exportSelection() {
    if (!selectedData.length) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(selectedData, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${table}-selection.json`
    link.click()
    URL.revokeObjectURL(url)
    onNotice(`已导出 ${selectedRows.length} 行选中数据`)
  }

  function openRecordWindow() {
    if (!row) return
    const lines = Object.entries(row).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`).join("")
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(table)} #${row.id}</title><style>body{font:13px Arial,sans-serif;margin:32px;color:#202126}h1{font-size:18px}table{border-collapse:collapse;width:100%;max-width:720px}th,td{padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:left}th{width:180px;color:#666}</style><h1>${escapeHtml(table)} · #${row.id}</h1><table>${lines}</table></html>`
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
    window.open(url, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  function send(question: string) {
    const text = question.trim()
    if (!text) return
    const field = text.includes("城市") || text.includes("广州") ? "city" : text.includes("企业") ? "customer_type" : "status"
    const value = field === "city" ? "广州" : field === "customer_type" ? "企业" : "正常"
    const sql = `SELECT * FROM \`orders\`.\`${table}\` WHERE \`${field}\` = '${value}' LIMIT 1000;`
    setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: `已根据当前 ${table} 表生成筛选语句。可以复制 SQL，或直接应用到数据表。`, sql }])
    setPrompt("")
  }

  return <aside className="mw-inspector" aria-label="MySQL 工作台侧栏">
    <div className="mw-inspector-tabs" role="tablist" aria-label="侧栏视图"><button type="button" role="tab" aria-selected={view === "ai"} className={view === "ai" ? "mw-inspector-tab-active" : ""} onClick={() => onViewChange("ai")}>AI 助手</button><button type="button" role="tab" aria-selected={view === "info"} className={view === "info" ? "mw-inspector-tab-active" : ""} onClick={() => onViewChange("info")}>信息详情</button></div>
    {view === "info" ? <div className="mw-info-scroll">
      {infoMode === "schema" ? <><div className="mw-info-heading"><strong>{table} · 表结构</strong></div><div className="mw-info-fields">{getColumns(table).map((column) => <div className="mw-info-field" key={column.key}><span>{column.label}</span><strong>{column.type}</strong></div>)}</div><div className="mw-info-section"><h3>数据库对象</h3><div className="mw-info-relation"><span>数据库</span><strong>orders</strong></div><div className="mw-info-relation"><span>表名</span><strong>{table}</strong></div></div></> : showSelection ? <>
        <div className="mw-info-heading"><strong>选中内容</strong><span className="mw-selection-count">{selectedRows.length} 行 · {selectedColumns.length} 列</span></div>
        <div className="mw-info-section"><h3>选区范围</h3><div className="mw-info-relation"><span>数据表</span><strong>{table}</strong></div><div className="mw-info-relation"><span>行 ID</span><strong>{selectedRows.length === 1 ? selectedRows[0].id : `${selectedRows[0].id} — ${selectedRows.at(-1)?.id}`}</strong></div><div className="mw-info-relation"><span>字段</span><strong className="mw-selection-field-list">{selectedColumns.map((column) => column.label).join("、")}</strong></div></div>
        <div className="mw-info-section"><h3>{selectedRows.length === 1 ? "字段值" : "首行预览"}</h3><div className="mw-info-fields">{selectedColumns.map((column) => <div className="mw-info-field" key={column.key}><span>{column.label}</span><strong title={String(selectedRows[0]?.[column.key] ?? "")}>{String(selectedRows[0]?.[column.key] ?? "")}</strong><button type="button" className="mw-field-copy" aria-label={`复制 ${column.label}`} onClick={() => void copy(String(selectedRows[0]?.[column.key] ?? ""), column.label)}><Copy size={12} /></button></div>)}</div></div>
        <div className="mw-info-section"><h3>操作</h3><div className="mw-info-actions"><button type="button" onClick={() => void copy(selectedData.map((item) => Object.values(item).join("\t")).join("\n"), "选中内容")}><Copy size={13} />复制选区</button><button type="button" onClick={exportSelection}><DownloadSimple size={13} />导出为 JSON</button></div></div>
        <div className="mw-info-section mw-field-descriptions"><h3>字段说明</h3>{selectedColumns.map((column) => <div key={column.key}><span>{column.key}</span><span>{FIELD_DESCRIPTIONS[column.key] ?? column.type}</span></div>)}</div>
      </> : <>
      <div className="mw-info-heading"><strong>{table === "customers" ? "客户信息" : `${table} 记录`}</strong>{row && (editing ? <div><button type="button" className="mw-info-quiet" onClick={() => setEditing(false)}><X size={13} />取消</button><button type="button" className="mw-info-edit" onClick={saveEdit}><Check size={13} />保存</button></div> : <button type="button" className="mw-info-edit" onClick={beginEdit}><PencilSimple size={13} />编辑</button>)}</div>
      {row ? <>
        <div className="mw-info-fields">{Object.entries(row).filter(([key]) => FIELD_LABELS[key]).map(([key, value]) => <div className="mw-info-field" key={key}><span>{FIELD_LABELS[key]}</span>{editing && key !== "id" ? <input aria-label={`编辑 ${key}`} value={String(draft[key] ?? "")} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /> : <strong className={key === "status" && value === "正常" ? "mw-info-status" : ""}>{String(value)}</strong>}{!editing && key !== "status" && <button type="button" className="mw-field-copy" aria-label={`复制 ${key}`} onClick={() => void copy(String(value), key)}><Copy size={12} /></button>}</div>)}</div>
        <div className="mw-info-section"><h3>关联信息</h3>{table === "customers" ? <><div className="mw-info-relation"><span>关联订单</span><strong>{customerOrders.length} 条</strong><button type="button" onClick={() => onOpenTable("orders")}>查看订单 <ArrowRight size={12} /></button></div><div className="mw-info-relation"><span>最近订单</span><strong>{customerOrders.length ? [...customerOrders].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0].created_at : "暂无"}</strong></div><div className="mw-info-relation"><span>累计消费</span><strong>¥ {spent.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</strong></div><div className="mw-info-relation"><span>客户等级</span><strong className="mw-gold-tag">{spent >= 100000 ? "金牌客户" : spent >= 30000 ? "优质客户" : "普通客户"}</strong></div></> : table === "orders" ? <><div className="mw-info-relation"><span>关联客户</span><strong>{relatedCustomer ? String(relatedCustomer.name) : "未知客户"}</strong><button type="button" onClick={() => onOpenTable("customers")}>查看客户 <ArrowRight size={12} /></button></div><div className="mw-info-relation"><span>客户类型</span><strong>{relatedCustomer ? String(relatedCustomer.customer_type) : "—"}</strong></div><div className="mw-info-relation"><span>客户城市</span><strong>{relatedCustomer ? String(relatedCustomer.city) : "—"}</strong></div><div className="mw-info-relation"><span>联系电话</span><strong>{relatedCustomer ? String(relatedCustomer.phone) : "—"}</strong></div><div className="mw-info-relation"><span>订单金额</span><strong>¥ {Number(row.total_amount ?? 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</strong></div></> : <div className="mw-info-relation"><span>所属数据库</span><strong>orders</strong></div>}</div>
        <div className="mw-info-section"><h3>操作</h3><div className="mw-info-actions"><button type="button" onClick={() => void copy(JSON.stringify(row, null, 2), "记录")}><Copy size={13} />复制记录</button><button type="button" onClick={exportJson}><DownloadSimple size={13} />导出为 JSON</button><button type="button" onClick={openRecordWindow}><ArrowSquareOut size={13} />在新窗口打开</button></div></div>
        <div className="mw-info-section mw-field-descriptions"><h3>字段说明</h3>{Object.entries(row).map(([key]) => <div key={key}><span>{key}</span><span>{FIELD_DESCRIPTIONS[key] ?? getColumns(table).find((column) => column.key === key)?.type ?? "字段值"}</span></div>)}</div>
      </> : <div className="mw-info-empty">选择一行查看字段与关联信息</div>}</>}
    </div> : <div className="mw-ai-layout">
      <div className="mw-ai-messages"><div className="mw-ai-welcome"><span className="mw-ai-avatar"><Robot size={21} /></span><div><strong>你好，我是 Fouc AI 助手</strong><p>我可以帮你编写 SQL、分析数据、解释报错、优化查询等。</p></div></div>
        {messages.length === 0 && <div className="mw-ai-suggestions"><span>你可以试试：</span>{["查询最近 30 天的订单数据", "筛选企业客户", "查看广州客户", "优化这条 SQL 的性能"].map((text) => <button type="button" key={text} onClick={() => send(text)}><Sparkle size={13} />{text}<ArrowRight size={13} /></button>)}</div>}
        {messages.map((message, index) => <div key={index} className={`mw-ai-message mw-ai-${message.role}`}>{message.role === "assistant" && <span className="mw-ai-small-avatar"><Sparkle size={14} /></span>}<div>{message.content}{message.sql && <div className="mw-ai-sql"><div><span>SQL</span><button type="button" onClick={() => void copy(message.sql!, "SQL")}><Copy size={13} />复制</button></div><pre>{message.sql}</pre><button type="button" className="mw-ai-apply" onClick={() => { const match = message.sql?.match(/WHERE `([^`]+)` = '([^']+)'/); if (match) { onApplyFilter(match[1], match[2]); onNotice("AI 筛选条件已应用到数据表") } }}>应用到筛选</button></div>}</div></div>)}
      </div>
      <form className="mw-ai-composer" onSubmit={(event) => { event.preventDefault(); send(prompt) }}><textarea aria-label="询问 AI 助手" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(prompt) } }} placeholder="输入你的问题，或输入 / 选择操作..." /><div><span>生产订单库&nbsp; / &nbsp;orders</span><button type="submit" aria-label="发送消息" disabled={!prompt.trim()}><PaperPlaneTilt size={15} /></button></div></form>
    </div>}
  </aside>
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}
