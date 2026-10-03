"use client"
import { useRef, useEffect, useState, type FormEvent } from 'react'
import { ArrowsClockwise, ClockCounterClockwise, MagnifyingGlass, Copy, X, CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { RedisSlowlogEntry, RedisSlowlogPage } from '@fouc/shared'
import { redisInteger, redisSlowlogCommand, redisSlowlogSort, redisSlowlogTime, type SlowlogSortField } from './redis-observability-model'
import { useRedisPoll } from './use-redis-poll'
import common from '../datastore/relational.module.css'
import styles from './redis-observability.module.css'

const columns: [SlowlogSortField, string][] = [['id', 'ID'], ['timestampSeconds', '执行时间'], ['durationMicros', '耗时 / μs'],
  ['command', '已记录命令'], ['clientAddress', '客户端地址'], ['clientName', '客户端名称']]
const PAGE_SIZE = 100

export function RedisSlowlog({ base }: { base: string }) {
  const [count, setCount] = useState('100')
  const [requestedCount, setRequestedCount] = useState(100)
  const [revision, setRevision] = useState(0)
  const [validation, setValidation] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ field: SlowlogSortField; direction: 'asc' | 'desc' }>({ field: 'id', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<RedisSlowlogEntry | null>(null)
  const { data, loading, error } = useRedisPoll<RedisSlowlogPage>(`${base}/slowlog?count=${requestedCount}`, 0, revision)
  const needle = search.trim().toLowerCase()
  const matching = (data?.entries ?? []).filter((entry) => !needle ||
    [entry.id, redisSlowlogCommand(entry), entry.clientAddress?.display, entry.clientName?.display].some((value) => value?.toLowerCase().includes(needle)))
  const sorted = redisSlowlogSort(matching, sort.field, sort.direction)
  const lastPage = Math.max(0, Math.ceil(sorted.length / PAGE_SIZE) - 1), currentPage = Math.min(page, lastPage)
  const visible = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  function query(event: FormEvent) {
    event.preventDefault()
    if (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 10000) { setValidation('请输入 1–10000 的日志数量。'); return }
    setValidation(''); setPage(0); setRequestedCount(Number(count)); setRevision((current) => current + 1)
  }
  function sortBy(field: SlowlogSortField) {
    setPage(0)
    setSort((current) => ({ field, direction: current.field === field && current.direction === 'desc' ? 'asc' : 'desc' }))
  }
  const threshold = data?.thresholdMicros === null || !data ? '阈值未知'
    : data.thresholdMicros === '-1' ? '日志记录已关闭' : data.thresholdMicros === '0' ? '记录所有命令' : `阈值 ${redisInteger(data.thresholdMicros)} μs`
  return <section className={styles.panel} aria-label="Redis 慢日志">
    <form className={styles.toolbar} onSubmit={query}>
      <div className={styles.identity}><ClockCounterClockwise size={16} /><strong>慢日志</strong><span>当前实例 · 所有 DB</span></div>
      <label>数量<input aria-label="慢日志数量" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} /></label>
      <button type="submit" disabled={loading}><ArrowsClockwise size={14} />{loading ? '查询中…' : '查询慢日志'}</button>
    </form>
    {(validation || error) && <div role="alert" className={styles.error}>{validation || error}{error && data && ' · 下方保留上次查询结果。'}</div>}
    {data?.warnings.map((warning) => <p className={styles.warning} key={warning}>{warning}</p>)}
    <div className={styles.logSummary}><span>{threshold}</span><span>保留上限 {redisInteger(data?.maxEntries ?? null)}</span><span>当前总数 {redisInteger(data?.totalEntries ?? null)}</span>
      <span>{data ? `更新于 ${new Date(data.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '等待日志'}</span></div>
    <div className={styles.logSearch}><MagnifyingGlass size={14} /><input aria-label="筛选慢日志" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="筛选 ID、命令或客户端…" />
      {search && <button type="button" onClick={() => { setSearch(''); setPage(0) }}>清除</button>}<span>{matching.length} 条匹配 / {data?.entries.length ?? 0} 条已加载</span></div>
    <div className={styles.logTableWrap} aria-busy={loading}>
      {visible.length ? <table className={styles.logTable}><thead><tr>{columns.map(([field, label]) => <th key={field} scope="col"
        aria-sort={sort.field === field ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
        <button type="button" onClick={() => sortBy(field)}>{label}{sort.field === field && (sort.direction === 'asc' ? ' ↑' : ' ↓')}</button></th>)}</tr></thead>
        <tbody>{visible.map((entry) => <tr key={entry.id}>
          <td>{entry.id}</td><td>{redisSlowlogTime(entry.timestampSeconds)}</td><td>{redisInteger(entry.durationMicros)}</td>
          <td><button type="button" aria-label={`查看慢日志 ${entry.id}`} title={redisSlowlogCommand(entry)} onClick={() => setSelected(entry)}>{redisSlowlogCommand(entry)}</button></td>
          <td title={entry.clientAddress?.display}>{entry.clientAddress?.display ?? '未提供'}</td><td title={entry.clientName?.display}>{entry.clientName?.display ?? '未提供'}</td>
        </tr>)}</tbody></table> : <div className={styles.empty} role={loading ? 'status' : undefined}>{loading ? '正在查询慢日志…' : error ? '慢日志读取失败，请重新查询。'
          : search ? '没有匹配的日志。' : '当前没有慢日志。'}{!loading && !search && !error && <span>日志取决于服务器阈值、保留容量及最近执行的命令。</span>}</div>}
    </div>
    <div className={styles.logPaging}><span>{data ? `请求最近 ${data.requestedCount} 条 · 服务器返回 ${data.returnedByServer} 条` : '最近日志优先'}</span>
      <div><button type="button" aria-label="慢日志上一页" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><CaretLeft size={13} /></button>
        <span>{currentPage + 1} / {lastPage + 1}</span><button type="button" aria-label="慢日志下一页" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}><CaretRight size={13} /></button></div></div>
    <footer className={styles.footer}><span>耗时仅为服务端执行时间 · 日志参数可能被 Redis 截断</span><span>{data ? `${data.executionTimeMs} ms` : '—'}</span></footer>
    {selected && <RedisSlowlogDetail entry={selected} onClose={() => setSelected(null)} />}
  </section>
}

function RedisSlowlogDetail({ entry, onClose }: { entry: RedisSlowlogEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [message, setMessage] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage('已复制') }
    catch { setMessage('复制失败，请选择文字复制。') }
  }
  return <dialog ref={dialog} className={`${common.dialog} ${styles.detail}`} aria-labelledby="redis-slowlog-detail-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className={common.dialogHead}><div><ClockCounterClockwise size={18} /><h2 id="redis-slowlog-detail-title">慢日志 #{entry.id}</h2></div>
      <button type="button" aria-label="关闭慢日志详情" onClick={onClose}><X size={18} /></button></header>
    <div className={styles.detailBody}><dl><dt>执行时间</dt><dd>{redisSlowlogTime(entry.timestampSeconds)}</dd><dt>执行耗时</dt><dd>{redisInteger(entry.durationMicros)} μs</dd>
      <dt>客户端地址</dt><dd>{entry.clientAddress?.display ?? '未提供'}</dd><dt>客户端名称</dt><dd>{entry.clientName?.display ?? '未提供'}</dd>
      <dt>原始参数总数</dt><dd>{entry.originalArgumentCount ?? '当前服务器未提供'}</dd></dl>
      <p className={styles.warning}>这里只展示 Redis 已记录的参数。服务器可能截断较长的值或省略参数，无法据此重建完整原始命令。</p>
      <div className={styles.detailCommand}><pre>{redisSlowlogCommand(entry)}</pre><button type="button" aria-label="复制已记录命令" onClick={() => void copy(redisSlowlogCommand(entry))}><Copy size={14} /></button></div>
      <h3>已记录参数 · {entry.arguments.length}</h3><ol className={styles.arguments}>{entry.arguments.map((argument, index) => <li key={index}><span>{index}</span><div>
        <code>{argument.display || '（空参数）'}</code><details><summary>原始字节 · Base64</summary><code>{argument.rawBase64 || '（空字节）'}</code></details></div>
        <button type="button" aria-label={`复制参数 ${index} Base64`} onClick={() => void copy(argument.rawBase64)}><Copy size={13} /></button></li>)}</ol>
      {message && <p className={styles.notice} role="status">{message}</p>}
    </div>
    <footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => void copy(JSON.stringify(entry, null, 2))}><Copy size={13} />复制日志 JSON</button><span />
      <button type="button" className={common.primary} onClick={onClose}>完成</button></footer>
  </dialog>
}
