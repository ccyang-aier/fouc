'use client'

import { useEffect, useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise'
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight'
import { Clock } from '@phosphor-icons/react/dist/csr/Clock'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { Package } from '@phosphor-icons/react/dist/csr/Package'
import type { RelationalSession } from '@fouc/shared'
import { DATABASE_ADMIN_OBJECT_LIMITS, type DatabaseAdminObjectDetails, type DatabaseAdminObjectList } from '@fouc/shared/database-admin-objects'
import { useSchemaObjectResource } from '../schema-objects/resource'
import { MySqlEventDetailsView } from './event-details'
import { PostgresExtensionDetailsView } from './extension-details'
import styles from './admin-objects.module.css'

export interface DatabaseAdminObjectsPanelProps { base: string; session: RelationalSession; schema: string }
export function DatabaseAdminObjectsPanel(props: DatabaseAdminObjectsPanelProps) {
  if (props.session.provider === 'sqlite') return <p className={styles.empty}>SQLite 没有 MySQL 事件或 PostgreSQL 扩展目录。</p>
  return <ObjectBrowser key={`${props.base}:${props.session.provider}:${props.schema}`} {...props} />
}
function ObjectBrowser({ base, session, schema }: DatabaseAdminObjectsPanelProps) {
  const mysql = session.provider === 'mysql'
  const [search, setSearch] = useState('')
  const [request, setRequest] = useState<{ search: string; filter: 'all' | 'installed' | 'available'; offset: number }>({ search: '', filter: 'installed', offset: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [revision, setRevision] = useState(0), [detailRevision, setDetailRevision] = useState(0)
  useEffect(() => {
    if (search === request.search) return
    const timer = setTimeout(() => { setRequest(current => ({ ...current, search, offset: 0 })); setSelected(null) }, 200)
    return () => clearTimeout(timer)
  }, [search, request.search])
  const input = mysql
    ? { kind: 'event', schema, search: request.search, offset: request.offset, limit: DATABASE_ADMIN_OBJECT_LIMITS.page }
    : { kind: 'extension', filter: request.filter, search: request.search, offset: request.offset, limit: DATABASE_ADMIN_OBJECT_LIMITS.page }
  const list = useSchemaObjectResource<DatabaseAdminObjectList>(`${base}/admin-objects/list`, JSON.stringify(input), revision)
  const current = list.data?.items.find(item => item.id === selected) ?? list.data?.items[0] ?? null
  const detailInput = current?.kind === 'event'
    ? { kind: 'event', schema: current.schema, name: current.name }
    : { kind: 'extension', name: current?.name }
  const details = useSchemaObjectResource<DatabaseAdminObjectDetails>(current ? `${base}/admin-objects/details` : null, JSON.stringify(detailInput), revision + detailRevision)
  function nextPage(offset: number) { setSelected(null); setRequest(value => ({ ...value, offset })) }
  return <section className={styles.panel} aria-label="原生专属对象目录">
    <header className={styles.toolbar}>
      {mysql ? <Clock size={17} /> : <Package size={17} />}
      <div><strong>{mysql ? 'MySQL 事件' : 'PostgreSQL 扩展'}</strong><code>{mysql ? schema : session.database}</code></div>
      <span className={styles.readOnly}>只读目录</span>
      <button type="button" aria-label="刷新专属对象目录" onClick={() => setRevision(value => value + 1)}><ArrowsClockwise size={15} /></button>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <label className={styles.search}><MagnifyingGlass size={14} /><input aria-label="搜索专属对象" placeholder={mysql ? '搜索事件名称或注释…' : '搜索扩展名称或说明…'} value={search} onChange={event => setSearch(event.target.value)} /></label>
        {!mysql && <div className={styles.filters} aria-label="扩展安装状态筛选">
          {([['installed', '已安装'], ['available', '可安装'], ['all', '全部']] as const).map(([filter, label]) =>
            <button key={filter} type="button" aria-pressed={request.filter === filter} onClick={() => { setSelected(null); setRequest(value => ({ ...value, filter, offset: 0 })) }}>{label}</button>)}
        </div>}
        <div className={styles.listCaption}><span>{mysql ? 'EVENTS' : 'EXTENSIONS'}</span><small>{list.loading ? '读取中' : list.data ? `${list.data.items.length} 项` : '—'}</small></div>
        <div className={styles.objectList}>
          {list.loading ? <p className={styles.empty} role="status">读取原生目录…</p> : list.error ? <div className={styles.listError}><p role="alert">{list.error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>重试目录</button></div> : list.data?.items.length ? list.data.items.map(item =>
            <button type="button" key={item.id} aria-label={`查看${item.kind === 'event' ? '事件' : '扩展'} ${item.name}`} aria-pressed={item.id === current?.id} onClick={() => setSelected(item.id)}>
              {mysql ? <Clock size={14} /> : <Package size={14} />}
              <span><strong>{item.name}</strong><small>{mysql ? `${item.status ?? '状态未知'} · ${item.schedule ?? '调度未知'}` : item.installedVersion ? `已安装 ${item.installedVersion} · ${item.schema ?? 'Schema 未知'}` : `可安装 ${item.defaultVersion ?? '版本未知'}`}</small>{item.comment && <em title={item.comment}>{item.comment}</em>}</span>
            </button>) : <p className={styles.empty}>{search ? '没有匹配的专属对象。' : mysql ? '当前角色可见范围内没有事件。' : '当前筛选没有扩展。'}</p>}
        </div>
        <footer className={styles.listFooter}>
          <span>{list.data?.items.length ? `${request.offset + 1}–${request.offset + list.data.items.length}` : '—'}</span>
          <button type="button" aria-label="上一页专属对象" disabled={list.loading || request.offset === 0} onClick={() => nextPage(Math.max(0, request.offset - DATABASE_ADMIN_OBJECT_LIMITS.page))}><CaretLeft size={13} /></button>
          <button type="button" aria-label="下一页专属对象" disabled={list.loading || !list.data?.hasMore} onClick={() => nextPage(request.offset + DATABASE_ADMIN_OBJECT_LIMITS.page)}><CaretRight size={13} /></button>
        </footer>
      </aside>
      <main className={styles.details}>
        {details.loading ? <p className={styles.loading} role="status">读取原生对象详情…</p> : details.error ? <div className={styles.detailError}><p role="alert">{details.error}</p><button type="button" onClick={() => setDetailRevision(value => value + 1)}>重试详情</button></div> : details.data?.kind === 'event' ? <MySqlEventDetailsView key={current?.id} details={details.data} /> : details.data?.kind === 'extension' ? <PostgresExtensionDetailsView key={current?.id} details={details.data} /> : <p className={styles.loading}>选择对象以读取原生详情。</p>}
      </main>
    </div>
    <div className={styles.catalogNotice}>{list.data?.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>
  </section>
}
