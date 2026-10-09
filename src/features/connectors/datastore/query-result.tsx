"use client"

import { useState } from "react"
import { useAppAlert } from "@/components/app-alert-provider"
import { BracketsCurly, ChartBar, ChatText, CheckCircle, Clock, Copy, DownloadSimple, ListChecks, Table, TextAlignLeft } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalProvider } from "@fouc/shared"
import type { SqlResultView } from '@fouc/shared'

import { formatDelimited, formatJson } from "./result-format"
import { QueryChartBuilder } from './charts'
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid'
import { ResultExportDialog, type ResultExportDialogProps } from './result-export'

type ResultView = SqlResultView

const views = [
  { id: "table", label: "数据表", icon: Table },
  { id: "text", label: "文本", icon: TextAlignLeft },
  { id: "json", label: "JSON", icon: BracketsCurly },
  { id: "chart", label: "图表", icon: ChartBar },
  { id: "summary", label: "执行摘要", icon: ListChecks },
  { id: "messages", label: "消息", icon: ChatText }
] as const


export function SqlQueryResult({ result, provider, scopeKey, layoutScopeKey, view: controlledView, onViewChange }: { result: DatabaseQueryResult; provider: RelationalProvider; scopeKey: string; layoutScopeKey?: string; view?: ResultView; onViewChange?: (view: ResultView) => void }) {
  const [localView, setLocalView] = useState<ResultView>("table")
  const view = controlledView ?? localView
  const [exportSnapshot, setExportSnapshot] = useState<Omit<ResultExportDialogProps, 'onClose'> | null>(null), [selectionScope, setSelectionScope] = useState<ResultGridSelectionScope | null>(null)
  function setView(next: ResultView) { setSelectionScope(null); (onViewChange ?? setLocalView)(next) }
  const { notify } = useAppAlert()
  const hasRows = result.rows.length > 0

  async function copy() {
    try {
      const content = view === "json" ? formatJson(result) : formatDelimited(result, "\t")
      await navigator.clipboard.writeText(content)
      notify('success', `已复制本次返回的 ${result.rows.length} 行`)
    } catch {
      notify('error', "复制失败，请检查剪贴板权限")
    }
  }


  return (
    <>
      <div className="mw-result-tabs mw-live-result-tabs">
        <div role="tablist" aria-label="查询结果视图">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              className={view === item.id ? "mw-result-active" : ""}
              onClick={() => setView(item.id)}
            >
              <item.icon size={14} />
              {item.label}
              {item.id === "messages" && result.messages.length > 0 ? ` ${result.messages.length}` : ""}
            </button>
          ))}
        </div>
      </div>
      {view === "table" && <ResultGrid result={result} scopeKey={scopeKey} layoutScopeKey={layoutScopeKey} onSelectionChange={setSelectionScope} />}
      {view === "text" && (
        <pre className="mw-live-result-pre" role="tabpanel">
          {formatDelimited(result, "\t")}
        </pre>
      )}
      {view === "json" && (
        <pre className="mw-live-result-pre" role="tabpanel">
          {formatJson(result)}
        </pre>
      )}
      {view === "chart" && <QueryChartBuilder result={result} scopeKey={layoutScopeKey} />}
      {view === "summary" && (
        <div className="mw-result-summary" role="tabpanel">
          <strong>执行摘要</strong>
          <table>
            <tbody>
              <tr>
                <th>执行耗时</th>
                <td>{result.executionTimeMs} ms</td>
              </tr>
              <tr>
                <th>返回行数</th>
                <td>{result.rows.length}</td>
              </tr>
              <tr>
                <th>受影响行数</th>
                <td>{result.affectedRows}</td>
              </tr>
              <tr>
                <th>列数</th>
                <td>{result.columns.length}</td>
              </tr>
              <tr>
                <th>结果范围</th>
                <td>{result.truncated || result.hasMore ? "仅包含本次已返回的数据" : "完整返回"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {view === "messages" && (
        <div className="mw-result-summary" role="tabpanel">
          {result.messages.length ? (
            result.messages.map((message, index) => (
              <div className="mw-live-result-message" key={index}>
                <strong>
                  {message.severity}
                  {message.code ? ` · ${message.code}` : ""}
                </strong>
                <p>{message.message}</p>
                {message.detail && <p>{message.detail}</p>}
                {message.hint && <p>{message.hint}</p>}
              </div>
            ))
          ) : (
            <p>本次查询没有服务端消息。</p>
          )}
        </div>
      )}
      <footer className="mw-query-result-footer"><span><CheckCircle size={14} color="var(--ok-ink)" />{result.rows.length} 行<Clock size={13} />{result.executionTimeMs} ms{result.truncated || result.hasMore ? ' · 仅显示已返回行' : ''}</span><div className="mw-live-result-actions">
        <button type="button" disabled={!hasRows} onClick={() => void copy()}><Copy size={14} />复制</button>
        <button type="button" aria-label="导出查询结果" disabled={!hasRows} onClick={() => setExportSnapshot({ result, provider, title: 'query-result', selectedRows: selectionScope?.rectangular ? selectionScope.rows : undefined, selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined })}><DownloadSimple size={14} />导出…</button></div></footer>
      {exportSnapshot && <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />}
    </>
  )
}
