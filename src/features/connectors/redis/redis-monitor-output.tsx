"use client"
import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Stop, MagnifyingGlass } from '@phosphor-icons/react'
import type { RedisMonitorState } from './use-redis-monitor'
import styles from './redis-monitor.module.css'

export function RedisMonitorOutput({ state, onStop }: { state: RedisMonitorState; onStop: () => void }) {
  const [filter, setFilter] = useState('')
  const [follow, setFollow] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const viewport = useRef<HTMLDivElement>(null)
  const records = state.records.filter((record) => record.message.toLowerCase().includes(filter.toLowerCase()))
  const active = state.status === 'connecting' || state.status === 'listening'
  useEffect(() => { if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight }, [state.records, filter, follow])
  async function copy() {
    try { await navigator.clipboard.writeText(records.map((record) => record.message + (record.truncated ? ' … [已截断]' : '')).join('\n')); setCopied(true); setCopyError('') }
    catch { setCopyError('复制失败，请选择记录复制。') }
  }
  return <section className={styles.panel} aria-label="Redis 实时 MONITOR">
    <header className={styles.header}><span className={styles.status} data-active={state.status === 'listening'} role="status">{state.status === 'connecting' ? '正在建立独立监听连接…' : state.status === 'listening' ? 'MONITOR 正在监听' : state.status === 'stopped' ? 'MONITOR 已停止' : 'MONITOR 读取失败'}</span>
      {active && <button type="button" aria-label="停止 Redis MONITOR" onClick={onStop}><Stop size={13} />停止</button>}
      <button type="button" disabled={!records.length} aria-label="复制 MONITOR 输出" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button></header>
    <div className={styles.toolbar}><label><MagnifyingGlass size={13} /><input aria-label="筛选 MONITOR 记录" value={filter} placeholder="筛选命令、Key 或来源" onChange={(event) => { setFilter(event.target.value); setCopied(false) }} /></label>
      <label className={styles.follow}><input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />跟随最新</label></div>
    {state.error && <p role="alert" className={styles.error}>{state.error} · 已保留接收记录，可重新运行 MONITOR。</p>}
    {copyError && <p role="alert" className={styles.error}>{copyError}</p>}
    <div ref={viewport} className={styles.records} tabIndex={0} aria-label="MONITOR 记录">
      {records.map((record) => <div key={record.sequence}><span>{record.sequence}</span><code>{record.message}{record.truncated && <em> … [已截断]</em>}</code></div>)}
      {!records.length && <p>{state.records.length ? '没有匹配的记录。' : state.status === 'listening' ? '等待此实例收到命令…' : state.status === 'connecting' ? '等待服务器确认 MONITOR…' : '没有接收记录。'}</p>}
    </div>
    <footer>显示 {records.length} / {state.records.length} 条 · 仅保留最新 1000 条 · 单条最多 16 KiB{state.dropped > 0 && <strong> · 传输缓冲已丢弃 {state.dropped} 条，记录不完整</strong>}</footer>
  </section>
}
