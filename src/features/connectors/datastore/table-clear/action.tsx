'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy } from '@phosphor-icons/react/dist/csr/Copy'
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen'
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import type { RelationalSession } from '@fouc/shared'
import { SqlDialog } from '../sql-library-dialog'
import { TableClearReviewContent } from './review'
import { TableClearResultContent } from './result'
import { useTableClear } from './use-table-clear'
import styles from './table-clear.module.css'

export interface TableClearActionProps {
  base: string; session: RelationalSession; schema: string; table: string; writable: boolean; disabled: boolean
  onUnlock: () => Promise<void>; onCleared: () => void; onBusyChange: (busy: boolean) => void
}
export function TableClearAction(props: TableClearActionProps) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className={styles.action} aria-label="清空当前数据表" disabled={props.disabled || !props.table} onClick={() => setOpen(true)}><Trash size={14} /><span>清空表</span></button>{open && <TableClearDialog key={`${props.base}:${props.schema}:${props.table}`} {...props} onClose={() => setOpen(false)} />}</>
}

function TableClearDialog({ base, session, schema, table, writable, onUnlock, onCleared, onBusyChange, onClose }: TableClearActionProps & { onClose: () => void }) {
  const flow = useTableClear(base, onCleared, onBusyChange)
  const [identity, setIdentity] = useState(false), [triggers, setTriggers] = useState(false)
  const [confirmedName, setConfirmedName] = useState(''), [dirty, setDirty] = useState(false)
  const [unlocking, setUnlocking] = useState(false), [notice, setNotice] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const body = useRef<HTMLDivElement>(null)
  const input = useMemo(() => ({ schema, table, acknowledgeIdentityReset: identity, acknowledgeTriggers: triggers }), [schema, table, identity, triggers])
  const { preview } = flow
  useEffect(() => {
    let disposed = false
    queueMicrotask(() => { if (!disposed) void preview({ schema, table, acknowledgeIdentityReset: false, acknowledgeTriggers: false }) })
    return () => { disposed = true }
  }, [preview, schema, table])
  useEffect(() => {
    if (!flow.prepared || flow.result) return
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [flow.prepared, flow.result])
  useEffect(() => {
    if (flow.result && body.current) body.current.scrollTop = 0
  }, [flow.result])
  const review = flow.prepared?.review
  const remaining = flow.prepared ? Math.max(0, Math.ceil((flow.prepared.expiresAt - clock) / 1000)) : 0
  const committing = flow.busy === 'commit'
  const canCommit = Boolean(review && writable && !dirty && !flow.busy && !unlocking && remaining && !review.blockedReasons.length && confirmedName === review.confirmationName)
  async function refresh() {
    setConfirmedName(''); setNotice(''); setDirty(false); setClock(Date.now())
    await flow.preview(input)
  }
  async function unlock() {
    setUnlocking(true); setNotice(''); setConfirmedName('')
    try { await onUnlock(); await refresh(); setNotice('已解锁并重新只读审查；请输入完整表名后明确确认。') }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)) }
    finally { setUnlocking(false) }
  }
  async function copy() {
    if (!review) return
    try { await navigator.clipboard.writeText(review.sql); setNotice(flow.result ? '完整受控 SQL 已复制。' : '完整受控 SQL 已复制；尚未执行。') }
    catch { setNotice('复制失败，请从 SQL 区域手动选择并复制。') }
  }
  return <SqlDialog title="清空数据表" onClose={onClose} busy={committing || unlocking} className={styles.dialog}>
    <div className={styles.body} ref={body}>
      <div className={styles.target}><span>目标原生表</span><strong>{schema}.{table}</strong><small>{session.provider === 'postgres' ? 'PostgreSQL' : session.provider === 'mysql' ? 'MySQL' : 'SQLite'} · 所有数据 · 结构保留</small></div>
      {flow.busy === 'preview' && <div className={styles.loading} role="status"><SpinnerGap className="mw-spin" size={18} />读取真实结构、引用、权限与当前可见行数…<small>只读审查，尚未清空任何数据。</small></div>}
      {review && <>
        {flow.result && <TableClearResultContent result={flow.result} />}
        <TableClearReviewContent review={review} />
        {!flow.result && <>
          {review.identity === 'reset' && <label className={styles.check}><input type="checkbox" checked={identity} disabled={Boolean(flow.busy) || unlocking} onChange={event => { setIdentity(event.target.checked); setDirty(true); setConfirmedName('') }} /><span>我明确接受 MySQL AUTO_INCREMENT 重置<small>选择变化后必须重新审查；默认阻止重置。</small></span></label>}
          {review.triggers.length > 0 && <label className={styles.check}><input type="checkbox" checked={triggers} disabled={Boolean(flow.busy) || unlocking} onChange={event => { setTriggers(event.target.checked); setDirty(true); setConfirmedName('') }} /><span>我已审查原生触发器及其对其他表的影响<small>触发器代码来自当前数据库目录，不保证无额外副作用。</small></span></label>}
          {dirty && <p className={styles.caption} role="status">风险选择已变化，请重新读取并审查。</p>}
          {!writable && <div className={styles.unlock}><LockOpen size={18} /><span>会话当前锁定写入。解锁后会撤销旧计划并重新审查。</span><button type="button" disabled={Boolean(flow.busy) || unlocking} onClick={() => void unlock()}>{unlocking ? '解锁并重新审查…' : '解锁表清空'}</button></div>}
          <label className={styles.confirm}><strong>危险确认：输入完整 Schema.表名</strong><code>{review.confirmationName}</code><input aria-label="清空危险确认完整表名" autoComplete="off" spellCheck={false} value={confirmedName} disabled={!writable || committing || unlocking || dirty || !remaining || Boolean(review.blockedReasons.length)} onChange={event => setConfirmedName(event.target.value)} placeholder={review.confirmationName} /><small>确认会移除整表数据。此操作与当前结果中的筛选和选择无关。</small></label>
        </>}
      </>}
      {flow.error && <p className={styles.error} role="alert">{flow.error}</p>}
      {notice && <p className={styles.caption} role="status">{notice}</p>}
      {committing && <p className={styles.caption} role="status">正在等待原生服务器最终确认；{session.provider === 'mysql' ? '已提交的 TRUNCATE 不能撤销。' : '提交前中断由事务处理，不能把网络断开当作已回滚。'}</p>}
    </div>
    <footer className={styles.footer}><button type="button" disabled={committing || unlocking} onClick={onClose}>{flow.result ? '关闭' : '取消'}</button><span>{flow.result ? '计划已消费' : flow.prepared ? remaining ? `计划剩余 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '计划已过期' : '零写入审查'}</span>{review && <button type="button" disabled={committing || unlocking} aria-label="复制表清空 SQL" onClick={() => void copy()}><Copy size={14} /></button>}{!flow.result && <><button type="button" disabled={Boolean(flow.busy) || unlocking} onClick={() => void refresh()}>{flow.busy === 'preview' ? '只读审查中…' : '重新读取并审查'}</button><button type="button" className={styles.danger} disabled={!canCommit} onClick={() => { setNotice(''); void flow.commit(confirmedName) }}>{committing ? <SpinnerGap className="mw-spin" size={14} /> : <Trash size={14} />}{committing ? '等待原生确认…' : '确认清空整表'}</button></>}</footer>
  </SqlDialog>
}
