"use client"

import { useRef, useState } from "react"
import { ArrowsClockwise, ChartBar, ClipboardText, Code, DownloadSimple, FileArrowUp, FloppyDisk, FolderOpen, Play, TextAlignLeft } from "@phosphor-icons/react"

import { getColumns, getInitialRows, TABLE_NAMES, type DataRow } from "./mysql-workbench-data"

type Props = {
  title: string
  query: string
  onQueryChange: (query: string) => void
  onNotice: (message: string) => void
}

const RESULT_TABS = ["数据表", "执行摘要", "图表", "执行计划", "导出结果"] as const

export function MysqlWorkbenchSql({ title, query, onQueryChange, onNotice }: Props) {
  const [running, setRunning] = useState(false)
  const [resultTab, setResultTab] = useState<(typeof RESULT_TABS)[number]>("数据表")
  const [result, setResult] = useState<DataRow[] | null>(null)
  const [resultTable, setResultTable] = useState("customers")
  const [resultColumnKeys, setResultColumnKeys] = useState<string[] | null>(null)
  const [chartField, setChartField] = useState("customer_type")
  const [error, setError] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const rows = result ?? getInitialRows("customers").slice(0, 8)
  const columns = getColumns(resultTable).filter((column) => !resultColumnKeys || resultColumnKeys.includes(column.key))
  const chartOptions = columns.filter((column) => column.key !== "id" && column.key !== "created_at")
  const activeChartField = chartOptions.some((column) => column.key === chartField) ? chartField : chartOptions[0]?.key
  const chartData = (() => {
    if (!activeChartField) return []
    const counts = new Map<string, number>()
    for (const row of rows) {
      const value = String(row[activeChartField] ?? "空值")
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8)
  })()

  function run() {
    setRunning(true)
    setError("")
    window.setTimeout(() => {
      try {
        const preview = previewSelect(query)
        setResultTable(preview.table)
        setResultColumnKeys(preview.columns)
        setResult(preview.rows)
        setResultTab("数据表")
        setElapsed(38)
        onNotice(`查询执行成功，返回 ${preview.rows.length} 条示例记录`)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "查询预览失败")
        setResult(null)
      }
      setRunning(false)
    }, 420)
  }

  function save() {
    try { window.localStorage.setItem(`fouc.mysql.sql.${title}`, query); onNotice(`${title} 已保存在此浏览器`) }
    catch { onNotice("浏览器存储不可用，查询未能保存") }
  }

  function format() {
    onQueryChange(query.replace(/\s+(FROM|WHERE|ORDER BY|GROUP BY|LIMIT|JOIN|LEFT JOIN|INNER JOIN)\b/gi, "\n$1").trim())
    onNotice("SQL 已格式化")
  }

  function exportResult() {
    const content = [columns.map((column) => column.key).join(","), ...rows.map((row) => columns.map((column) => `"${String(row[column.key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${resultTable}-query.csv`
    link.click()
    URL.revokeObjectURL(url)
    onNotice("查询结果已导出")
  }

  return <div className="mw-sql-workspace">
    <div className="mw-sql-toolbar"><button type="button" className="mw-run" disabled={running} onClick={run}><Play size={14} />{running ? "执行中" : "运行"}</button><button type="button" className="mw-tool-button" onClick={save}><FloppyDisk size={14} />保存</button><button type="button" className="mw-tool-button" onClick={() => fileRef.current?.click()}><FolderOpen size={14} />打开</button><input ref={fileRef} type="file" accept=".sql,.txt" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(onQueryChange) }} /><button type="button" className="mw-tool-button" onClick={format}><TextAlignLeft size={14} />格式化</button><div className="mw-sql-spacer" /><label className="mw-sql-select"><span className="mw-online-dot" /><select aria-label="选择连接" defaultValue="生产订单库"><option>生产订单库</option></select></label><label className="mw-sql-select"><span>▤</span><select aria-label="选择数据库" defaultValue="orders"><option>orders</option><option>analytics</option></select></label></div>
    <div className="mw-editor"><div className="mw-editor-lines">{query.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><div className="mw-editor-code"><pre ref={highlightRef} aria-hidden>{highlightSql(query)}{"\n"}</pre><textarea spellCheck={false} aria-label="SQL 编辑器" value={query} onChange={(event) => onQueryChange(event.target.value)} onScroll={(event) => { if (highlightRef.current) { highlightRef.current.scrollTop = event.currentTarget.scrollTop; highlightRef.current.scrollLeft = event.currentTarget.scrollLeft } }} /></div></div>
    <div className="mw-result"><div className="mw-result-tabs"><div>{RESULT_TABS.map((tab) => <button type="button" key={tab} className={resultTab === tab ? "mw-result-active" : ""} onClick={() => setResultTab(tab)}>{tab === "图表" ? <ChartBar size={13} /> : tab === "执行计划" ? <Code size={13} /> : tab === "导出结果" ? <DownloadSimple size={13} /> : null}{tab}</button>)}</div><span>{error ? "查询失败" : `${rows.length} 条记录　耗时 ${elapsed || 86} ms`}</span></div>
      {error ? <div className="mw-result-error">{error}</div> : resultTab === "数据表" ? <div className="mw-result-grid"><table><thead><tr><th>#</th>{columns.map((column) => <th key={column.key}>{column.label}<small>{column.type}</small></th>)}</tr></thead><tbody>{rows.slice(0, 30).map((row, index) => <tr key={index}><td>{index + 1}</td>{columns.map((column) => <td key={column.key}>{String(row[column.key] ?? "")}</td>)}</tr>)}</tbody></table></div> : resultTab === "执行摘要" ? <div className="mw-result-summary"><strong>执行成功</strong><p>返回 {rows.length} 行 · 影响 0 行 · 耗时 {elapsed || 86} ms</p><code>{query}</code></div> : resultTab === "图表" ? <div className="mw-result-chart"><div className="mw-chart-heading"><strong>结果分布</strong><label>分组字段 <select aria-label="图表分组字段" value={activeChartField} onChange={(event) => setChartField(event.target.value)}>{chartOptions.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label></div>{chartData.length ? chartData.map(([label, count]) => <div className="mw-chart-row" key={label}><span title={label}>{label}</span><div><i style={{ width: `${Math.max(3, count / chartData[0][1] * 100)}%` }} /></div><strong>{count}</strong></div>) : <p>当前结果没有可用的分组字段。</p>}</div> : resultTab === "执行计划" ? <div className="mw-result-summary"><strong>执行计划</strong><table><thead><tr><th>id</th><th>select_type</th><th>table</th><th>type</th><th>rows</th><th>Extra</th></tr></thead><tbody><tr><td>1</td><td>SIMPLE</td><td>{resultTable}</td><td>ALL</td><td>{rows.length}</td><td>Using where</td></tr></tbody></table></div> : <div className="mw-result-summary"><strong>导出结果</strong><p>将当前结果保存为 CSV 文件。</p><button type="button" className="mw-tool-button" onClick={exportResult}><FileArrowUp size={14} />导出 CSV</button></div>}
      <div className="mw-result-footer"><span>共 {rows.length} 条记录</span><span>本地示例数据</span><button type="button" onClick={run}><ArrowsClockwise size={13} />重新执行</button><button type="button" onClick={exportResult}><ClipboardText size={13} />导出</button></div>
    </div>
  </div>
}

function previewSelect(query: string): { table: string; columns: string[] | null; rows: DataRow[] } {
  if (!/^\s*SELECT\b/i.test(query)) throw new Error("本地示例数据仅支持 SELECT 查询预览。")
  const from = query.match(/\bFROM\s+(?:`?[\w]+`?\.)?`?([\w]+)`?/i)
  if (!from) throw new Error("请在 SQL 中指定要查询的表。")
  const table = from[1]
  if (!TABLE_NAMES.includes(table)) throw new Error(`示例连接中没有表 ${table}。`)
  const allColumns = getColumns(table)
  const selection = query.slice(query.search(/\bSELECT\b/i) + 6, from.index).trim()
  const keys = selection.includes("*") ? null : selection.split(",").map((part) => part.trim().replace(/^(?:`?[\w]+`?\.)?`?([\w]+)`?(?:\s+AS\s+\w+)?$/i, "$1"))
  if (keys && keys.some((key) => !allColumns.some((column) => column.key === key))) throw new Error("所选字段不在示例表中，请检查 SELECT 列表。")
  let rows = getInitialRows(table)
  const whereClause = query.match(/\bWHERE\s+([\s\S]*?)(?=\bORDER\s+BY\b|\bLIMIT\b|;|$)/i)?.[1]?.trim()
  if (whereClause) {
    for (const condition of whereClause.split(/\s+AND\s+/i)) {
      const match = condition.match(/^(?:`?[\w]+`?\.)?`?(\w+)`?\s*(=|LIKE)\s*(?:['"]([^'"]+)['"]|(\d+(?:\.\d+)?))$/i)
      if (!match) throw new Error("本地预览仅支持字段等于或 LIKE 条件，多个条件可使用 AND。")
      const [, field, operator] = match
      const value = match[3] ?? match[4]
      if (!allColumns.some((column) => column.key === field)) throw new Error(`示例表中没有字段 ${field}。`)
      const needle = value.replaceAll("%", "").toLowerCase()
      rows = rows.filter((row) => operator.toUpperCase() === "LIKE" ? String(row[field] ?? "").toLowerCase().includes(needle) : String(row[field] ?? "").toLowerCase() === needle)
    }
  }
  const order = query.match(/\bORDER\s+BY\s+(?:`?[\w]+`?\.)?`?(\w+)`?(?:\s+(ASC|DESC))?/i)
  if (order) {
    const [, field, direction] = order
    if (!allColumns.some((column) => column.key === field)) throw new Error(`示例表中没有字段 ${field}。`)
    rows = rows.toSorted((a, b) => {
      const left = a[field]
      const right = b[field]
      const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""), "zh-CN", { numeric: true })
      return direction?.toUpperCase() === "DESC" ? -comparison : comparison
    })
  }
  const limit = Number(query.match(/\bLIMIT\s+(\d+)/i)?.[1] ?? 1000)
  return { table, columns: keys, rows: rows.slice(0, limit) }
}

function highlightSql(query: string) {
  return query.split(/(\bSELECT\b|\bFROM\b|\bWHERE\b|\bORDER\b|\bBY\b|\bLIMIT\b|\bJOIN\b|\bAS\b|\bAND\b|'[^']*'|\b\d+\b)/gi).map((part, index) => {
    const kind = /^(SELECT|FROM|WHERE|ORDER|BY|LIMIT|JOIN|AS|AND)$/i.test(part) ? "mw-sql-keyword" : /^'/.test(part) ? "mw-sql-string" : /^\d+$/.test(part) ? "mw-sql-number" : ""
    return <span key={index} className={kind}>{part}</span>
  })
}
