'use client'

import { useEffect, useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Copy } from '@phosphor-icons/react/dist/csr/Copy'
import { Database } from '@phosphor-icons/react/dist/csr/Database'
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { RelationalSession } from '@fouc/shared'
import { schemaCreateNameError } from '@fouc/shared/schema-create'
import { SqlDialog } from '../sql-library-dialog'
import { useSchemaCreate } from './use-schema-create'
import styles from './schema-create.module.css'

interface Props {
  session: RelationalSession
  base: string
  writable: boolean
  disabled: boolean
  onUnlock: () => Promise<void>
  onCreated: (name: string) => void
  onBusyChange: (busy: boolean) => void
}

export function SchemaCreateAction(props: Props) {
  const [open, setOpen] = useState(false)
  const supported = props.session.provider !== 'sqlite'
  const label = props.session.provider === 'postgres' ? '新建 Schema' : props.session.provider === 'mysql' ? '新建数据库' : 'SQLite 不支持新建资源'
  return <>
    <button type="button" className={styles.trigger} disabled={props.disabled || !supported} title={supported ? label : 'SQLite 仅使用当前数据库文件，不提供创建命名空间'} aria-label={label} onClick={() => setOpen(true)}><Plus size={14} /><span>{supported ? label : '新建资源'}</span></button>
    {open && <CreateDialog key={props.base} {...props} onClose={() => setOpen(false)} />}
  </>
}

