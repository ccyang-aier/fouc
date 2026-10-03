'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, ArrowsLeftRight, ArrowsClockwise, LockSimple } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalProvider, SqlDraftTab } from '@fouc/shared'
import { SqlDialog } from '../sql-library-dialog'
import type { SqlExecutionUI } from '../use-sql-executions'
import common from '../relational.module.css'
import { DataComparePanel } from './panel'
import styles from './query-action.module.css'

export type SqlQueryCompareActionProps = { tabs: readonly SqlDraftTab[]; executions: Record<string, SqlExecutionUI>; provider: RelationalProvider; activeTabId: string | null; onNotice: (message: string) => void; onSqlPreview: (sql: string) => void }
type Candidate = { id: string; tabId: string; statementIndex: number; label: string; sql: string; database: string; schema: string | null; result: DatabaseQueryResult }
type CompareSession = { id: string; candidates: Candidate[]; leftId: string; rightId: string; provider: RelationalProvider }

function queryCandidates(tabs: readonly SqlDraftTab[], executions: Record<string, SqlExecutionUI>): Candidate[] {
  const candidates: Candidate[] = []
  for (const tab of tabs) {
    const snapshot = executions[tab.id]?.snapshot
    if (!snapshot) continue
    snapshot.statements.forEach((statement, index) => {
      if (statement.status !== 'succeeded' || !statement.result?.columns.length) return
      candidates.push({ id: `${tab.id}:${snapshot.id}:${index}`, tabId: tab.id, statementIndex: index, label: `${tab.title} · 语句 ${index + 1} · ${statement.result.rows.length.toLocaleString()} 行`, sql: statement.sql, database: snapshot.database, schema: snapshot.schema, result: statement.result })
    })
  }
  return candidates
}

export function SqlQueryCompareAction({ tabs, executions, provider, activeTabId, onNotice, onSqlPreview }: SqlQueryCompareActionProps) {
  const candidates = useMemo(() => queryCandidates(tabs, executions), [tabs, executions])
  const [session, setSession] = useState<CompareSession | null>(null)
  function openLatest() {
    if (candidates.length < 2) return
    const right = candidates.find((candidate) => candidate.tabId === activeTabId && candidate.statementIndex === executions[activeTabId ?? '']?.selectedResult) ?? candidates.find((candidate) => candidate.tabId === activeTabId) ?? candidates[candidates.length - 1]
    const left = candidates.find((candidate) => candidate.id !== right.id && candidate.tabId !== right.tabId) ?? candidates.find((candidate) => candidate.id !== right.id)!
    // Execution polling replaces snapshots. Capture the current objects, never follow later executions.
    setSession({ id: crypto.randomUUID(), candidates: [...candidates], leftId: left.id, rightId: right.id, provider })
  }
  const left = session?.candidates.find((candidate) => candidate.id === session.leftId), right = session?.candidates.find((candidate) => candidate.id === session.rightId)
  const currentIds = new Set(candidates.map((candidate) => candidate.id)), latestChanged = session !== null && (session.candidates.length !== candidates.length || session.candidates.some((candidate) => !currentIds.has(candidate.id)) || session.provider !== provider)
  function changeSide(side: 'leftId' | 'rightId', id: string) {
    setSession((previous) => previous ? { ...previous, [side]: id } : null)
  }
  return <>
    <button type="button" aria-label="比较查询结果" disabled={candidates.length < 2} onClick={openLatest} title={candidates.length < 2 ? '至少需要两份成功并返回列的查询结果' : '比较当前连接内两份已加载查询结果'}><ArrowsLeftRight size={14} /><span>比较查询结果</span></button>
    {session && left && right && <SqlDialog title="比较查询结果" className={styles.dialog} onClose={() => setSession(null)}>
      <div className={styles.sources}><label><span>左侧参考结果</span><select aria-label="比较左侧查询结果" value={session.leftId} onChange={(event) => changeSide('leftId', event.target.value)}>{session.candidates.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={candidate.id === session.rightId}>{candidate.label}</option>)}</select><small title={left.sql}>{left.database}{left.schema && left.schema !== left.database ? ` / ${left.schema}` : ''} · {left.sql.replace(/\s+/g, ' ').slice(0, 180)}</small></label><ArrowRight size={17} /><label><span>右侧目标结果</span><select aria-label="比较右侧查询结果" value={session.rightId} onChange={(event) => changeSide('rightId', event.target.value)}>{session.candidates.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={candidate.id === session.leftId}>{candidate.label}</option>)}</select><small title={right.sql}>{right.database}{right.schema && right.schema !== right.database ? ` / ${right.schema}` : ''} · {right.sql.replace(/\s+/g, ' ').slice(0, 180)}</small></label></div>
      <div className={styles.snapshot}><LockSimple size={12} /><span>{latestChanged ? '查询结果列表已更新；当前审查继续使用打开时的快照。' : '当前连接内的已成功结果快照；继续执行查询不会改变本次审查。'}</span>{latestChanged && <button type="button" disabled={candidates.length < 2} onClick={openLatest}><ArrowsClockwise size={12} />重新打开最新来源</button>}</div>
      <div className={styles.body}><DataComparePanel key={`${session.id}:${left.id}:${right.id}`} left={left.result} right={right.result} leftLabel={left.label} rightLabel={right.label} provider={session.provider} scopeKey={`${session.id}:${left.id}:${right.id}`} onNotice={onNotice} onSqlPreview={(sql) => { setSession(null); onSqlPreview(sql) }} /></div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}><span>SQL 候选可放入新查询标签审查</span><button type="button" className={common.secondary} onClick={() => setSession(null)}>关闭比较</button></footer>
    </SqlDialog>}
  </>
}
