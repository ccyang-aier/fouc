"use client"
import { useState } from 'react'
import { Broadcast, Plug, X, PaperPlaneTilt } from '@phosphor-icons/react'
import type { RedisPubSubAction } from '@fouc/shared'
import { RedisByteField } from './redis-byte-field'
import { draftToBytes, type RedisByteDraft } from './redis-mutation-model'
import { useRedisPubSub } from './use-redis-pubsub'
import { RedisPubSubMessages } from './redis-pubsub-messages'
import { RedisPubSubPublish } from './redis-pubsub-publish'
import styles from './redis-pubsub.module.css'

export function RedisPubSubView({ base, readOnly, onBusyChange }: { base: string; readOnly: boolean; onBusyChange: (busy: boolean) => void }) {
  const pubsub = useRedisPubSub(base)
  const [channel, setChannel] = useState<RedisByteDraft>({ encoding: 'text', text: '' }), [pattern, setPattern] = useState<RedisByteDraft>({ encoding: 'text', text: '' })
  const [inputError, setInputError] = useState(''), [published, setPublished] = useState(''), [publisher, setPublisher] = useState(false)
  const connected = pubsub.state.status === 'connected', connecting = pubsub.state.status === 'connecting'
  async function subscribe(kind: RedisPubSubAction) {
    try {
      const raw = draftToBytes(kind === 'subscribe' ? channel : pattern)
      if (atob(raw).length > 65536) throw new Error('频道或模式名称最多 64 KiB。')
      setInputError('')
      if (await pubsub.change(kind, raw)) { if (kind === 'subscribe') setChannel({ encoding: 'text', text: '' }); else setPattern({ encoding: 'text', text: '' }) }
    } catch (reason) { setInputError(reason instanceof Error ? reason.message : String(reason)) }
  }
  return <section className={styles.panel} aria-label="Redis Pub/Sub">
    <header className={styles.header}><Broadcast size={17} /><strong>Pub/Sub</strong><span data-connected={connected} role="status">{connected ? `已连接 · ${pubsub.state.subscriptions.subscriptionCount} 个订阅` : connecting ? '连接与恢复订阅中…' : pubsub.state.status === 'failed' ? '连接失败' : '未连接'}</span>
      <button type="button" aria-label={connected || connecting ? '断开 Pub/Sub' : '连接 Pub/Sub'} onClick={() => { if (connected || connecting) pubsub.disconnect(); else void pubsub.connect() }}><Plug size={13} />{connected || connecting ? '断开' : '连接'}</button></header>
    <p className={styles.notice}>频道跨 DB 共享；频道和模式同时匹配会保留两条投递。断开期间的消息不会补发，关闭视图会释放订阅连接。</p>
    {pubsub.state.error && <p role="alert" className={styles.error}>{pubsub.state.error} · 已保留消息和上次订阅，可重新连接。</p>}
    {(inputError || pubsub.actionError) && <p role="alert" className={styles.error}>{inputError || pubsub.actionError}</p>}
    <div className={styles.subscriptions}>{(['channels', 'patterns'] as const).map((key) => <section key={key} aria-label={key === 'channels' ? '频道订阅' : '模式订阅'}>
      <form onSubmit={(event) => { event.preventDefault(); void subscribe(key === 'channels' ? 'subscribe' : 'psubscribe') }}>
        <RedisByteField label={key === 'channels' ? '订阅频道' : '订阅模式'} value={key === 'channels' ? channel : pattern} onChange={key === 'channels' ? setChannel : setPattern} />
        <button type="submit" disabled={!connected || pubsub.actionBusy}>{pubsub.actionBusy ? '处理中…' : key === 'channels' ? '订阅' : '订阅模式'}</button></form>
      <div className={styles.tags} data-connected={connected}>{pubsub.state.subscriptions[key].map((name) => <span key={name.rawBase64}><code title={name.display}>{name.display || '（空名称）'}</code><button type="button" disabled={connecting || pubsub.actionBusy} aria-label={`取消${key === 'channels' ? '频道' : '模式'}订阅 ${name.display || '（空名称）'}`} onClick={() => void pubsub.change(key === 'channels' ? 'unsubscribe' : 'punsubscribe', name.rawBase64)}><X size={11} /></button></span>)}</div>
    </section>)}</div>
    <RedisPubSubMessages messages={pubsub.state.messages} dropped={pubsub.state.dropped} onClear={pubsub.clearMessages} />
    <footer className={styles.publishFooter}><span role="status">{published || (readOnly ? '发布消息需先解锁当前会话写入' : '发布时预览完整频道与消息字节')}</span><button type="button" disabled={readOnly} onClick={() => { setPublished(''); setPublisher(true) }}><PaperPlaneTilt size={13} />发布消息</button></footer>
    {publisher && <RedisPubSubPublish base={base} readOnly={readOnly} onBusyChange={onBusyChange} onClose={() => setPublisher(false)} onPublished={(result) => setPublished(`已发布 · Redis 接收计数 ${result.receivers}`)} />}
  </section>
}