function CreateDialog({ session, base, writable, onUnlock, onCreated, onBusyChange, onClose }: Props & { onClose: () => void }) {
  const flow = useSchemaCreate(base, onCreated, onBusyChange)
  const [name, setName] = useState('')
  const [charset, setCharset] = useState('')
  const [collation, setCollation] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const mysql = session.provider === 'mysql'
  const title = mysql ? '新建数据库' : '新建 Schema'
  const selectedCharset = flow.options?.charsets.find(item => item.name === charset)
  const nameError = schemaCreateNameError(session.provider, name)
  const remaining = flow.prepared ? Math.max(0, Math.min(5 * 60, Math.ceil((flow.prepared.expiresAt - clock) / 1000))) : 0
  const locked = flow.busy === 'commit' || unlocking
  useEffect(() => {
    if (!flow.prepared) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [flow.prepared])

  async function unlock() {
    setUnlocking(true); setUnlockError('')
    try { await onUnlock() }
    catch (reason) { setUnlockError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setUnlocking(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(flow.prepared!.review.sql); setCopied(true) }
    catch { setUnlockError('无法写入剪贴板，请手动选择 SQL 复制。') }
  }
  function back() { setConfirmed(false); setCopied(false); void flow.edit() }
  const review = flow.prepared?.review
  return <SqlDialog title={title} className={styles.dialog} busy={locked} onClose={onClose}>
    <div className={styles.context}><Database size={17} /><div><strong>{session.info.productName}</strong><span>当前连接 · {session.database}</span></div><span className={styles.scope}>{mysql ? '数据库级资源' : '当前数据库内'}</span></div>
    <div className={styles.steps} aria-label="创建流程"><span className={!review ? styles.active : ''}>01 · 配置</span><i /><span className={review && !flow.result ? styles.active : ''}>02 · 审查与确认</span><i /><span className={flow.result ? styles.active : ''}>03 · 结果</span></div>
    <div className={styles.body}>
      {!review ? <>
        <label className={styles.field}>{mysql ? '数据库名称' : 'Schema 名称'}<input aria-label="新资源名称" value={name} disabled={Boolean(flow.busy)} autoFocus maxLength={128} placeholder={mysql ? '例如：research_data' : '例如：research'} onChange={event => setName(event.target.value)} /><small>{name && nameError ? nameError : mysql ? '最多 64 个字符。名称将按原始拼写安全引用。' : '最多 63 个 UTF-8 字节。大小写与特殊字符会保留。'}</small></label>
        {mysql && <div className={styles.options}>
          <label className={styles.field}>字符集<select aria-label="新数据库字符集" value={charset} disabled={!flow.options || Boolean(flow.busy)} onChange={event => { setCharset(event.target.value); setCollation('') }}><option value="">继承服务器默认值</option>{flow.options?.charsets.map(item => <option key={item.name} value={item.name}>{item.name}{item.description ? ` · ${item.description}` : ''}</option>)}</select></label>
          <label className={styles.field}>校对规则<select aria-label="新数据库校对规则" value={collation} disabled={!charset || Boolean(flow.busy)} onChange={event => setCollation(event.target.value)}><option value="">字符集默认值{selectedCharset?.defaultCollation ? ` · ${selectedCharset.defaultCollation}` : ''}</option>{selectedCharset?.collations.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>}
        {flow.busy === 'options' ? <p className={styles.notice} role="status"><SpinnerGap size={15} className="mw-spin" />正在读取原生创建选项与权限…</p> : flow.options?.permission === 'denied' ? <p className={styles.error} role="alert">当前角色没有在此数据库创建 Schema 的权限。请重新连接具有 CREATE 权限的角色。</p> : <div className={styles.notice}><Warning size={16} /><span>{mysql ? '仅创建一个空数据库。MySQL DDL 会隐式提交；不会切换当前数据库或修改其他资源。' : '仅在当前数据库创建一个空 Schema，所有者为当前角色；不创建新数据库。'}<small>审查阶段不执行 CREATE。需要解锁写入并显式确认后才能提交。</small></span></div>}
      </> : <>
        <dl className={styles.target}><div><dt>创建目标</dt><dd>{review.target === 'database' ? 'MySQL 数据库' : 'PostgreSQL Schema'}</dd></div><div><dt>名称</dt><dd>{review.name}</dd></div><div><dt>{mysql ? '当前连接数据库' : '所在数据库'}</dt><dd>{review.database}</dd></div><div><dt>计划有效期</dt><dd>{flow.result ? '已消费 · 不可重放' : remaining ? `${Math.floor(remaining / 60)}分 ${remaining % 60}秒` : '已失效 · 重新审查'}</dd></div></dl>
        <div className={styles.sql}><header><span>将执行的原生 DDL</span><button type="button" onClick={() => void copy()} aria-label="复制创建 SQL"><Copy size={14} />{copied ? '已复制' : '复制'}</button></header><pre>{review.sql}</pre></div>
        <ul className={styles.warnings}>{review.warnings.map(message => <li key={message}>{message}</li>)}</ul>
        {flow.result ? <div className={`${styles.result} ${flow.result.outcome === 'created' ? styles.success : styles.uncertain}`} role={flow.result.outcome === 'created' ? 'status' : 'alert'}>{flow.result.outcome === 'created' ? <CheckCircle size={22} /> : <Warning size={22} />}<div><strong>{flow.result.outcome === 'created' ? '创建已确认' : flow.result.outcome === 'unknown' ? '结果未确认' : '创建未完成'}</strong><p>{flow.result.message}</p>{flow.result.executionTimeMs > 0 && <small>原生执行 · {flow.result.executionTimeMs.toFixed(0)} ms</small>}</div></div> : <>
          {!writable && <div className={styles.unlock}><LockOpen size={17} /><span>当前会话已锁定写入。审查完成后可显式解锁。</span><button type="button" disabled={unlocking || !remaining} onClick={() => void unlock()}>{unlocking ? '解锁中…' : '解锁资源创建'}</button></div>}
          <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={!writable || locked || !remaining} onChange={event => setConfirmed(event.target.checked)} /><span>我已审查以上 DDL，确认创建 <strong>{review.name}</strong>。{mysql && <small>理解 MySQL 创建数据库不能通过事务撤销。</small>}</span></label>
        </>}
      </>}
      {(flow.error || unlockError) && <p role="alert" className={styles.error}>{flow.error || unlockError}{!flow.options && <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.load()}>重新读取选项</button>}</p>}
    </div>
    <footer className={styles.footer}><button type="button" disabled={locked} onClick={onClose}>{flow.result ? '关闭' : '取消'}</button><span />{review && !flow.result && <button type="button" disabled={locked || Boolean(flow.busy)} onClick={back}>返回配置</button>}{!review ? <button type="button" className={styles.primary} disabled={Boolean(flow.busy) || !flow.options?.supported || flow.options.permission === 'denied' || Boolean(nameError)} onClick={() => { setConfirmed(false); setClock(Date.now()); void flow.preview({ name, charset: charset || null, collation: collation || null }) }}>{flow.busy === 'preview' ? <SpinnerGap size={14} className="mw-spin" /> : null}{flow.busy === 'preview' ? '正在准备…' : '审查创建 DDL'}</button> : !flow.result && <button type="button" className={styles.primary} disabled={!writable || !confirmed || !remaining || locked || Boolean(flow.busy)} onClick={() => void flow.commit()}>{flow.busy === 'commit' ? <SpinnerGap size={14} className="mw-spin" /> : <Plus size={14} />}{flow.busy === 'commit' ? '原生创建中…' : '确认创建资源'}</button>}</footer>
  </SqlDialog>
}
