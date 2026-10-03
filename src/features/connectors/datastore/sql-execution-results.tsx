"use client"
import { useEffect, useState } from 'react'
import { Check, CircleNotch, Clock, SkipForward, Stop, Table, WarningCircle, X } from '@phosphor-icons/react'
import { sqlExecutionActive, type RelationalProvider, type SqlExecutionSnapshot, type SqlStatementExecution, type SqlResultView as ResultView } from '@fouc/shared'
import type { SqlExecutionUI } from './use-sql-executions'
import { SqlQueryResult } from './query-result'
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
export function SqlExecutionResults({ execution, provider, view, onViewChange, onCancel, onReveal, onSelect }: {
  execution?: SqlExecutionUI; provider: RelationalProvider; view: ResultView; onViewChange: (view: ResultView) => void; onCancel: () => void;
  onReveal: (statement: SqlStatementExecution) => void
  onSelect: (index: number) => void
}) {
  const selected = execution?.selectedResult ?? 0, setSelected = onSelect
  const snapshot = execution?.snapshot, statement = snapshot?.statements[selected] ?? snapshot?.statements[0]
  if (!execution) return <div className="mw-result-state"><Table size={26} /><strong>查询结果</strong><span>运行当前语句或全部语句，在这里查看独立结果。</span><small><kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd> 运行 · <kbd>Ctrl / ⌘</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> 全部运行</small></div>
  if (execution.error) return <div className="mw-result-state mw-result-failed" role="alert"><WarningCircle size={25} /><strong>查询请求未能完成</strong><p>{execution.error}</p><small>编辑内容已保留，可修改 SQL 后重新运行。</small></div>
  if (!snapshot) return <div className="mw-result-state" role="status"><CircleNotch size={26} className="mw-spin" /><strong>正在提交查询</strong><span>准备目标上下文和执行记录…</span></div>
  const lost = !execution.running && sqlExecutionActive(snapshot)
  const active = execution.running
  return <div className={styles.results} data-execution-id={snapshot.id}>
    <header className={styles.summary} data-status={snapshot.status}>
      <span role="status" className={styles.state}>{active ? <CircleNotch size={13} className="mw-spin" /> : snapshot.status === 'completed' ? <Check size={13} /> : snapshot.status === 'failed' || lost ? <WarningCircle size={13} /> : <Stop size={13} />}{lost ? '执行状态已丢失' : labels[snapshot.status]}</span>
      <span className={styles.count}>{snapshot.completedCount} / {snapshot.statements.length} 条完成</span><Elapsed execution={snapshot} active={active} />
      {active && <button type="button" className={styles.cancel} disabled={snapshot.status === 'cancelling' && !execution.connectionError} onClick={onCancel}><Stop size={13} weight="fill" />{snapshot.status === 'cancelling' ? '停止中…' : '取消查询'}</button>}
    </header>
    {active && <div className={styles.progress} role="progressbar" aria-label="SQL 执行进度" aria-valuemin={0} aria-valuemax={snapshot.statements.length} aria-valuenow={snapshot.completedCount}><i style={{ width: `${snapshot.completedCount / snapshot.statements.length * 100}%` }} /></div>}
    {execution.connectionError && <p className={styles.connectionError} role="alert">{execution.connectionError}{active && <button type="button" onClick={onCancel}>重试取消</button>}</p>}
    <div className={styles.tabs} role="tablist" aria-label="SQL 语句结果">
      {snapshot.statements.map((item, index) => <button type="button" role="tab" id={`sql-result-${snapshot.id}-${index}`} aria-controls={`sql-result-panel-${snapshot.id}`} aria-selected={index === selected} tabIndex={index === selected ? 0 : -1}
        data-status={item.status} key={index} title={item.sql} onClick={() => setSelected(index)} onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % snapshot.statements.length : event.key === 'ArrowLeft' ? (index - 1 + snapshot.statements.length) % snapshot.statements.length : event.key === 'Home' ? 0 : event.key === 'End' ? snapshot.statements.length - 1 : null
          if (next !== null) { event.preventDefault(); setSelected(next); document.getElementById(`sql-result-${snapshot.id}-${next}`)?.focus() }
        }}><StatementIcon statement={item} /><span>结果 {index + 1}</span>{item.result && <small>{item.result.rows.length.toLocaleString()} 行{item.result.truncated ? '+' : ''}</small>}</button>)}
    </div>
    {statement && <div className={styles.body} role="tabpanel" id={`sql-result-panel-${snapshot.id}`} aria-labelledby={`sql-result-${snapshot.id}-${selected}`}>
      {statement.result ? <>{statement.result.messages.filter((message) => message.severity === 'warning').map((message, index) => <p key={index} className={styles.connectionError} role="alert">{message.message}</p>)}<SqlQueryResult key={`${snapshot.id}:${selected}`} scopeKey={`${snapshot.id}:${selected}`} provider={provider} result={statement.result} view={view} onViewChange={onViewChange} /></>
        : statement.error ? <div className={styles.failure} role="alert"><div><WarningCircle size={19} /><strong>语句 {selected + 1} 执行失败</strong>{statement.error.code && <code>{statement.error.code}</code>}</div><p>{statement.error.message}</p>{statement.error.detail && <p>{statement.error.detail}</p>}{statement.error.hint && <small>{statement.error.hint}</small>}<button type="button" onClick={() => onReveal(statement)}>定位到 SQL</button><details><summary>查看本次执行的 SQL</summary><pre>{statement.sql}</pre></details><span>前面已完成的结果仍可查看，后续语句未执行。</span></div>
        : <div className="mw-result-state">{lost ? <WarningCircle size={26} /> : statement.status === 'running' ? <CircleNotch size={26} className="mw-spin" /> : statement.status === 'cancelled' ? <X size={26} /> : <SkipForward size={26} />}<strong>{lost ? '无法确认此语句的结果' : statement.status === 'running' ? '正在执行此语句' : statement.status === 'cancelled' ? '此语句已取消' : statement.status === 'skipped' ? '此语句未执行' : '等待前面的语句完成'}</strong><span>{statement.status === 'cancelled' || statement.status === 'skipped' ? '编辑内容和已完成的结果已保留，可重新运行。' : '可查看已完成的结果或切换其他查询标签。'}</span></div>}
    </div>}
  </div>
}
