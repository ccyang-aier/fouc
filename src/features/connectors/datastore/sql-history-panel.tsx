"use client"
import { useState } from 'react'
import { Copy, ArrowCounterClockwise, BookmarkSimple, Trash, X, ArrowsClockwise } from '@phosphor-icons/react'
import type { SqlHistoryEntry, SqlHistorySearch } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { useSqlResource, useSqlHistory } from './use-sql-resource'
import { SqlDialog } from './sql-library-dialog'
import common from './relational.module.css'
import styles from './sql-library.module.css'

export function SqlHistoryPanel({ base, revision, canSave, onClose, onRestore, onSave }: {
  base: string; revision: number; canSave: boolean; onClose: () => void; onRestore: (entry: SqlHistoryEntry) => void; onSave: (entry: SqlHistoryEntry) => void
}) {
  const [search, setSearch] = useState(''), [success, setSuccess] = useState('all'), [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [schema, setSchema] = useState(''), [filter, setFilter] = useState({ search: '', success: 'all', start: '', end: '', schema: '' })
  const [cursor, setCursor] = useState<{ generation: number; value: SqlHistorySearch['cursor'] } | null>(null), [localRevision, setLocalRevision] = useState(0)
  const [selection, setSelection] = useState<string | null>(null), [actionBusy, setActionBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState<'clear' | string | null>(null)
  const generation = revision + localRevision
  const request = { search: filter.search, success: filter.success === 'all' ? null : filter.success === 'true', schema: filter.schema || null,
    startedAt: filter.start ? new Date(`${filter.start}T00:00:00`).getTime() : null, endedAt: filter.end ? new Date(`${filter.end}T23:59:59.999`).getTime() : null, cursor: cursor?.generation === generation ? cursor.value : null, limit: 50 }
  const history = useSqlHistory(`${base}/search`, request, generation), pages = history.data
  const detail = useSqlResource<SqlHistoryEntry>(selection ? `${base}/${selection}` : null, undefined, localRevision)
  function refresh() { setCursor(null); setLocalRevision((value) => value + 1) }
  async function copy(sql: string) { try { await navigator.clipboard.writeText(sql); setNotice('已复制完整 SQL') } catch { setError('复制失败，请在详情中选择内容复制。') } }
  async function remove() {
    if (!confirmation) return
    setActionBusy(true); setError('')
    try { await backendFetch(`${base}${confirmation === 'clear' ? '' : `/${confirmation}`}`, { method: 'DELETE', body: JSON.stringify({ confirmed: true }) });
      setSelection(null); setConfirmation(null); refresh(); setNotice(confirmation === 'clear' ? '已清空本连接历史' : '已删除历史记录')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setActionBusy(false) }
  }
  return <aside className={styles.panel} aria-label="SQL 查询历史">
    <header><div><strong>查询历史</strong><small>{pages?.persistent ? '当前连接 · 设备保存' : '临时会话 · 断开后不保留'} · 最近 {pages?.limit ?? 1000} 条</small></div>
      <button type="button" aria-label="刷新 SQL 历史" disabled={history.busy || actionBusy} onClick={refresh}><ArrowsClockwise size={16} /></button>
      <button type="button" aria-label="清空 SQL 历史" disabled={!pages?.total || actionBusy} onClick={() => setConfirmation('clear')}><Trash size={16} /></button>
      <button type="button" aria-label="关闭 SQL 历史" onClick={onClose}><X size={17} /></button></header>
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); if (start && end && start > end) { setError('开始日期不能晚于结束日期'); return } setError(''); setCursor(null); setSelection(null); setFilter({ search, success, start, end, schema }) }}>
      <input aria-label="搜索 SQL 历史" placeholder="搜索 SQL、目标或错误…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="历史执行状态" value={success} onChange={(event) => setSuccess(event.target.value)}><option value="all">全部状态</option><option value="true">成功</option><option value="false">失败</option></select>
      <input aria-label="历史 Schema" placeholder="全部 Schema" value={schema} onChange={(event) => setSchema(event.target.value)} />
      <label>从<input aria-label="历史开始日期" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>至<input aria-label="历史结束日期" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      <button type="submit" disabled={history.busy}>筛选</button><button type="button" onClick={() => { setSearch(''); setSuccess('all'); setStart(''); setEnd(''); setSchema(''); setCursor(null); setFilter({ search: '', success: 'all', start: '', end: '', schema: '' }); setSelection(null); setError('') }}>重置</button>
    </form>
    {(error || history.error) && <p role="alert" className={styles.error}>{error || history.error}<button type="button" onClick={refresh}>重试</button></p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}{history.busy && <p role="status" className={styles.notice}>正在读取历史…</p>}
    <div className={styles.list} aria-label="SQL 历史记录列表">{pages?.entries.map((entry) => <button type="button" key={entry.id} aria-pressed={selection === entry.id} disabled={history.busy || actionBusy} onClick={() => { setSelection(entry.id); setNotice('') }}>
      <div><span className={entry.success ? styles.success : styles.failure}>{entry.success ? '成功' : '失败'}</span><small>{new Date(entry.executedAt).toLocaleString()} · {entry.executionTimeMs} ms</small></div>
      <code>{entry.sqlPreview}</code><small>{entry.database}{entry.schema && entry.schema !== entry.database ? ` / ${entry.schema}` : ''} · {entry.rowCount} 行{entry.truncated && ' · 结果有更多行'}</small>
    </button>)}{!history.busy && !pages?.entries.length && !history.error && <p className={styles.empty}>没有符合条件的历史记录。</p>}</div>
    <footer><span>{pages?.total ?? 0} 条 · 已加载 {pages?.entries.length ?? 0}{history.error && ' · 上次读取结果'}</span><button type="button" disabled={history.busy || Boolean(history.error) || !pages?.nextCursor} onClick={() => setCursor({ generation, value: pages?.nextCursor ?? null })}>加载更多</button></footer>
    {selection && <section className={styles.detail} aria-label="SQL 历史详情"><header><strong>完整 SQL · {detail.data?.connectionName}</strong><button type="button" aria-label="关闭 SQL 历史详情" onClick={() => setSelection(null)}><X size={15} /></button></header>
      {detail.busy ? <p role="status">正在读取完整 SQL…</p> : detail.error ? <p role="alert" className={styles.error}>{detail.error}</p> : detail.data && <>
        <small>{detail.data.database}{detail.data.schema && detail.data.schema !== detail.data.database ? ` / ${detail.data.schema}` : ''} · {detail.data.executionTimeMs} ms</small><pre tabIndex={0}>{detail.data.sql}</pre>{detail.data.error && <p role="alert" className={styles.error}>{detail.data.error}</p>}
        <footer><button type="button" onClick={() => void copy(detail.data!.sql)}><Copy size={13} />复制</button><button type="button" disabled={!canSave} title={!canSave ? '保存连接后可收藏 SQL' : undefined} onClick={() => onSave(detail.data!)}><BookmarkSimple size={13} />保存 SQL</button><button type="button" onClick={() => onRestore(detail.data!)}><ArrowCounterClockwise size={13} />恢复编辑</button><button type="button" onClick={() => setConfirmation(selection)}><Trash size={13} />删除</button></footer>
      </>}</section>}
    {confirmation && <SqlDialog title="确认删除 SQL 历史" role="alertdialog" busy={actionBusy} onClose={() => setConfirmation(null)}><div className={common.formBody}><p>{confirmation === 'clear' ? '清空本连接所有数据库和 Schema 的查询历史？' : '删除这条查询历史？'}此操作不会更改数据源。</p>{error && <p role="alert" className={styles.error}>{error}</p>}</div><footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={actionBusy} onClick={() => setConfirmation(null)}>取消</button><span /><button type="button" className={common.primary} disabled={actionBusy} onClick={() => void remove()}>确认删除历史</button></footer></SqlDialog>}
  </aside>
}
