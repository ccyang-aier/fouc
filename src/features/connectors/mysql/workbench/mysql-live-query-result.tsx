"use client"

import { useState } from "react"
import type { DatabaseQueryResult } from "@fouc/shared"

import { databaseCellText } from "./mysql-live-format"
import { chartableColumns, chartNumber, columnLabel, formatDelimited, formatJson } from "./mysql-live-result-format"

type ResultView = "table" | "text" | "json" | "chart" | "summary" | "messages"
type ExportFormat = "csv" | "tsv" | "json"

const views: { id: ResultView; label: string }[] = [
  { id: "table", label: "数据表" }, { id: "text", label: "文本" }, { id: "json", label: "JSON" },
  { id: "chart", label: "图表" }, { id: "summary", label: "执行摘要" }, { id: "messages", label: "消息" },
]

function resultContent(result: DatabaseQueryResult, format: ExportFormat): string {
  return format === "json" ? formatJson(result) : formatDelimited(result, format === "csv" ? "," : "\t")
}

function ResultChart({ result }: { result: DatabaseQueryResult }) {
  const numericColumns = chartableColumns(result)
  const [dimension, setDimension] = useState(() => result.columns.findIndex((_, index) => !numericColumns.includes(index)) === -1 ? 0 : result.columns.findIndex((_, index) => !numericColumns.includes(index)))
  const [metric, setMetric] = useState(numericColumns[0] ?? 0)
  const [chartType, setChartType] = useState<"bar" | "line" | "pie" | "metric">("bar")
  const currentMetric = numericColumns.includes(metric) ? metric : numericColumns[0]
  const points = result.rows.slice(0, 40).map((row, index) => ({
    label: databaseCellText(row[dimension] ?? null) || String(index + 1), value: chartNumber(row[currentMetric]),
  })).filter((point): point is { label: string; value: number } => point.value !== null)
  const maximum = Math.max(1, ...points.map((point) => Math.abs(point.value)))
  const minimum = Math.min(0, ...points.map((point) => point.value))
  const lineMaximum = Math.max(1, ...points.map((point) => point.value))
  const lineY = (value: number) => 170 - ((value - minimum) / (lineMaximum - minimum || 1)) * 145
  const piePoints = points.filter((point) => point.value > 0)
  const pieTotal = piePoints.reduce((total, point) => total + point.value, 0)
  const colors = ["#3b75d7", "#68a3e8", "#6ac3a1", "#e8ad68", "#a087da", "#d57e93"]
  const pieGradient = piePoints.map((point, index) => {
    const start = piePoints.slice(0, index).reduce((total, previous) => total + previous.value, 0) / pieTotal * 100
    const end = start + (point.value / pieTotal) * 100
    return `${colors[index % colors.length]} ${start}% ${end}%`
  }).join(", ")

  return <div className="mw-result-chart">
    <div className="mw-live-chart-controls">
      <label>图表类型<select aria-label="图表类型" value={chartType} onChange={(event) => setChartType(event.target.value as typeof chartType)}><option value="bar">柱状图</option><option value="line">趋势图</option><option value="pie">饼图</option><option value="metric">指标</option></select></label>
      <label>维度<select aria-label="图表维度" value={dimension} onChange={(event) => setDimension(Number(event.target.value))}>{result.columns.map((_, index) => <option key={index} value={index}>{columnLabel(result.columns, index)}</option>)}</select></label>
      <label>指标<select aria-label="图表指标" value={currentMetric ?? ""} disabled={!numericColumns.length} onChange={(event) => setMetric(Number(event.target.value))}>{numericColumns.map((index) => <option key={index} value={index}>{columnLabel(result.columns, index)}</option>)}</select></label>
    </div>
    {!numericColumns.length ? <p className="mw-live-result-empty">结果中没有可用于绘图的数值列。</p>
      : !points.length ? <p className="mw-live-result-empty">没有可绘制的数值。</p>
        : chartType === "metric" ? <div className="mw-live-metrics">{points.map((point, index) => <div key={index}><span title={point.label}>{point.label}</span><strong>{point.value.toLocaleString()}</strong></div>)}</div>
          : chartType === "pie" ? pieTotal > 0 ? <div className="mw-live-pie-layout"><div className="mw-live-pie" role="img" aria-label={`${columnLabel(result.columns, currentMetric)} 饼图`} style={{ background: `conic-gradient(${pieGradient})` }} /><div className="mw-live-pie-legend">{piePoints.map((point, index) => <div key={index}><i style={{ background: colors[index % colors.length] }} /><span title={point.label}>{point.label}</span><strong>{point.value}</strong></div>)}</div></div> : <p className="mw-live-result-empty">饼图需要大于零的数值。</p>
            : chartType === "line" ? <svg className="mw-live-line-chart" viewBox="0 0 700 190" role="img" aria-label={`${columnLabel(result.columns, currentMetric)} 趋势图`} preserveAspectRatio="none"><polyline fill="none" stroke="#3b75d7" strokeWidth="2" points={points.map((point, index) => `${20 + (index * 660) / Math.max(1, points.length - 1)},${lineY(point.value)}`).join(" ")} />{points.map((point, index) => <circle key={index} cx={20 + (index * 660) / Math.max(1, points.length - 1)} cy={lineY(point.value)} r="3" fill="#3b75d7"><title>{point.label}: {point.value}</title></circle>)}</svg>
            : <div className="mw-live-bars">{points.map((point, index) => <div className="mw-chart-row" key={index}><span title={point.label}>{point.label}</span><div><i style={{ width: `${(Math.abs(point.value) / maximum) * 100}%` }} /></div><strong title={String(point.value)}>{point.value}</strong></div>)}</div>}
    <p className="mw-live-chart-note">图表显示本次返回结果中的前 {Math.min(result.rows.length, 40)} 行。</p>
  </div>
}

