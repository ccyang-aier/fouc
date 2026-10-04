'use client'

import { useEffect, useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Copy } from '@phosphor-icons/react/dist/csr/Copy'
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen'
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap'
import { TreeStructure } from '@phosphor-icons/react/dist/csr/TreeStructure'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { RelationalSession } from '@fouc/shared'
import { SqlDialog } from '../sql-library-dialog'
import { IndexDesigner } from './designer'
import { useIndexEdit } from './use-index-edit'
import styles from './index-edit.module.css'

interface Props {
  base: string
  schema: string
  table: string
  disabled: boolean
  onChanged: () => void
  onWriteAccessChanged?: (session: RelationalSession) => void
}

export function IndexEditAction(props: Props) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={styles.trigger} disabled={props.disabled}
      aria-label="管理独立索引" onClick={() => setOpen(true)}>
      <TreeStructure size={14} /><span>管理索引</span>
    </button>
    {open && <IndexDialog key={`${props.base}:${props.schema}:${props.table}`}
      {...props} onClose={() => setOpen(false)} />}
  </>
}

function IndexDialog({ base, schema, table, onChanged, onWriteAccessChanged, onClose }: Props & { onClose: () => void }) {
  const flow = useIndexEdit(base, schema, table, onChanged, onWriteAccessChanged)
  const [confirmed, setConfirmed] = useState(false)
  const [dropName, setDropName] = useState('')
  const [notice, setNotice] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const review = flow.prepared?.review
  const remaining = flow.prepared ? Math.max(0, Math.min(300, Math.ceil((flow.prepared.expiresAt - clock) / 1000))) : 0
  const locked = flow.busy === 'commit' || flow.busy === 'unlock'
  const dropConfirmed = review?.operation !== 'drop' || dropName === review.index
  useEffect(() => {
    if (!flow.prepared) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [flow.prepared])
  async function copy() {
    try { await navigator.clipboard.writeText(review!.sql); setNotice('完整索引 DDL 已复制。') }
    catch { setNotice('无法访问剪贴板，请手动选择 DDL 复制。') }
  }
  const feedback = <>
    {flow.error && <div className={styles.error} role="alert">
      <Warning size={15} /><span>{flow.error}</span>
      {!review && <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.load()}>重新读取</button>}
    </div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </>
  return <SqlDialog title="原生索引管理" className={styles.dialog} busy={locked} onClose={onClose}>
    <div className={styles.context}>
      <TreeStructure size={17} />
      <div>
        <strong>{schema}.{table}</strong>
        <span>{flow.options?.provider === 'postgres' ? 'PostgreSQL' : flow.options?.provider === 'mysql' ? 'MySQL' : flow.options?.provider === 'sqlite' ? 'SQLite' : '原生表索引'} · 独立索引</span>
      </div>
      <span className={styles.badge}>{flow.result ? '执行结果' : review ? '只读 DDL 审查' : '索引设计'}</span>
    </div>
    {!review && flow.options ? <IndexDesigner options={flow.options} busy={Boolean(flow.busy)} onClose={onClose}
      onPreview={async input => { setConfirmed(false); setDropName(''); setNotice(''); await flow.preview(input) }}>
      {feedback}
    </IndexDesigner> : <>
      <div className={styles.body}>
        {review ? <>
          <div className={styles.reviewHead}>
            <strong>{review.operation === 'drop' ? '删除' : '创建'} {review.index}</strong>
            <span>{review.transaction === 'atomic' ? '原生事务' : '隐式提交'} · {flow.result ? '计划已消费' : remaining ? `有效 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '计划已失效'}</span>
            <button type="button" aria-label="复制完整索引 DDL" onClick={() => void copy()}><Copy size={13} />复制 DDL</button>
          </div>
          <pre className={styles.sql} aria-label="完整索引 DDL">{review.sql}</pre>
          {review.existing?.definition && <details className={styles.existing}>
            <summary>查看当前原生索引定义</summary><pre>{review.existing.definition}</pre>
          </details>}
          <ul className={styles.warnings}>{review.warnings.map(message => <li key={message}>{message}</li>)}</ul>
          {!flow.result && <div className={styles.confirmation}>
            {!flow.writable ? <div className={styles.unlock}>
              <LockOpen size={17} />
              <span>当前会话只读，DDL 审查没有写入。<small>解锁只开放写入能力；仍需下方独立确认。</small></span>
              <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.unlock()}>{flow.busy === 'unlock' ? '正在解锁…' : '显式解锁写入'}</button>
            </div> : <p className={styles.unlocked}><CheckCircle size={15} />当前会话写入已解锁</p>}
            {review.operation === 'drop' && <label className={styles.dropConfirm}>
              输入完整索引名称以确认危险删除
              <input aria-label="确认删除索引名称" value={dropName} disabled={locked} placeholder={review.index}
                autoComplete="off" onChange={event => setDropName(event.target.value)} />
            </label>}
            <label className={styles.confirmCheck}>
              <input type="checkbox" aria-label="确认索引 DDL" checked={confirmed} disabled={locked}
                onChange={event => setConfirmed(event.target.checked)} />
              <span>我已审查目标、完整 DDL 与{review.operation === 'drop' ? '不可撤销的删除影响' : '唯一性及构建影响'}，确认执行此一次性计划。</span>
            </label>
          </div>}
          {flow.result && <div className={`${styles.result} ${flow.result.outcome === 'created' || flow.result.outcome === 'dropped' ? styles.success : styles.failure}`} role="status">
            <strong>{flow.result.outcome === 'created' ? '索引已创建' : flow.result.outcome === 'dropped' ? '索引已删除' : flow.result.outcome === 'unknown' ? '结果未确认' : '未执行成功'}</strong>
            <p>{flow.result.message}</p><small>{flow.result.executionTimeMs.toFixed(0)} ms · 以刷新后的原生结构为准</small>
          </div>}
        </> : <div className={styles.loading}><SpinnerGap size={17} className="mw-spin" /><span>读取真实字段、索引与原生能力…</span></div>}
        {feedback}
      </div>
      <footer className={styles.footer}>
        <button type="button" disabled={locked} onClick={onClose}>{flow.result ? '完成' : '关闭'}</button>
        {review && !flow.result && <button type="button" disabled={locked}
          onClick={() => { setConfirmed(false); setDropName(''); setNotice(''); void flow.edit() }}>返回编辑</button>}
        <span />
        {review && !flow.result && <button className={review.operation === 'drop' ? styles.destructive : styles.primary} type="button"
          disabled={Boolean(flow.busy) || !flow.writable || !confirmed || !dropConfirmed || remaining === 0} onClick={() => void flow.commit()}>
          {flow.busy === 'commit' ? '原生执行中…' : review.operation === 'drop' ? '确认删除索引' : '确认创建索引'}
        </button>}
      </footer>
    </>}
  </SqlDialog>
}
