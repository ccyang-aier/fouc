'use client'

import { useState } from 'react'
import { Clock } from '@phosphor-icons/react/dist/csr/Clock'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { MySqlEventDetails } from '@fouc/shared/database-admin-objects'
import { AdminObjectSource } from './source'
import styles from './admin-objects.module.css'

const propertyLabels: Record<string, string> = {
  sql_mode: 'SQL Mode', character_set_client: '客户端字符集',
  collation_connection: '连接排序规则', database_collation: '数据库排序规则',
}
export function MySqlEventDetailsView({ details }: { details: MySqlEventDetails }) {
  const [tab, setTab] = useState<'overview' | 'body' | 'source'>('overview')
  const recurring = details.eventType === 'RECURRING'
  const schedule = recurring
    ? details.intervalValue === null || details.intervalUnit === null ? '未知' : `EVERY ${details.intervalValue} ${details.intervalUnit}`
    : details.executeAt === null ? '未知' : `AT ${details.executeAt}`
  const properties: Array<[string, string | null]> = [
    ['定义者', details.definer], ['事件时区', details.timeZone], ['创建时间 · 会话时区', details.createdAt],
    ['修改时间 · 会话时区', details.updatedAt], ['最近执行 · 事件时区', details.lastExecuted],
    ['完成策略', details.completion], ...Object.entries(details.properties).map(([key, value]) => [propertyLabels[key] ?? key, value] as [string, string | null]),
  ]
  return <>
    <header className={styles.detailHeader}>
      <div><span className={styles.kind}>MYSQL EVENT</span><h3>{details.name}</h3><code>{details.schema}</code></div>
      <span className={styles.status} data-tone={details.status === 'ENABLED' ? 'success' : 'neutral'}>{details.status ?? '状态未知'}</span>
    </header>
    <nav className={styles.detailTabs} aria-label="事件详情类型">
      {([['overview', '调度与属性'], ['body', '执行正文'], ['source', '原生 DDL']] as const).map(([key, label]) =>
        <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    <div className={styles.detailContent}>
      {tab === 'overview' && <>
        <section className={styles.schedule}>
          <div><Clock size={17} /><strong>{details.eventType ?? '调度类型未知'}</strong><small>{details.timeZone ?? '时区未知'}</small></div>
          <code>{schedule}</code>
          {recurring && <dl><div><dt>开始 · 事件时区</dt><dd>{details.starts ?? '未指定'}</dd></div><div><dt>结束 · 事件时区</dt><dd>{details.ends ?? '未指定'}</dd></div></dl>}
        </section>
        <div className={styles.scheduler}>
          <strong>服务器调度器</strong><span className={styles.status} data-tone={details.scheduler.status === 'ON' ? 'success' : 'neutral'}>{details.scheduler.status ?? '未知'}</span>
          <small>会话时区 {details.scheduler.sessionTimeZone ?? '未知'} · 系统时区 {details.scheduler.systemTimeZone ?? '未知'}</small>
        </div>
        {details.scheduler.error && <p className={styles.warning}><Warning size={14} />调度器状态不可读取：{details.scheduler.error}</p>}
        {details.comment && <p className={styles.comment}>{details.comment}</p>}
        <dl className={styles.properties}>{properties.map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd data-unknown={value === null}>{value ?? '未知 / 未提供'}</dd></div>)}</dl>
      </>}
      {tab === 'body' && <AdminObjectSource key="body" source={details.body} name={`${details.schema}.${details.name}.body`} label="事件正文 SQL" provider="mysql" />}
      {tab === 'source' && <AdminObjectSource key="source" source={details.source} name={`${details.schema}.${details.name}`} label="事件原生 DDL" provider="mysql" />}
      <div className={styles.notices}>{details.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>
    </div>
  </>
}