export function MysqlLiveQueryResult({ result }: { result: DatabaseQueryResult }) {
  const [view, setView] = useState<ResultView>("table")
  const [feedback, setFeedback] = useState("")
  const hasRows = result.rows.length > 0

  async function copy() {
    try {
      const content = view === "json" ? formatJson(result) : formatDelimited(result, "\t")
      await navigator.clipboard.writeText(content)
      setFeedback(`已复制本次返回的 ${result.rows.length} 行`)
    } catch {
      setFeedback("复制失败，请检查剪贴板权限")
    }
  }

  function download(format: ExportFormat) {
    const blob = new Blob([resultContent(result, format)], { type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `mysql-result.${format}`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback(`已导出本次返回的 ${result.rows.length} 行`)
  }

  return <>
    <div className="mw-result-tabs mw-live-result-tabs">
      <div role="tablist" aria-label="查询结果视图">{views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} className={view === item.id ? "mw-result-active" : ""} onClick={() => setView(item.id)}>{item.label}{item.id === "messages" && result.messages.length > 0 ? ` ${result.messages.length}` : ""}</button>)}</div>
      <div className="mw-live-result-actions"><span>{result.rows.length} 行 · {result.executionTimeMs} ms{result.truncated || result.hasMore ? " · 仅显示已返回行" : ""}</span><button type="button" disabled={!hasRows} onClick={() => void copy()}>复制</button><select aria-label="导出查询结果" value="" disabled={!hasRows} onChange={(event) => { if (event.target.value) download(event.target.value as ExportFormat); event.target.value = "" }}><option value="">导出…</option><option value="csv">CSV</option><option value="tsv">TSV</option><option value="json">JSON</option></select></div>
    </div>
    {view === "table" && <div className="mw-result-grid"><table><thead><tr><th>#</th>{result.columns.map((name, index) => <th key={`${name}-${index}`}>{name}<small>{result.columnTypes[index]}</small></th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + 1}</td>{result.columns.map((_, columnIndex) => <td key={columnIndex} title={databaseCellText(row[columnIndex] ?? null)}>{databaseCellText(row[columnIndex] ?? null)}</td>)}</tr>)}</tbody></table>{!hasRows && <p className="mw-live-result-empty">查询成功，没有返回记录。</p>}</div>}
    {view === "text" && <pre className="mw-live-result-pre" role="tabpanel">{formatDelimited(result, "\t")}</pre>}
    {view === "json" && <pre className="mw-live-result-pre" role="tabpanel">{formatJson(result)}</pre>}
    {view === "chart" && <ResultChart result={result} />}
    {view === "summary" && <div className="mw-result-summary" role="tabpanel"><strong>执行摘要</strong><table><tbody><tr><th>执行耗时</th><td>{result.executionTimeMs} ms</td></tr><tr><th>返回行数</th><td>{result.rows.length}</td></tr><tr><th>受影响行数</th><td>{result.affectedRows}</td></tr><tr><th>列数</th><td>{result.columns.length}</td></tr><tr><th>结果范围</th><td>{result.truncated || result.hasMore ? "仅包含本次已返回的数据" : "完整返回"}</td></tr></tbody></table></div>}
    {view === "messages" && <div className="mw-result-summary" role="tabpanel">{result.messages.length ? result.messages.map((message, index) => <div className="mw-live-result-message" key={index}><strong>{message.severity}{message.code ? ` · ${message.code}` : ""}</strong><p>{message.message}</p>{message.detail && <p>{message.detail}</p>}{message.hint && <p>{message.hint}</p>}</div>) : <p>本次查询没有服务端消息。</p>}</div>}
    {feedback && <span className="mw-live-result-feedback" role="status">{feedback}</span>}
  </>
}
