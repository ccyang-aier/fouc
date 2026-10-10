"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, ArrowRight, Database, Hash, MagnifyingGlass, SpinnerGap, Stack, Table, WarningCircle, X } from '@phosphor-icons/react'
import { SCHEMA_OBJECT_KINDS, SCHEMA_SEARCH_LABELS, type RelationalSession, type SchemaSearchHit, type SchemaSearchKind, type SchemaSearchResult } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlDialog } from '../sql-library-dialog'
import styles from './schema-search.module.css'

export type SchemaSearchActionProps = { base: string; session: RelationalSession; connectionLabel?: string; currentSchema?: string | null; disabled?: boolean; onOpen: (hit: SchemaSearchHit) => void | Promise<void>; onNotice?: (message: string) => void }
type SearchState = { signature: string; status: 'loading' | 'ready' | 'error' | 'cancelled'; data: SchemaSearchResult | null; error: string | null }
const categories: { id: 'all' | 'relations' | 'column' | 'routines'; label: string }[] = [{ id: 'all', label: '全部对象' }, { id: 'relations', label: '表与视图' }, { id: 'column', label: '字段' }, { id: 'routines', label: '例程与其他' }]
const kindIcon = (kind: SchemaSearchKind) => kind === 'schema' ? Database : kind === 'column' ? Hash : kind === 'table' || kind === 'view' || kind === 'materialized-view' ? Table : Stack
function Highlight({ hit }: { hit: SchemaSearchHit }) {
  if (hit.match.field !== 'name') return <>{hit.label}</>
  const indices = new Set(hit.match.indices), parts: { text: string; match: boolean }[] = []
  for (let index = 0; index < hit.label.length; index++) { const match = indices.has(index), previous = parts[parts.length - 1]; if (previous?.match === match) previous.text += hit.label[index]; else parts.push({ text: hit.label[index], match }) }
  return <>{parts.map((part, index) => part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>)}</>
}

