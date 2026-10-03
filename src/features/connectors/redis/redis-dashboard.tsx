"use client"
import { useState } from 'react'
import { ArrowsClockwise, ChartLineUp, MagnifyingGlass, Copy, CaretDown, CaretRight } from '@phosphor-icons/react'
import type { RedisInfoSnapshot } from '@fouc/shared'
import { redisBytes, redisHitRatio, redisInfoFilter, redisInfoValue, redisInteger, redisTotalKeys } from './redis-observability-model'
import { useRedisPoll } from './use-redis-poll'
import styles from './redis-observability.module.css'

const sectionNames: Record<string, string> = { Server: '服务器', Clients: '客户端', Memory: '内存', Persistence: '持久化', Stats: '统计',
  Replication: '复制', CPU: 'CPU', Modules: '模块', Commandstats: '命令统计', Errorstats: '错误统计', Latencystats: '延迟统计', Cluster: '集群', Keyspace: '数据库' }

export function RedisDashboard({ base }: { base: string }) {
  const [interval, setInterval] = useState(0)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const { data, loading, error } = useRedisPoll<RedisInfoSnapshot>(`${base}/info`, interval, revision)
  const sections = data?.sections ?? []
  const value = (section: string, key: string) => redisInfoValue(sections, section, key)
  const metrics = [
    ['已用内存', redisBytes(value('Memory', 'used_memory')), 'used_memory'],
    ['内存上限', value('Memory', 'maxmemory') === '0' ? '未限额' : redisBytes(value('Memory', 'maxmemory')), 'maxmemory'],
    ['命令 / 秒', redisInteger(value('Stats', 'instantaneous_ops_per_sec')), 'instantaneous_ops_per_sec'],
    ['命中率', redisHitRatio(value('Stats', 'keyspace_hits'), value('Stats', 'keyspace_misses')), 'keyspace_hits / (hits + misses)'],
    ['全部 DB 的 Key', redisInteger(redisTotalKeys(sections)), 'INFO Keyspace · 所有数据库'],
    ['已连接客户端', redisInteger(value('Clients', 'connected_clients')), 'connected_clients'],
    ['累计命令', redisInteger(value('Stats', 'total_commands_processed')), 'total_commands_processed'],
    ['运行天数', redisInteger(value('Server', 'uptime_in_days')), 'uptime_in_days'],
  ]
  const filtered = redisInfoFilter(sections, search)
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage('已复制指标') }
    catch { setMessage('复制失败，请选中指标文字复制。') }
  }
  return <section className={styles.panel} aria-label="Redis 运行概览">
    <div className={styles.toolbar}>
      <div className={styles.identity}><ChartLineUp size={16} /><strong>运行概览</strong><span>当前 Redis 实例</span></div>
      <label>自动刷新<select aria-label="概览自动刷新" value={interval} onChange={(event) => setInterval(Number(event.target.value))}>
        {[0, 5, 10, 30, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds ? `${seconds} 秒` : '关闭'}</option>)}</select></label>
      <button type="button" aria-label="刷新 Redis 运行概览" disabled={loading} onClick={() => setRevision((current) => current + 1)}><ArrowsClockwise size={15} />{loading ? '读取中…' : '刷新'}</button>
    </div>
    {error && <div role="alert" className={styles.error}>{error}{data && ' · 下方保留上次数据，尚未刷新。'}<button type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)}>重试</button></div>}
    <div className={styles.scroll}>
      <div className={styles.lead}><div><small>SERVER OVERVIEW</small><h2>{value('Server', 'redis_version') ? `Redis ${value('Server', 'redis_version')}` : 'Redis 指标'}</h2>
        <p>{value('Server', 'redis_mode') ?? '模式未知'} · {value('Replication', 'role') ?? '角色未知'}<span>{data ? `更新于 ${new Date(data.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '等待服务器指标'}</span></p></div>
        <span className={styles.sampleState} role="status">{loading ? '正在读取指标…' : error ? '刷新失败' : `${sections.reduce((total, section) => total + section.entries.length, 0)} 项指标`}</span></div>
      <div className={styles.metrics}>{metrics.map(([label, formatted, origin]) => <article key={label}><span>{label}</span><strong title={formatted}>{formatted}</strong><small>{origin}</small></article>)}</div>
      <div className={styles.search}><MagnifyingGlass size={15} /><input aria-label="搜索 Redis 指标" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索分区、指标名称或值…" />
        {search && <button type="button" onClick={() => setSearch('')}>清除</button>}</div>
      {message && <p role="status" className={styles.notice}>{message}</p>}
      <div className={styles.sections}>{filtered.map((section, index) => {
        const identity = `${section.name}:${index}`, open = expanded.has(section.name) || Boolean(search.trim())
        return <section key={identity} className={styles.infoSection}>
          <button type="button" className={styles.sectionHeader} aria-expanded={open} disabled={Boolean(search.trim())} title={search.trim() ? '搜索期间展开匹配分区' : undefined} onClick={() => setExpanded((current) => {
            const next = new Set(current); if (next.has(section.name)) next.delete(section.name); else next.add(section.name); return next
          })}>{open ? <CaretDown size={13} /> : <CaretRight size={13} />}<strong>{sectionNames[section.name] ?? section.name}</strong><code>{section.name}</code><span>{section.entries.length}</span></button>
          {open && <table className={styles.infoTable}><tbody>{section.entries.map((entry, entryIndex) => <tr key={`${entry.key}:${entryIndex}`}>
            <th scope="row"><code>{entry.key}</code><button type="button" aria-label={`复制指标名称 ${entry.key}`} onClick={() => void copy(entry.key)}><Copy size={12} /></button></th>
            <td><code>{entry.value || '（空值）'}</code><button type="button" aria-label={`复制指标值 ${entry.key}`} onClick={() => void copy(entry.value)}><Copy size={12} /></button></td>
          </tr>)}</tbody></table>}
        </section>
      })}</div>
      {!filtered.length && !loading && <div className={styles.empty}>{error ? '服务器指标读取失败，可重试。' : search ? '没有匹配的指标。' : '服务器未返回指标。'}</div>}
    </div>
    <footer className={styles.footer}><span>INFO ALL · 实例统计包含所有 DB · 离开视图后停止刷新</span><span>{data ? `${data.executionTimeMs} ms` : '—'}</span></footer>
  </section>
}
