"use client"
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleNotch, Clock, PushPin, SkipForward, Stop, Table, WarningCircle, X } from '@phosphor-icons/react'
import { sqlExecutionActive, type RelationalProvider, type SqlExecutionSnapshot, type SqlStatementExecution, type SqlResultView as ResultView } from '@fouc/shared'
import type { SqlExecutionUI } from './use-sql-executions'
import { SqlQueryResult } from './query-result'
import { sqlResultLabel, sqlResultTabLabel } from './sql-result-label'
import type { SqlResultHeaderHost } from './sql-result-header'
import headerStyles from './sql-result-header.module.css'
import { navigateWorkbenchTabs } from './workbench-tab-navigation'
import { Button } from '@/components/ui/button'
import styles from './sql-execution.module.css'

const labels = { running: '正在执行', cancelling: '正在停止', completed: '执行完成', failed: '执行中断', cancelled: '已取消' }
function StatementIcon({ statement }: { statement: SqlStatementExecution }) {
  return statement.status === 'running' ? <CircleNotch size={13} className="mw-spin" /> : statement.status === 'succeeded' ? <Table size={13} />
    : statement.status === 'failed' ? <WarningCircle size={13} /> : statement.status === 'cancelled' ? <Stop size={13} /> : <SkipForward size={13} />
}
function Elapsed({ execution, active }: { execution: SqlExecutionSnapshot; active: boolean }) {
  const [now, setNow] = useState(execution.startedAt)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [active, execution.id])
  const duration = Math.max(0, (execution.finishedAt ?? now) - execution.startedAt)
  return <span className={styles.elapsed}><Clock size={12} />{duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} s`}</span>
}

/** DBX's per-statement result tabs and terminal feedback, using Fouc's native result renderer. */
export function SqlExecutionResults({ execution, provider, layoutScopeKey, view, onViewChange, onCancel, onReveal, onSelect, onPin, currentPinned, headerHost, base, onExplainTarget, onRefresh, autoRefresh, onAutoRefresh, onCloseLastResult }: {
  execution?: SqlExecutionUI; provider: RelationalProvider; layoutScopeKey?: string; view: ResultView; onViewChange: (view: ResultView) => void; onCancel: () => void;
  onReveal: (statement: SqlStatementExecution) => void
  onSelect: (index: number) => void
  onPin?: (statement: SqlStatementExecution, index: number) => void
  currentPinned?: boolean
  headerHost: SqlResultHeaderHost; base: string; onExplainTarget: (target: HTMLDivElement | null) => void
  onRefresh: () => void; autoRefresh: boolean; onAutoRefresh: () => void
  onCloseLastResult: () => void
}) {
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null)
  const [closedResults, setClosedResults] = useState<number[]>([])
  const selected = execution?.selectedResult ?? 0, setSelected = onSelect
  const snapshot = execution?.snapshot, statement = snapshot?.statements[selected] ?? snapshot?.statements[0]
  if (!execution) return <div className="mw-result-state"><Table size={26} /><strong>查询结果</strong><span>运行当前语句或全部语句，在这里查看独立结果。</span><small><kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd> 运行 · <kbd>Ctrl / ⌘</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> 全部运行</small></div>
  if (execution.error) return <div className="mw-result-state mw-result-failed" role="alert"><WarningCircle size={25} /><strong>查询请求未能完成</strong><p>{execution.error}</p><small>编辑内容已保留，可修改 SQL 后重新运行。</small></div>
  if (!snapshot) return <div className="mw-result-state" role="status"><CircleNotch size={26} className="mw-spin" /><strong>正在提交查询</strong><span>准备目标上下文和执行记录…</span></div>
  const lost = !execution.running && sqlExecutionActive(snapshot)
  const active = execution.running
  const openStatements = snapshot.statements.map((item, index) => ({ item, index })).filter(({ index }) => !closedResults.includes(index))
  const sourceLabels = snapshot.statements.map((item, index) => sqlResultLabel(item.sql, provider, snapshot.schema, `结果 ${index + 1}`))
  const tabLabels = sourceLabels.map((label, index) => sqlResultTabLabel(label, [...headerHost.pinnedLabels, ...sourceLabels.slice(0, index)]))
  function closeResult(index: number) {
    if (openStatements.length === 1) onCloseLastResult()
    setClosedResults(previous => [...previous, index])
    if (index === selected) onSelect(openStatements.find(entry => entry.index !== index)?.index ?? 0)
  }
  return <div className={styles.results} data-execution-id={snapshot.id}>
    {headerHost.tabs && createPortal(openStatements.map(({ item, index }) => <div key={index} role="tab" id={`sql-result-${snapshot.id}-${index}`} aria-controls={`sql-result-panel-${snapshot.id}`} aria-label={tabLabels[index]}
      aria-selected={headerHost.active && index === selected} tabIndex={headerHost.active && index === selected ? 0 : -1} className={`${headerStyles.tab} fouc-action`} data-status={item.status} title={item.sql}
      onClick={() => { headerHost.onActivate(); setSelected(index) }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); headerHost.onActivate(); setSelected(index) } navigateWorkbenchTabs(event) }}>
      {item.status !== 'succeeded' && <StatementIcon statement={item} />}<span>{tabLabels[index]}</span><button type="button" className={headerStyles.close} aria-label={`关闭结果 ${index + 1}`} disabled={item.status === 'running' || item.status === 'pending'} onClick={event => { event.stopPropagation(); closeResult(index) }}><X size={14} weight="bold" /></button>
    </div>), headerHost.tabs)}
    {headerHost.pin && onPin && createPortal(<button type="button" className={`fouc-action ${styles.pin}`} aria-label="固定当前结果" disabled={!openStatements.length || !statement?.result || statement.status !== 'succeeded' || currentPinned} title={currentPinned ? '当前结果已固定' : '固定当前结果，再次运行不会覆盖'} onClick={() => statement && onPin(statement, selected)}><PushPin size={19} weight={currentPinned ? 'fill' : 'bold'} /></button>, headerHost.pin)}
    {headerHost.actions && createPortal(<>
      {(active || snapshot.status !== 'completed' || lost) && <span role="status" className={styles.state}>{active ? <CircleNotch size={16} className="mw-spin" /> : snapshot.status === 'failed' || lost ? <WarningCircle size={16} /> : <Stop size={16} />}{lost ? '执行状态已丢失' : labels[snapshot.status]}</span>}
      {active && <><span className={styles.count}>{snapshot.completedCount} / {snapshot.statements.length}</span><Elapsed execution={snapshot} active={active} /></>}
      <div ref={setHeaderTarget} className={styles.headerTools} />
      {active && <Button variant="ghost" size="sm" data-variant="destructive" className={styles.cancel} loading={snapshot.status === 'cancelling' && !execution.connectionError} aria-label="取消查询" onClick={onCancel}><Stop size={16} weight="fill" />取消查询</Button>}
    </>, headerHost.actions)}
    {active && <div className={styles.progress} role="progressbar" aria-label="SQL 执行进度" aria-valuemin={0} aria-valuemax={snapshot.statements.length} aria-valuenow={snapshot.completedCount}><i style={{ width: `${snapshot.completedCount / snapshot.statements.length * 100}%` }} /></div>}
    {execution.connectionError && <p className={styles.connectionError} role="alert">{execution.connectionError}{active && <button type="button" onClick={onCancel}>重试取消</button>}</p>}
    {!openStatements.length && <div className="mw-result-state"><Table size={26} /><strong>本次结果已关闭</strong><span>重新运行查询即可查看结果。</span></div>}
    {openStatements.length > 0 && statement && <div className={styles.body} role="tabpanel" id={`sql-result-panel-${snapshot.id}`} aria-labelledby={`sql-result-${snapshot.id}-${selected}`}>
      {statement.result || view === 'summary' ? <>{statement.result?.messages.filter((message) => message.severity === 'warning').map((message, index) => <p key={index} className={styles.connectionError} role="alert">{message.message}</p>)}<SqlQueryResult key={`${snapshot.id}:${selected}`} scopeKey={`${snapshot.id}:${selected}`} layoutScopeKey={layoutScopeKey ? `${layoutScopeKey}:${selected}` : undefined} provider={provider} result={statement.result} executionSummary={snapshot} executionLost={lost} view={view} onViewChange={onViewChange} headerTarget={headerTarget} queryContext={{ base, sql: statement.sql, schema: snapshot.schema }} active={headerHost.active} onExplainTarget={onExplainTarget} onRefresh={onRefresh} autoRefresh={autoRefresh} onAutoRefresh={onAutoRefresh} /></>
        : statement.error ? <div className={styles.failure} role="alert"><div><WarningCircle size={19} /><strong>语句 {selected + 1} 执行失败</strong>{statement.error.code && <code>{statement.error.code}</code>}</div><p>{statement.error.message}</p>{statement.error.detail && <p>{statement.error.detail}</p>}{statement.error.hint && <small>{statement.error.hint}</small>}<button type="button" onClick={() => onReveal(statement)}>定位到 SQL</button><details><summary>查看本次执行的 SQL</summary><pre>{statement.sql}</pre></details><span>前面已完成的结果仍可查看，后续语句未执行。</span></div>
        : <div className="mw-result-state">{lost ? <WarningCircle size={26} /> : statement.status === 'running' ? <CircleNotch size={26} className="mw-spin" /> : statement.status === 'cancelled' ? <X size={26} /> : <SkipForward size={26} />}<strong>{lost ? '无法确认此语句的结果' : statement.status === 'running' ? '正在执行此语句' : statement.status === 'cancelled' ? '此语句已取消' : statement.status === 'skipped' ? '此语句未执行' : '等待前面的语句完成'}</strong><span>{statement.status === 'cancelled' || statement.status === 'skipped' ? '编辑内容和已完成的结果已保留，可重新运行。' : '可查看已完成的结果或切换其他查询标签。'}</span></div>}
    </div>}
  </div>
}
