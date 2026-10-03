"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, UsersThree, CaretRight, Copy } from '@phosphor-icons/react'
import type { RedisBlob, RedisStreamGroup, RedisStreamConsumer, RedisStreamGroups, RedisStreamConsumers, RedisStreamPendingPage } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { useRedisStreamRead } from './use-redis-stream-read'
import { redisInteger } from './redis-observability-model'
import { redisStreamDuration } from './redis-stream-model'
import styles from './redis-stream.module.css'

const label = (name: RedisBlob) => name.display || '（空名称）'
export function RedisStreamGroupsView({ base, rawKey }: { base: string; rawKey: string }) {
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const selection = useRef<string | null>(null)
  const [feedback, setFeedback] = useState('')
  function select(value: string | null) { selection.current = value; setSelected(value); setFeedback('') }
  const reconcile = useCallback((page: RedisStreamGroups) => {
    if (selection.current !== null && !page.groups.some((group) => group.name.rawBase64 === selection.current)) {
      selection.current = null; setSelected(null); setFeedback('所选消费组已不存在，已返回消费组列表。')
    }
  }, [])
  const { data, loading, error } = useRedisStreamRead<RedisStreamGroups>(`${base}/stream/groups`, JSON.stringify({ key: rawKey }), revision, reconcile)
  const group = data?.groups.find((item) => item.name.rawBase64 === selected)
  return <section className={styles.panel} aria-label="Stream 消费组">
    <div className={styles.toolbar}><UsersThree size={15} /><button type="button" onClick={() => select(null)}>消费组</button>
      {group && <><CaretRight size={12} /><span title={label(group.name)}>{label(group.name)}</span></>}
      <button type="button" className={styles.refresh} aria-label="刷新 Stream 消费组" disabled={loading} onClick={() => { setFeedback(''); setRevision((value) => value + 1) }}><ArrowsClockwise size={14} />{loading ? '读取中…' : '刷新'}</button></div>
    {error && <ReadError text={error} retained={Boolean(data)} onRetry={() => setRevision((value) => value + 1)} />}
    {feedback && <p role="status" className={styles.notice}>{feedback}</p>}
    {loading && !data ? <div className={styles.empty} role="status">正在读取消费组…</div> : group ?
      <GroupDetail key={group.name.rawBase64} base={base} rawKey={rawKey} group={group} revision={data!.fetchedAt} /> :
      <div className={styles.scroll}><table className={styles.groupsTable}><thead><tr>{['消费组', '消费者', 'Pending', '最后投递 ID', 'Entries read', 'Lag'].map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{data?.groups.map((item) => <tr key={item.name.rawBase64}><td><button type="button" aria-label={`打开消费组 ${label(item.name)}`} title={label(item.name)} onClick={() => select(item.name.rawBase64)}>{label(item.name)}</button></td>
          <td>{redisInteger(item.consumers)}</td><td>{redisInteger(item.pending)}</td><td><code>{item.lastDeliveredId}</code></td><td>{redisInteger(item.entriesRead)}</td><td>{redisInteger(item.lag)}</td></tr>)}</tbody></table>
        {!data?.groups.length && !error && <p className={styles.empty}>当前 Stream 没有消费组。</p>}</div>}
    <footer className={styles.footer}>观测读取 · Pending 是已投递未确认的消息 · Lag 未知时显示未知</footer>
  </section>
}
function GroupDetail({ base, rawKey, group, revision }: { base: string; rawKey: string; group: RedisStreamGroup; revision: number }) {
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const selection = useRef<string | null>(null)
  const [feedback, setFeedback] = useState('')
  function select(value: string | null) { selection.current = value; setSelected(value); setFeedback('') }
  const reconcile = useCallback((page: RedisStreamConsumers) => {
    if (selection.current !== null && !page.consumers.some((consumer) => consumer.name.rawBase64 === selection.current)) {
      selection.current = null; setSelected(null); setFeedback('所选消费者已不存在，已返回消费者列表。')
    }
  }, [])
  const { data, loading, error } = useRedisStreamRead<RedisStreamConsumers>(`${base}/stream/consumers`, JSON.stringify({ key: rawKey, group: group.name.rawBase64 }), revision + retry, reconcile)
  const consumer = data?.consumers.find((item) => item.name.rawBase64 === selected)
  const metrics = consumer ? [['Pending', redisInteger(consumer.pending)], ['Idle', redisStreamDuration(consumer.idleMs)], ['Inactive', redisStreamDuration(consumer.inactiveMs)]] :
    [['消费者', redisInteger(group.consumers)], ['Pending', redisInteger(group.pending)], ['Lag', redisInteger(group.lag)]]
  return <div className={styles.scroll}>
    <div className={styles.breadcrumb}><button type="button" title={label(group.name)} onClick={() => select(null)}>{label(group.name)}</button>
      {consumer && <><CaretRight size={12} /><strong title={label(consumer.name)}>{label(consumer.name)}</strong></>}</div>
    <div className={styles.metrics}>{metrics.map(([name, value]) => <article key={name}><span>{name}</span><strong title={value}>{value}</strong></article>)}</div>
    {!consumer && <p className={styles.position}>最后投递 <code>{group.lastDeliveredId}</code> · 逻辑读取 {redisInteger(group.entriesRead)}</p>}
    {feedback && <p role="status" className={styles.notice}>{feedback}</p>}
    {error && <ReadError text={error} retained={Boolean(data)} onRetry={() => setRetry((value) => value + 1)} />}
    {consumer ? <PendingDetail key={consumer.name.rawBase64} base={base} rawKey={rawKey} group={group} consumer={consumer} revision={data!.fetchedAt} /> :
      <section className={styles.card} aria-label="Stream 消费者"><div className={styles.cardHeader}><strong>消费者 · {data?.consumers.length ?? 0}</strong>
        <button type="button" aria-label="刷新 Stream 消费者" disabled={loading} onClick={() => setRetry((value) => value + 1)}><ArrowsClockwise size={13} /></button></div>
        {loading && !data ? <p className={styles.empty} role="status">正在读取消费者…</p> : <div className={styles.tableScroll}><table className={styles.consumersTable}>
          <thead><tr>{['消费者', 'Pending', 'Idle', 'Inactive'].map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{data?.consumers.map((item) => <tr key={item.name.rawBase64}>
            <td><button type="button" aria-label={`打开消费者 ${label(item.name)}`} title={label(item.name)} onClick={() => select(item.name.rawBase64)}>{label(item.name)}</button></td>
            <td>{redisInteger(item.pending)}</td><td title={`${item.idleMs} ms`}>{redisStreamDuration(item.idleMs)}</td><td title={item.inactiveMs === null ? '未知' : `${item.inactiveMs} ms`}>{redisStreamDuration(item.inactiveMs)}</td></tr>)}</tbody></table>
          {!data?.consumers.length && !error && <p className={styles.empty}>当前消费组没有消费者。</p>}</div>}
      </section>}
    <p className={styles.notice}>Idle / Inactive 的含义依 Redis 版本而定；Inactive 未提供时不推断为零。指标是每次读取时的观测值。</p>
  </div>
}
function PendingDetail({ base, rawKey, group, consumer, revision }: { base: string; rawKey: string; group: RedisStreamGroup; consumer: RedisStreamConsumer; revision: number }) {
  const [request, setRequest] = useState({ epoch: revision, cursor: null as string | null, serial: 0 })
  const [page, setPage] = useState<RedisStreamPendingPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const cursor = request.epoch === revision ? request.cursor : null
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      try {
        const result = await backendFetch<RedisStreamPendingPage>(`${base}/stream/pending`, { method: 'POST', signal: controller.signal,
          body: JSON.stringify({ key: rawKey, group: group.name.rawBase64, consumer: consumer.name.rawBase64, cursor }) })
        if (!controller.signal.aborted) {
          setPage((current) => ({ ...result, entries: cursor ? [...new Map([...(current?.entries ?? []), ...result.entries].map((entry) => [entry.id, entry])).values()] : result.entries }))
          setError('')
        }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [base, rawKey, group.name.rawBase64, consumer.name.rawBase64, revision, cursor, request.serial])
  function read(next: string | null) { setCopyMessage(''); setRequest((current) => ({ epoch: revision, cursor: next, serial: current.serial + 1 })) }
  async function copy() { try { await navigator.clipboard.writeText(JSON.stringify(page?.entries ?? [], null, 2)); setCopyMessage('已复制当前已加载的 Pending JSON') } catch { setCopyMessage('复制失败，请选择消息 ID 复制。') } }
  return <section className={styles.card} aria-label="Stream Pending"><div className={styles.cardHeader}><strong>Pending · 已加载 {page?.entries.length ?? 0}</strong>
    <button type="button" aria-label="复制 Stream Pending JSON" disabled={!page} onClick={() => void copy()}><Copy size={13} /></button>
    <button type="button" aria-label="刷新 Stream Pending" disabled={loading} onClick={() => read(null)}><ArrowsClockwise size={13} /></button></div>
    {error && <ReadError text={error} retained={Boolean(page)} onRetry={() => read(cursor)} />}
    {copyMessage && <p role="status" className={styles.notice}>{copyMessage}</p>}
    {loading && !page ? <p className={styles.empty} role="status">正在读取 Pending…</p> : <div className={styles.tableScroll}><table className={styles.pendingTable}>
      <thead><tr>{['消息 ID', '距上次投递', '投递次数'].map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{page?.entries.map((entry) => <tr key={entry.id}>
        <td title={entry.id}><code>{entry.id}</code></td><td title={`${entry.idleMs} ms`}>{redisStreamDuration(entry.idleMs)}</td><td>{redisInteger(entry.deliveries)}</td></tr>)}</tbody></table>
      {!page?.entries.length && !error && <p className={styles.empty}>当前消费者没有 Pending 消息。</p>}</div>}
    {page?.nextCursor && <button type="button" className={styles.more} disabled={loading} onClick={() => read(page.nextCursor)}>{loading ? '读取中…' : '加载更多 Pending'}</button>}
  </section>
}
function ReadError({ text, retained, onRetry }: { text: string; retained: boolean; onRetry: () => void }) {
  return <div role="alert" className={styles.error}>{text}{retained && ' · 保留上次数据'}<button type="button" onClick={onRetry}>重试</button></div>
}
