"use client"

import { useId, useState } from "react"
import { useAppAlert } from "@/components/app-alert-provider"
import { BracketsCurly, ChartBar, ChatText, CheckCircle, Clock, Copy, DownloadSimple, ListChecks, Table, TextAlignLeft } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalProvider } from "@fouc/shared"
import type { SqlResultView } from '@fouc/shared'

import { formatDelimited, formatJson } from "./result-format"
import { QueryChartBuilder } from './charts'
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid'
import { ResultExportDialog, type ResultExportDialogProps } from './result-export'
import { SqlResultTools } from './sql-result-tools'
import styles from './query-result.module.css'

type ResultView = SqlResultView

const views = [
  { id: "table", label: "数据表", icon: Table },
  { id: "summary", label: "摘要", icon: ListChecks },
  { id: "chart", label: "图表", icon: ChartBar },
  { id: "messages", label: "消息", icon: ChatText },
  { id: "text", label: "文本", icon: TextAlignLeft },
  { id: "json", label: "JSON", icon: BracketsCurly }
] as const


export function SqlQueryResult({ result, provider, scopeKey, layoutScopeKey, view: controlledView, onViewChange, headerTarget }: { result: DatabaseQueryResult; provider: RelationalProvider; scopeKey: string; layoutScopeKey?: string; view?: ResultView; onViewChange?: (view: ResultView) => void; headerTarget?: HTMLElement | null }) {
  const id = useId()
  const [localHeaderTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null), [toolsTarget, setToolsTarget] = useState<HTMLDivElement | null>(null)
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
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.views} role="tablist" aria-label="查询结果视图">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${id}-${item.id}`}
              aria-controls={`${id}-panel`}
              tabIndex={view === item.id ? 0 : -1}
              aria-selected={view === item.id}
              className="fouc-action"
              onClick={() => setView(item.id)}
              onKeyDown={event => {
                const index = views.findIndex(entry => entry.id === item.id)
                const next = event.key === 'ArrowRight' ? (index + 1) % views.length : event.key === 'ArrowLeft' ? (index - 1 + views.length) % views.length : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : null
                if (next !== null) { event.preventDefault(); setView(views[next].id); document.getElementById(`${id}-${views[next].id}`)?.focus() }
              }}
            >
              <item.icon size={14} />
              {item.label}
              {item.id === "messages" && result.messages.length > 0 ? ` ${result.messages.length}` : ""}
            </button>
          ))}
        </div>
        <div className={styles.toolbarActions}>
          {!headerTarget && <div ref={setHeaderTarget} className={styles.headerTools} />}
          <button type="button" className="fouc-action" aria-label="复制查询结果" title="复制本次返回的全部行" disabled={!hasRows} onClick={() => void copy()}><Copy size={14} /><span>复制</span></button>
          <button type="button" className="fouc-action" aria-label="导出查询结果" disabled={!hasRows} onClick={() => setExportSnapshot({ result, provider, title: 'query-result', selectedRows: selectionScope?.rectangular ? selectionScope.rows : undefined, selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined })}><DownloadSimple size={14} /><span>保存结果</span></button>
          <SqlResultTools onTarget={setToolsTarget} disabled={view !== 'table'} />
        </div>
      </div>
      <div className={styles.content} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${view}`}>
      {view === "table" && <ResultGrid result={result} scopeKey={scopeKey} layoutScopeKey={layoutScopeKey} onSelectionChange={setSelectionScope} headerTarget={headerTarget ?? localHeaderTarget} toolsTarget={toolsTarget} />}
      {view === "text" && (
        <pre className="mw-live-result-pre">
          {formatDelimited(result, "\t")}
        </pre>
      )}
      {view === "json" && (
        <pre className="mw-live-result-pre">
          {formatJson(result)}
        </pre>
      )}
      {view === "chart" && <QueryChartBuilder result={result} scopeKey={layoutScopeKey} />}
      {view === "summary" && (
        <div className="mw-result-summary">
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
        <div className="mw-result-summary">
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
      </div>
      <footer className={styles.footer}><span><CheckCircle size={13} color="var(--ok-ink)" />{result.rows.length} 行</span><span><Clock size={12} />{result.executionTimeMs} ms</span><span>{result.truncated || result.hasMore ? '仅显示已返回行' : '完整返回'} · 只读</span></footer>
      {exportSnapshot && <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />}
    </div>
  )
}
