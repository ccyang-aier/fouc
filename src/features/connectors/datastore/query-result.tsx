"use client"

import { useCallback, useId, useMemo, useState } from "react"
import { createPortal } from 'react-dom'
import { useAppAlert } from "@/components/app-alert-provider"
import { ArrowsClockwise, CaretDown, ChartBar, ChatText, CheckCircle, Clock, Copy, DownloadSimple, IconContext, ListChecks, Table, Timer } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { DatabaseQueryResult, RelationalProvider } from "@fouc/shared"
import type { SqlResultView } from '@fouc/shared'

import { formatDelimited, formatJson } from "./result-format"
import { QueryChartBuilder } from './charts'
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid'
import { ResultExportDialog, type ResultExportDialogProps } from './result-export'
import { SqlResultTools } from './sql-result-tools'
import { SqlResultDdlAction, type SqlResultQueryContext } from './sql-result-ddl-action'
import styles from './query-result.module.css'

type ResultView = SqlResultView

const views = [
  { id: "table", label: "数据表", icon: Table },
  { id: "summary", label: "摘要", icon: ListChecks },
  { id: "chart", label: "图表", icon: ChartBar },
  { id: "messages", label: "消息", icon: ChatText }
] as const


export function SqlQueryResult({ result, provider, scopeKey, layoutScopeKey, view: controlledView, onViewChange, headerTarget, queryContext, active = true, onExplainTarget, onRefresh, autoRefresh = false, onAutoRefresh }: { result: DatabaseQueryResult; provider: RelationalProvider; scopeKey: string; layoutScopeKey?: string; view?: ResultView; onViewChange?: (view: ResultView) => void; headerTarget?: HTMLElement | null; queryContext?: SqlResultQueryContext; active?: boolean; onExplainTarget?: (target: HTMLDivElement | null) => void; onRefresh?: () => void; autoRefresh?: boolean; onAutoRefresh?: () => void }) {
  const id = useId()
  const [localHeaderTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null), [toolsTarget, setToolsTarget] = useState<HTMLDivElement | null>(null)
  const [localView, setLocalView] = useState<ResultView>("table")
  const view = controlledView ?? localView
  const [exportSnapshot, setExportSnapshot] = useState<Omit<ResultExportDialogProps, 'onClose'> | null>(null), [selectionScope, setSelectionScope] = useState<ResultGridSelectionScope | null>(null)
  const [filteredRows, setFilteredRows] = useState<readonly number[] | null>(null)
  const shownResult = useMemo(() => filteredRows ? { ...result, rows: filteredRows.map(index => result.rows[index]) } : result, [result, filteredRows])
  const shownRows = shownResult.rows
  const selectScope = useCallback((scope: ResultGridSelectionScope | null) => setSelectionScope(scope && filteredRows ? { ...scope, rows: scope.rows.map(index => filteredRows[index]) } : scope), [filteredRows])
  function setView(next: ResultView) { setSelectionScope(null); (onViewChange ?? setLocalView)(next) }
  const { notify } = useAppAlert()
  const hasRows = result.rows.length > 0

  async function copy() {
    try {
      const content = view === "json" ? formatJson(shownResult) : formatDelimited(shownResult, "\t")
      await navigator.clipboard.writeText(content)
      notify('success', `已复制当前视图的 ${shownRows.length} 行`)
    } catch {
      notify('error', "复制失败，请检查剪贴板权限")
    }
  }


  return (
    <IconContext.Provider value={{ weight: 'bold', size: 18 }}><div className={styles.root}>
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
              <item.icon />
              {item.label}
              {item.id === "messages" && result.messages.length > 0 ? ` ${result.messages.length}` : ""}
            </button>
          ))}
        </div>
        <DropdownMenu><DropdownMenuTrigger className={`fouc-action ${styles.rowsFilter}`} aria-label="查询结果行范围">{view === 'text' ? '文本' : view === 'json' ? 'JSON' : filteredRows ? '选中行' : '全部行'}<CaretDown size={12} /></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuGroup><DropdownMenuCheckboxItem checked={!filteredRows} onCheckedChange={() => { setFilteredRows(null); setSelectionScope(null) }}>全部已返回行</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem disabled={!selectionScope?.rows.length} checked={Boolean(filteredRows)} onCheckedChange={() => { if (selectionScope) { setFilteredRows(selectionScope.rows); setSelectionScope(null) } }}>仅查看选中行</DropdownMenuCheckboxItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem onSelect={() => setView('text')}>文本视图</DropdownMenuItem><DropdownMenuItem onSelect={() => setView('json')}>JSON 视图</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
        <div className={styles.toolbarActions}>
          {!headerTarget && <div ref={setHeaderTarget} className={styles.headerTools} />}
          <div ref={active ? onExplainTarget : undefined} className={styles.explainSlot} />
          <button type="button" className="fouc-action" aria-label="导出查询结果" disabled={!hasRows} onClick={() => setExportSnapshot({ result, provider, title: 'query-result', selectedRows: selectionScope?.rectangular ? selectionScope.rows : filteredRows ?? undefined, selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined })}><DownloadSimple /><span>保存结果</span></button>
          <span className={styles.divider} />
          <button type="button" className="fouc-action" aria-label="刷新当前查询" title={onRefresh ? '重新运行当前 SQL' : '固定快照不能刷新'} disabled={!onRefresh} onClick={onRefresh}><ArrowsClockwise /><span>刷新</span></button>
          <button type="button" className="fouc-action" aria-label="自动刷新查询" title={onAutoRefresh ? '每 15 秒刷新，离开查询页或修改 SQL 后暂停' : '固定快照不会自动刷新'} disabled={!onAutoRefresh} aria-pressed={autoRefresh} onClick={onAutoRefresh}><Timer /><span>自动</span></button>
        </div>
        {(headerTarget ?? localHeaderTarget) && createPortal(<><SqlResultDdlAction context={queryContext} provider={provider} /><SqlResultTools onTarget={setToolsTarget} disabled={view !== 'table'} extraActions={<button type="button" className="fouc-menu-item" disabled={!hasRows} onClick={() => void copy()}><Copy size={16} />复制查询结果</button>} /></>, (headerTarget ?? localHeaderTarget)!)}
      </div>
      <div className={styles.content} role="tabpanel" id={`${id}-panel`} aria-label={view === 'text' ? '文本视图' : view === 'json' ? 'JSON 视图' : undefined} aria-labelledby={view !== 'text' && view !== 'json' ? `${id}-${view}` : undefined}>
      {view === "table" && <ResultGrid result={shownResult} rowNumbers={filteredRows?.map(index => index + 1)} scopeKey={`${scopeKey}:${filteredRows?.join(',') ?? 'all'}`} layoutScopeKey={layoutScopeKey} onSelectionChange={selectScope} headerTarget={headerTarget ?? localHeaderTarget} toolsTarget={toolsTarget} />}
      {view === "text" && (
        <pre className="mw-live-result-pre">
          {formatDelimited(shownResult, "\t")}
        </pre>
      )}
      {view === "json" && (
        <pre className="mw-live-result-pre">
          {formatJson(shownResult)}
        </pre>
      )}
      {view === "chart" && <QueryChartBuilder result={shownResult} scopeKey={layoutScopeKey} />}
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
      <footer className={styles.footer}><span><CheckCircle size={13} color="var(--ok-ink)" />{shownRows.length} 行{filteredRows ? ` / ${result.rows.length} 已返回` : ''}</span><span><Clock size={12} />{result.executionTimeMs} ms</span><span>{result.truncated || result.hasMore ? '仅显示已返回行' : '完整返回'} · 只读</span></footer>
      {exportSnapshot && <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />}
    </div></IconContext.Provider>
  )
}
