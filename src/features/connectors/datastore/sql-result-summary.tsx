"use client"

import { Check, CircleNotch, Clock, Minus, Stop, WarningCircle } from '@phosphor-icons/react'
import type { DatabaseQueryResult, SqlExecutionSnapshot, SqlStatementExecution } from '@fouc/shared'
import styles from './sql-result-summary.module.css'

const executionLabels = { running: '正在执行', cancelling: '正在停止', completed: '执行完成', failed: '执行中断', cancelled: '已取消' }
const statusLabels = { pending: '等待执行', running: '执行中', succeeded: '成功', failed: '失败', cancelled: '已取消', skipped: '未执行' }
type SummaryStatement = Pick<SqlStatementExecution, 'sql' | 'status' | 'result' | 'error' | 'startedAt' | 'finishedAt'>

export function SqlResultSummary({ execution, result, sql, lost = false }: { execution?: SqlExecutionSnapshot; result: DatabaseQueryResult | null; sql?: string; lost?: boolean }) {
  const statements: SummaryStatement[] = execution?.statements ?? (result ? [{ sql: sql ?? '', status: 'succeeded', result, error: null, startedAt: null, finishedAt: null }] : [])
  const completed = execution?.completedCount ?? statements.length, total = statements.length, percentage = total ? Math.round(completed / total * 100) : 0
  return <section className={styles.summary} aria-label="SQL 执行摘要">
    <div className={styles.sheet}>
      <div className={styles.progress}>
        <div className={styles.caption}><span>{lost ? '执行状态已丢失' : executionLabels[execution?.status ?? 'completed']}</span><span>{completed} / {total}</span><span>{percentage}%</span></div>
        <div className={styles.track} role="progressbar" aria-label="语句执行完成比例" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={completed}><i style={{ width: `${percentage}%` }} /></div>
      </div>
      <div className={styles.scroll}><table><colgroup><col className={styles.number} /><col /><col className={styles.statusColumn} /><col className={styles.metric} /><col className={styles.metric} /></colgroup>
        <thead><tr><th>语句</th><th>SQL</th><th>状态</th><th>返回行</th><th>耗时</th></tr></thead>
        <tbody>{statements.map((statement, index) => {
          const duration = statement.result?.executionTimeMs ?? (statement.startedAt !== null && statement.finishedAt !== null ? Math.max(0, statement.finishedAt - statement.startedAt) : null)
          const status = statement.status, Icon = status === 'succeeded' ? Check : status === 'failed' ? WarningCircle : status === 'running' ? CircleNotch : status === 'cancelled' ? Stop : status === 'pending' ? Clock : Minus
          return <tr key={index}><th>#{index + 1}</th><td><code title={statement.sql}>{statement.sql || '—'}</code>{statement.error && <p className={styles.error}>{statement.error.message}</p>}</td>
            <td><span className={styles.status} data-status={status}><Icon size={14} className={status === 'running' && !lost ? 'mw-spin' : undefined} />{status === 'running' && lost ? '状态未知' : statusLabels[status]}</span></td>
            <td title={statement.result?.truncated || statement.result?.hasMore ? '仅包含本次已返回行' : undefined}>{statement.result ? statement.result.rows.length.toLocaleString() : '—'}</td><td>{duration !== null ? `${duration}ms` : '—'}</td></tr>
        })}</tbody>
      </table></div>
    </div>
  </section>
}