function SchemaSearchDialog({ base, session, connectionLabel, currentSchema, onOpen, onNotice, onClose }: Omit<SchemaSearchActionProps, 'disabled'> & { onClose: () => void }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState<typeof categories[number]['id']>('all'), [includeColumns, setIncludeColumns] = useState(false), [caseSensitive, setCaseSensitive] = useState(false), [schema, setSchema] = useState(''), [schemas, setSchemas] = useState<string[]>(currentSchema ? [currentSchema] : []), [schemaError, setSchemaError] = useState<string | null>(null), [schemaRetry, setSchemaRetry] = useState(0)
  const [search, setSearch] = useState<SearchState | null>(null), [selected, setSelected] = useState(0), [retry, setRetry] = useState(0), [opening, setOpening] = useState<string | null>(null), [openError, setOpenError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null), generation = useRef(0), list = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), alive = useRef(true)
  const columnSearch = category === 'column' || includeColumns && category === 'all'
  const kindFilter = useMemo(() => category === 'relations' ? ['table', 'view', 'materialized-view'] as SchemaSearchKind[] : category === 'column' ? ['column'] as SchemaSearchKind[] : category === 'routines' ? SCHEMA_OBJECT_KINDS[session.provider].filter((kind) => kind !== 'view' && kind !== 'materialized-view') : undefined, [category, session.provider])
  const signature = JSON.stringify([query.trim(), category, columnSearch, caseSensitive, schema, retry]), visible = search?.signature === signature ? search : null, hits = visible?.status === 'ready' ? visible.data?.hits ?? [] : [], index = Math.min(selected, Math.max(0, hits.length - 1)), active = hits[index], pending = !!query.trim() && (!visible || visible.status === 'loading')
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort() } }, [])
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<string[]>(`${base}/schemas`, { signal: controller.signal }).then((values) => { if (!controller.signal.aborted) { setSchemas([...new Set(values)]); setSchemaError(null) } }).catch((reason: unknown) => { if (!controller.signal.aborted) setSchemaError(reason instanceof Error ? reason.message : String(reason)) })
    return () => controller.abort()
  }, [base, schemaRetry])
  useEffect(() => {
    const sequence = ++generation.current, controller = new AbortController(); request.current = controller
    if (!query.trim()) return () => controller.abort()
    const timer = window.setTimeout(() => {
      if (sequence !== generation.current || controller.signal.aborted) return
      setSearch({ signature, status: 'loading', data: null, error: null }); setSelected(0); setOpenError(null)
      void backendFetch<SchemaSearchResult>(`${base}/schema-search`, { method: 'POST', signal: controller.signal, body: JSON.stringify({ query: query.trim(), ...(schema ? { schemas: [schema] } : {}), ...(kindFilter ? { kinds: kindFilter } : {}), includeColumns: columnSearch, caseSensitive, limit: 200 }) }).then((data) => {
        if (sequence === generation.current && !controller.signal.aborted) setSearch({ signature, status: 'ready', data, error: null })
      }).catch((reason: unknown) => { if (sequence === generation.current && !controller.signal.aborted) setSearch({ signature, status: 'error', data: null, error: reason instanceof Error ? reason.message : String(reason) }) })
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
    // The signature owns every request parameter; the effect uses one stable request generation.
  }, [base, signature, query, schema, kindFilter, columnSearch, caseSensitive])
  useEffect(() => { list.current?.querySelector(`[data-result-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }) }, [index, hits.length])
  async function open(hit: SchemaSearchHit) {
    if (opening) return
    setOpening(hit.id); setOpenError(null)
    try { await onOpen(hit); if (alive.current) onClose() }
    catch (reason) { if (alive.current) { const message = reason instanceof Error ? reason.message : String(reason); setOpenError(message); onNotice?.(message) } }
    finally { if (alive.current) setOpening(null) }
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || opening) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (hits.length) setSelected((value) => (Math.min(value, hits.length - 1) + (event.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length) }
    else if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); setSelected(0) }
    else if (event.key === 'End' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); setSelected(Math.max(0, hits.length - 1)) }
    else if (event.key === 'Enter' && active) { event.preventDefault(); void open(active) }
  }
  function cancel() { request.current?.abort(); generation.current++; setSearch({ signature, status: 'cancelled', data: null, error: null }) }
  const data = visible?.data
  return <SqlDialog title="搜索当前连接" className={styles.dialog} busy={!!opening} onClose={onClose}>
    <div className={styles.searchBox}><MagnifyingGlass size={20} /><input ref={input} autoFocus aria-label="搜索对象或字段" role="combobox" aria-autocomplete="list" aria-expanded={hits.length > 0} aria-controls="schema-search-results" aria-activedescendant={active ? `schema-search-result-${index}` : undefined} placeholder="对象名称、字段或 schema.table…" maxLength={256} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); setOpenError(null) }} onKeyDown={navigate} />{query && <button title="清空搜索" aria-label="清空搜索" onClick={() => { setQuery(''); input.current?.focus() }}><X size={14} /></button>}{pending && <SpinnerGap size={17} className={styles.spin} />}</div>
    <div className={styles.filters}><div className={styles.categories} role="group" aria-label="搜索类别">{categories.filter((item) => item.id !== 'routines' || session.provider !== 'sqlite' || SCHEMA_OBJECT_KINDS.sqlite.includes('trigger')).map((item) => <button key={item.id} aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setSelected(0) }}>{item.label}</button>)}</div><div className={styles.options}><label className={styles.schemaSelect}>范围<select aria-label="搜索 Schema 范围" value={schema} onChange={(event) => setSchema(event.target.value)}><option value="">当前连接全部 Schema</option>{schema && !schemas.includes(schema) && <option value={schema}>{schema}（刷新中）</option>}{schemas.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label><input type="checkbox" checked={includeColumns} disabled={category !== 'all'} onChange={(event) => setIncludeColumns(event.target.checked)} />包含字段</label><label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />区分大小写</label></div></div>
    <div className={styles.scope}><Database size={13} /><span>{connectionLabel ?? session.database ?? '当前连接'} · {session.provider.toUpperCase()}</span><small>当前会话{columnSearch ? ' · 字段扫描最多 120 个关系' : ' · 对象名称与元数据'}</small></div>
    {schemaError && <p className={styles.schemaWarning}><WarningCircle size={13} />Schema 范围列表读取失败：{schemaError}<button onClick={() => setSchemaRetry((value) => value + 1)}>刷新范围</button></p>}
    <div className={styles.results} ref={list} id="schema-search-results" role="listbox" aria-label="对象搜索结果" aria-busy={pending}>
      {!query.trim() ? <div className={styles.empty}><MagnifyingGlass size={28} /><strong>快速定位数据库对象</strong><p>输入名称、词首缩写或完整路径。搜索只读取当前连接的可见元数据。</p><small>如 user_profile → up；字段搜索支持表名.字段名。</small></div> : pending ? <div className={styles.empty} role="status"><SpinnerGap size={24} className={styles.spin} /><strong>正在读取元数据</strong><p>{columnSearch ? '正在有界扫描字段名称；更改条件会取消当前搜索。' : '正在扫描当前连接的 Schema 与对象目录。'}</p><button onClick={cancel}>取消搜索</button></div> : visible?.status === 'cancelled' ? <div className={styles.empty}><strong>搜索已取消</strong><p>未完成的结果已丢弃。已发出的元数据读取可能继续完成。</p><button onClick={() => setRetry((value) => value + 1)}>重新搜索</button></div> : visible?.status === 'error' ? <div className={styles.empty} role="alert"><WarningCircle size={26} /><strong>搜索未完成</strong><p>{visible.error}</p><button onClick={() => setRetry((value) => value + 1)}>重试搜索</button></div> : !hits.length ? <div className={styles.empty}><MagnifyingGlass size={28} /><strong>当前扫描范围没有匹配项</strong><p>{data?.scope.complete ? '可换用对象前缀、词首缩写、路径或开启字段搜索。' : '部分目录未能完成读取，请查看范围提示或选择具体 Schema。'}</p></div> : hits.map((hit, hitIndex) => { const Icon = kindIcon(hit.kind); return <div key={hit.id} id={`schema-search-result-${hitIndex}`} data-result-index={hitIndex} role="option" aria-selected={hitIndex === index} className={styles.hit} onPointerMove={() => setSelected(hitIndex)} onMouseDown={(event) => event.preventDefault()} onClick={() => { void open(hit) }}>
        <div className={styles.hitIcon}><Icon size={18} /></div><div className={styles.hitBody}><strong><Highlight hit={hit} />{hit.match.kind === 'exact' && hit.match.field === 'name' && <i>精确匹配</i>}</strong><span>{hit.schema}{hit.parentName && ` / ${hit.parentName}`}{hit.dataType && <code>{hit.dataType}</code>}{hit.match.field !== 'name' && <small>匹配{hit.match.field === 'comment' ? '注释' : hit.match.field === 'type' ? '类型' : '路径'}：{hit.match.text}</small>}</span>{hit.comment && <p title={hit.comment}>{hit.comment}</p>}</div><span className={styles.kind}>{SCHEMA_SEARCH_LABELS[hit.kind]}</span>{opening === hit.id ? <SpinnerGap size={15} className={styles.spin} /> : hitIndex === index && <ArrowRight size={14} className={styles.openArrow} />}
      </div> })}
    </div>
    {(data && (!data.scope.complete || data.truncated || data.issues.length > 0)) && <details className={styles.issues}><summary><WarningCircle size={13} />{!data.scope.complete ? '部分范围已跳过或未完成' : `匹配 ${data.totalMatches} 项，显示前 ${data.limit} 项`}<span>查看范围</span></summary><div>{data.scope.limits.map((message) => <p key={message}>{message}</p>)}{data.issues.map((item, issueIndex) => <p key={issueIndex}><strong>{[item.schema, item.table].filter(Boolean).join(' / ')}</strong> · {item.operation === 'columns' ? '字段' : item.operation === 'tables' ? '关系目录' : '原生对象'}：{item.message}</p>)}</div></details>}
    {openError && <p role="alert" className={styles.openError}><WarningCircle size={14} />{openError}</p>}
    <footer className={styles.footer}><span>{data ? `${hits.length} 项 · ${data.scope.schemas.length} / ${data.scope.schemasTotal} Schema${columnSearch ? ` · ${data.scope.columnTablesScanned} / ${data.scope.columnTablesTotal} 关系字段` : ''} · ${data.elapsedMs} ms` : '仅当前连接；不搜索未连接的服务器'}</span><div><kbd><ArrowUp size={10} /><ArrowDown size={10} /></kbd><small>选择</small><kbd>Enter</kbd><small>打开</small><button disabled={!active || !!opening} onClick={() => active && void open(active)}>{opening ? '定位中…' : '打开对象'}<ArrowRight size={12} /></button></div></footer>
  </SqlDialog>
}

export function SchemaSearchAction(props: SchemaSearchActionProps) {
  const [open, setOpen] = useState(false)
  return <><button type="button" aria-label="搜索对象" title="搜索对象" className={`${styles.trigger} fouc-action`} data-surface="subtle" disabled={props.disabled} onClick={() => setOpen(true)}><MagnifyingGlass size={14} /><span>搜索对象</span></button>{open && <SchemaSearchDialog key={`${props.session.id}`} {...props} onClose={() => setOpen(false)} />}</>
}
