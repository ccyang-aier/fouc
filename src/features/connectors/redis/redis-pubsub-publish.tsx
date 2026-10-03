"use client"
import { useEffect, useRef, useState } from 'react'
import { X, ArrowLeft, PaperPlaneTilt } from '@phosphor-icons/react'
import type { RedisPubSubPublishResult } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { RedisByteField } from './redis-byte-field'
import { bytesToDraft, draftToBytes, type RedisByteDraft } from './redis-mutation-model'
import common from '../datastore/relational.module.css'
import styles from './redis-pubsub.module.css'

export function RedisPubSubPublish({ base, readOnly, onClose, onPublished, onBusyChange }: {
  base: string; readOnly: boolean; onClose: () => void; onPublished: (result: RedisPubSubPublishResult) => void; onBusyChange: (busy: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [channel, setChannel] = useState<RedisByteDraft>({ encoding: 'text', text: '' })
  const [payload, setPayload] = useState<RedisByteDraft>({ encoding: 'text', text: '' })
  const [preview, setPreview] = useState<{ channel: string; payload: string } | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [unknown, setUnknown] = useState(false)
  useEffect(() => { dialog.current?.showModal() }, [])
  async function submit() {
    if (busy || readOnly || unknown) return
    setError('')
    if (!preview) {
      try {
        const rawChannel = draftToBytes(channel), message = draftToBytes(payload)
        if (atob(rawChannel).length > 65536 || atob(message).length > 1048576) throw new Error('频道最多 64 KiB，待发布消息最多 1 MiB。')
        setPreview({ channel: rawChannel, payload: message })
      } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      return
    }
    setBusy(true); onBusyChange(true)
    try {
      const result = await backendFetch<RedisPubSubPublishResult>(`${base}/pubsub/publish`, { method: 'POST', body: JSON.stringify({ ...preview, confirmed: true }) })
      onPublished(result); onClose()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message); setUnknown(message.includes('发布结果未确认'))
    } finally { setBusy(false); onBusyChange(false) }
  }
  return <dialog ref={dialog} className={`${common.dialog} ${styles.dialog}`} aria-labelledby="redis-pubsub-publish-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose() }}>
    <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
      <header className={common.dialogHead}><div><PaperPlaneTilt size={18} /><strong id="redis-pubsub-publish-title">发布 Pub/Sub 消息</strong></div>
        <button type="button" aria-label="关闭发布消息" disabled={busy} onClick={onClose}><X size={17} /></button></header>
      <div className={styles.publishBody}>
        <p>频道跨 DB 共享。Redis 不保存离线 Pub/Sub 消息，发布返回的接收计数不代表消费者完成处理。</p>
        {readOnly && <p role="alert" className={styles.error}>请先解锁当前 Redis 会话的写入。</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {preview ? <section className={styles.preview} aria-label="Pub/Sub 发布预览">
          <strong>频道 · {atob(preview.channel).length} 字节</strong><pre>{bytesToDraft(preview.channel).text || '（空频道）'}</pre>
          <strong>消息 · {atob(preview.payload).length} 字节</strong><pre>{bytesToDraft(preview.payload).text || '（零字节消息）'}</pre>
          <small>二进制内容显示为 Base64，提交使用预览时的完整原始字节。</small>
        </section> : <><RedisByteField label="发布频道" value={channel} onChange={setChannel} /><RedisByteField label="发布消息" value={payload} onChange={setPayload} multiline /></>}
      </div>
      <footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={busy} onClick={() => { if (preview && !unknown) { setPreview(null); setError('') } else onClose() }}>{preview && !unknown ? <><ArrowLeft size={13} />返回编辑</> : '取消'}</button><span />
        <button type="submit" className={common.primary} disabled={busy || readOnly || unknown}>{busy ? '发布中…' : preview ? '确认发布' : '预览消息'}</button></footer>
    </form>
  </dialog>
}
