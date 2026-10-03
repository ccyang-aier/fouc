"use client"
import { useEffect, useRef, useState } from 'react'
import { Copy, X, MagnifyingGlass, Trash } from '@phosphor-icons/react'
import type { RedisPubSubMessage } from '@fouc/shared'
import { redisPubSubSearch } from './redis-pubsub-model'
import common from '../datastore/relational.module.css'
import styles from './redis-pubsub.module.css'

export function RedisPubSubMessages({ messages, dropped, onClear }: { messages: RedisPubSubMessage[]; dropped: number; onClear: () => void }) {
  const [filter, setFilter] = useState(''), [follow, setFollow] = useState(true)
  const [selected, setSelected] = useState<RedisPubSubMessage | null>(null)
  const [feedback, setFeedback] = useState('')
  const viewport = useRef<HTMLDivElement>(null)
  const entries = messages.filter((entry) => redisPubSubSearch(entry, filter))
  useEffect(() => { if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight }, [messages, filter, follow])
  async function copy() { try { await navigator.clipboard.writeText(JSON.stringify(entries, null, 2)); setFeedback('已复制当前筛选的消息 JSON') } catch { setFeedback('复制失败，请打开消息详情后选择内容复制。') } }
  return <section className={styles.messages} aria-label="Pub/Sub 消息">
    <div className={styles.messageToolbar}><strong>消息 · {messages.length}</strong><label className={styles.search}><MagnifyingGlass size={13} /><input aria-label="筛选 Pub/Sub 消息" value={filter} placeholder="频道、模式或消息" onChange={(event) => { setFilter(event.target.value); setFeedback('') }} /></label>
      <label className={styles.follow}><input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />跟随</label>
      <button type="button" aria-label="复制 Pub/Sub 消息 JSON" disabled={!entries.length} onClick={() => void copy()}><Copy size={13} /></button>
      <button type="button" aria-label="清空 Pub/Sub 消息" disabled={!messages.length} onClick={() => { onClear(); setFeedback(''); setSelected(null) }}><Trash size={13} /></button></div>
    {feedback && <p role="status" className={styles.notice}>{feedback}</p>}
    <div ref={viewport} className={styles.messageList} tabIndex={0} aria-label="Pub/Sub 实时消息列表">
      {entries.map((entry) => <button type="button" key={`${entry.captureId}:${entry.sequence}`} className={styles.message} aria-label={`打开 Pub/Sub 消息 ${entry.sequence}`} onClick={() => setSelected(entry)}>
        <header><time>{new Date(entry.receivedAt).toLocaleTimeString()}</time><strong title={entry.channel.display}>{entry.channel.display || '（空频道）'}</strong>
          <span>{entry.pattern === null ? '频道' : '模式'}</span></header>
        {entry.pattern !== null && <small title={entry.pattern.display}>匹配 {entry.pattern.display || '（空模式）'}</small>}
        <pre>{entry.payload.display.slice(0, 1800) || '（零字节消息）'}{entry.payload.display.length > 1800 && '…'}</pre>
        {(entry.channel.truncated || entry.pattern?.truncated || entry.payload.truncated) && <em>内容已截断，详情显示原始长度。</em>}
      </button>)}
      {!entries.length && <p className={styles.empty}>{messages.length ? '没有匹配的消息。' : '等待订阅频道收到消息…'}</p>}
    </div>
    <footer>最近最多 500 条 / 2 MiB · 单项读取最多 64 KiB{dropped > 0 && <strong> · 传输缓冲丢弃 {dropped} 条，记录不完整</strong>}</footer>
    {selected && <MessageDetail entry={selected} onClose={() => setSelected(null)} />}
  </section>
}
function MessageDetail({ entry, onClose }: { entry: RedisPubSubMessage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [feedback, setFeedback] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  async function copy(text: string, name: string) { try { await navigator.clipboard.writeText(text); setFeedback(`已复制${name}`) } catch { setFeedback('复制失败，请选择内容复制。') } }
  return <dialog ref={dialog} className={`${common.dialog} ${styles.dialog}`} aria-labelledby="pubsub-message-title" onCancel={onClose}>
    <header className={common.dialogHead}><div><strong id="pubsub-message-title">Pub/Sub 消息 #{entry.sequence}</strong></div><button type="button" aria-label="关闭 Pub/Sub 消息" onClick={onClose}><X size={17} /></button></header>
    <div className={styles.detail}><small>接收时间 {new Date(entry.receivedAt).toLocaleString()} · {entry.pattern === null ? '频道订阅' : '模式订阅'}</small>
      {([['频道', entry.channel], ['模式', entry.pattern], ['消息', entry.payload]] as const).map(([name, blob]) => blob !== null && <section key={name}><header><strong>{name} · {blob.byteLength} 字节{blob.truncated && ' · 已截断'}</strong>
        <button type="button" aria-label={`复制 Pub/Sub ${name} Base64`} onClick={() => void copy(blob.rawBase64, `${name} Base64`)}><Copy size={13} />Base64</button></header><pre>{blob.display || '（零字节）'}</pre></section>)}
      {feedback && <p role="status">{feedback}</p>}
    </div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => void copy(JSON.stringify(entry, null, 2), '消息 JSON')}>复制消息 JSON</button><span /><button type="button" className={common.primary} onClick={onClose}>完成</button></footer>
  </dialog>
}
