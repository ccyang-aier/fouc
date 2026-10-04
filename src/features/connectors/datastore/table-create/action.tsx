'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Copy } from '@phosphor-icons/react/dist/csr/Copy'
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap'
import { Table } from '@phosphor-icons/react/dist/csr/Table'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { RelationalSession } from '@fouc/shared'
import { TABLE_CREATE_LIMITS, tableCreateNewColumn, validateTableCreateInput, type TableCreateColumn } from '@fouc/shared/table-create'
import { SqlDialog } from '../sql-library-dialog'
import { TableCreateColumnRow } from './column-row'
import { useTableCreate } from './use-table-create'
import styles from './table-create.module.css'

interface Props {
  base: string; session: RelationalSession; schema: string; writable: boolean; disabled: boolean
  onUnlock: () => Promise<void>; onCreated: () => void; onBusyChange: (busy: boolean) => void
}
export function TableCreateAction(props: Props) {
  const [open, setOpen] = useState(false)
  return <><button className={styles.trigger} type="button" disabled={props.disabled} onClick={() => setOpen(true)} aria-label="新建数据表"><Plus size={14} /><span>新建表</span></button>{open && <CreateTableDialog key={props.base} {...props} onClose={() => setOpen(false)} />}</>
}

function CreateTableDialog({ base, session, schema: initialSchema, writable, onUnlock, onCreated, onBusyChange, onClose }: Props & { onClose: () => void }) {
  const flow = useTableCreate(base, onCreated, onBusyChange)
  const [schema, setSchema] = useState(initialSchema)
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState<TableCreateColumn[]>(() => [tableCreateNewColumn(session.provider, crypto.randomUUID(), true)])
  const [confirmed, setConfirmed] = useState(false), [clock, setClock] = useState(() => Date.now())
  const [unlocking, setUnlocking] = useState(false), [notice, setNotice] = useState('')
  const targetSchema = schema || (flow.options?.schemas.includes(session.database) ? session.database : flow.options?.schemas.includes('public') ? 'public' : flow.options?.schemas[0] ?? '')
  const input = useMemo(() => ({ schema: targetSchema, table, columns }), [targetSchema, table, columns])
  const validation = useMemo(() => {
    if (!table) return '请输入新表名称。'
    try { validateTableCreateInput(session.provider, input); return '' }
    catch (reason) { return reason instanceof Error ? reason.message : String(reason) }
  }, [input, table, session.provider])
  const review = flow.prepared?.review
  const remaining = flow.prepared ? Math.max(0, Math.min(300, Math.ceil((flow.prepared.expiresAt - clock) / 1000))) : 0
  const locked = flow.busy === 'commit' || unlocking
  useEffect(() => {
    if (!flow.prepared) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [flow.prepared])
  function updateColumn(id: string, next: TableCreateColumn) { setColumns(current => current.map(column => column.id === id ? next : column)) }
  function moveColumn(index: number, direction: -1 | 1) {
    setColumns(current => { const next = [...current], target = index + direction; [next[index], next[target]] = [next[target], next[index]]; return next })
  }
  async function unlock() {
    setUnlocking(true); setNotice('')
    try { await onUnlock() } catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)) }
    finally { setUnlocking(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(review!.sql); setNotice('完整建表 DDL 已复制。') }
    catch { setNotice('无法写入剪贴板，可手动选择 DDL 复制。') }
  }
  return <SqlDialog title="新建数据表" className={styles.dialog} busy={locked} onClose={onClose}>
    <div className={styles.context}><Table size={17} /><div><strong>原生表设计器</strong><span>{session.info.productName} · {session.database}</span></div><span className={styles.badge}>{review ? flow.result ? '执行结果' : '只读 DDL 审查' : '字段设计'}</span></div>
    <div className={styles.body}>
      {!review ? <>
        <div className={styles.targetFields}><label>目标 {session.provider === 'mysql' ? '数据库' : 'Schema'}<select aria-label="建表目标目录" value={targetSchema} disabled={Boolean(flow.busy)} onChange={event => setSchema(event.target.value)}>{flow.options?.schemas.map(item => <option key={item}>{item}</option>)}</select></label><label>新表名称<input aria-label="新数据表名称" value={table} disabled={Boolean(flow.busy)} autoFocus placeholder="例如：research_items" onChange={event => setTable(event.target.value)} /></label></div>
        <div className={styles.editorHead}><strong>字段 <span>{columns.length} / {TABLE_CREATE_LIMITS.columns}</span></strong><small>主键按字段顺序组成 · 默认值为原始值或内建函数</small><button type="button" disabled={Boolean(flow.busy) || columns.length >= TABLE_CREATE_LIMITS.columns} onClick={() => setColumns(current => [...current, tableCreateNewColumn(session.provider, crypto.randomUUID())])}><Plus size={14} />添加字段</button></div>
        <div className={styles.columnsViewport}><table className={styles.columns}><thead><tr><th className={styles.nameHead}>字段名称</th><th>原生类型</th><th>长度 / 精度</th><th>NULL</th><th>PK</th><th>UNIQUE</th><th>自增 / Identity</th><th>默认值</th><th>顺序 / 删除</th></tr></thead><tbody>{columns.map((column, index) => <TableCreateColumnRow key={column.id} column={column} index={index} count={columns.length} provider={session.provider} disabled={Boolean(flow.busy)} onChange={next => updateColumn(column.id, next)} onDelete={() => setColumns(current => current.filter(item => item.id !== column.id))} onMove={direction => moveColumn(index, direction)} />)}</tbody></table></div>
        <p className={styles.scrollHint}>横向滚动可编辑全部字段属性。数值默认值保留原始精度；时间戳字面量使用包含 Z 的完整 UTC 时间。</p>
        {validation && table && <p className={styles.validation} role="status"><Warning size={14} />{validation}</p>}
        <div className={styles.notice}><Warning size={16} /><span>审查阶段不执行建表。确认后只创建空表及当前主键 / 单字段唯一约束。<small>外键、计算生成列、CHECK、分区、注释与独立复合索引不在当前设计器范围内。{session.provider === 'mysql' ? 'MySQL 使用 InnoDB，DDL 会隐式提交。' : 'PostgreSQL / SQLite 使用原生建表事务。'}</small></span></div>
        {flow.busy === 'loading' && <p className={styles.loading} role="status"><SpinnerGap size={15} className="mw-spin" />读取当前连接的真实目标目录…</p>}
      </> : <>
        <div className={styles.reviewHead}><strong>{review.schema}.{review.table}</strong><span>{review.columns.length} 个字段 · {review.transaction === 'atomic' ? '原生事务' : '隐式提交'} · {flow.result ? '计划已消费' : remaining ? `有效 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '计划已失效'}</span><button type="button" aria-label="复制完整建表 DDL" onClick={() => void copy()}><Copy size={14} />复制 DDL</button></div>
        <pre className={styles.sql} aria-label="完整建表 DDL">{review.sql}</pre>
        <ul className={styles.warnings}>{review.warnings.map(message => <li key={message}>{message}</li>)}</ul>
        {flow.result ? <div className={`${styles.result} ${flow.result.outcome === 'created' ? styles.success : styles.uncertain}`} role={flow.result.outcome === 'created' ? 'status' : 'alert'}>{flow.result.outcome === 'created' ? <CheckCircle size={22} /> : <Warning size={22} />}<div><strong>{flow.result.outcome === 'created' ? '建表已确认' : flow.result.outcome === 'unknown' ? '结果未确认' : '建表未完成'}</strong><p>{flow.result.message}</p>{flow.result.executionTimeMs > 0 && <small>{flow.result.executionTimeMs.toFixed(0)} ms · 原生执行</small>}</div></div> : <>
          {!writable && <div className={styles.unlock}><LockOpen size={17} /><span>当前会话锁定写入。完整审查 DDL 后可解锁建表。</span><button type="button" disabled={unlocking || !remaining} onClick={() => void unlock()}>{unlocking ? '解锁中…' : '解锁原生建表'}</button></div>}
          <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={!writable || locked || !remaining} onChange={event => setConfirmed(event.target.checked)} /><span>我已审查以上完整 DDL，确认在 <strong>{review.schema}</strong> 创建 <strong>{review.table}</strong>。{session.provider === 'mysql' && <small>理解 MySQL DDL 不能通过事务撤销。</small>}</span></label>
        </>}
      </>}
      {(flow.error || notice) && <p className={flow.error ? styles.error : styles.feedback} role={flow.error ? 'alert' : 'status'}>{flow.error || notice}{!flow.options && flow.error && <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.load()}>重新读取目录</button>}</p>}
    </div>
    <footer className={styles.footer}><button type="button" disabled={locked} onClick={onClose}>{flow.result ? '关闭' : '取消'}</button><span />{review && !flow.result && <button type="button" disabled={locked || Boolean(flow.busy)} onClick={() => { setConfirmed(false); setNotice(''); void flow.edit() }}>返回字段设计</button>}{!review ? <button type="button" className={styles.primary} disabled={Boolean(flow.busy) || !flow.options || Boolean(validation) || !flow.options.schemas.includes(targetSchema)} onClick={() => { setConfirmed(false); setNotice(''); setClock(Date.now()); void flow.preview(input) }}>{flow.busy === 'preview' && <SpinnerGap size={14} className="mw-spin" />}{flow.busy === 'preview' ? '准备原生审查…' : '审查完整建表 DDL'}</button> : !flow.result && <button type="button" className={styles.primary} disabled={!writable || !confirmed || !remaining || locked || Boolean(flow.busy)} onClick={() => void flow.commit()}>{flow.busy === 'commit' ? <SpinnerGap size={14} className="mw-spin" /> : <Plus size={14} />}{flow.busy === 'commit' ? '原生建表中…' : '确认创建数据表'}</button>}</footer>
  </SqlDialog>
}
