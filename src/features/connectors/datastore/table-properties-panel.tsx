"use client"

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowsClockwise, Code, Copy, Info, Key, Link, List, MagnifyingGlass, Table, TextAlignLeft, Timer } from '@phosphor-icons/react'
import type { RelationalTableStructure } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { useAppAlert } from '@/components/app-alert-provider'
import { WorkbenchSidePanel } from './workbench-side-panel'
import { SqlEditor } from './sql-editor'
import type { EditorView } from '@codemirror/view'
import styles from './table-properties-panel.module.css'

const tabs = [{ key: 'info', label: '表信息', icon: Info }, { key: 'ddl', label: 'DDL', icon: Code }, { key: 'columns', label: '字段', icon: List }, { key: 'indexes', label: '索引', icon: Key }, { key: 'foreignKeys', label: '外键', icon: Link }, { key: 'triggers', label: '触发器', icon: Timer }] as const
type Tab = typeof tabs[number]['key']
const propertyLabels: Record<string, string> = { owner: '所有者', comment: '注释', engine: '引擎', collation: '排序规则', rowFormat: '行格式', tablespace: '表空间', persistence: '持久类型', accessMethod: '访问方法', options: '选项', withoutRowid: 'WITHOUT ROWID', strict: 'STRICT', generatedColumns: '生成字段' }
export function TablePropertiesPanel({ base, database, schema, table, revision, editAction, pending = false, onClose, onOpenTable }: { base: string; database: string; schema: string; table: string; revision: number; editAction: ReactNode; pending?: boolean; onClose: () => void; onOpenTable: (schema: string, table: string) => void }) {
  const [tab, setTab] = useState<Tab>('info'), [search, setSearch] = useState(''), [pinned, setPinned] = useState(false), [wrap, setWrap] = useState(true)
  const [state, setState] = useState<{ key: string; structure?: RelationalTableStructure; error?: string }>({ key: '' }), [refresh, setRefresh] = useState(0)
  const source = useRef<EditorView | null>(null), { notify } = useAppAlert()
  const key = JSON.stringify([base, schema, table, revision, refresh]), loading = state.key !== key, structure = loading ? undefined : state.structure
  useEffect(() => { const controller = new AbortController(); void backendFetch<RelationalTableStructure>(`${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`, { signal: controller.signal }).then(structure => { if (!controller.signal.aborted) setState({ key, structure }) }).catch(error => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : '读取表属性失败' }) }); return () => controller.abort() }, [base, schema, table, key])
  const needle = search.trim().toLocaleLowerCase(), matches = (...values: unknown[]) => !needle || values.some(value => JSON.stringify(value)?.toLocaleLowerCase().includes(needle))
  const columns = structure?.columns.map((column, index) => ({ column, index })).filter(({ column, index }) => matches(column.name, column.dataType, column.comment, column.columnDefault, column.isNullable ? 'YES' : 'NO', index + 1)) ?? []
  const indexes = structure?.indexes.filter(index => matches(index.name, index.parts, index.predicate, index.method, index.unique ? 'UNIQUE' : '', index.primary ? 'PRIMARY' : '', index.definition)) ?? []
  const foreignKeys = structure?.foreignKeys.filter(foreign => matches(foreign.name, foreign.columns, foreign.referencedSchema, foreign.referencedTable, foreign.referencedColumns, foreign.onUpdate, foreign.onDelete)) ?? []
  const triggers = structure?.triggers.filter(trigger => matches(trigger.name, trigger.timing, trigger.events, trigger.orientation, trigger.enabled, trigger.definition)) ?? []
  async function copy() { if (!structure) return; try { await navigator.clipboard.writeText(structure.definition.sql); notify('success', 'DDL 已复制') } catch { notify('warning', '无法访问剪贴板，请选中 DDL 手动复制') } }
  return <WorkbenchSidePanel label="表属性" title={table} icon={<Table size={16} />} wide pinned={pinned} onPin={() => setPinned(value => !value)} onClose={onClose} actions={<>{tab === 'ddl' && <><button type="button" className="fouc-action" aria-label="复制 DDL" title="复制 DDL" disabled={!structure} onClick={() => void copy()}><Copy size={14} /><span>复制 DDL</span></button><button type="button" className="fouc-action" aria-label="DDL 自动换行" aria-pressed={wrap} onClick={() => setWrap(value => !value)}><TextAlignLeft size={14} /></button></>}{editAction}</>}>
    <div className={styles.tabs} role="tablist" aria-label="表属性分类">{tabs.map(item => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => { setTab(item.key); setSearch('') }}><item.icon size={15} />{item.label}</button>)}</div>
    <div className={styles.searchRow}><label><MagnifyingGlass size={15} /><input aria-label="搜索表属性" placeholder="搜索..." value={search} onChange={event => { setSearch(event.target.value); if (tab === 'ddl') { const view = source.current; if (view) { const position = view.state.doc.toString().toLocaleLowerCase().indexOf(event.target.value.toLocaleLowerCase()); if (position >= 0 && event.target.value) view.dispatch({ selection: { anchor: position, head: position + event.target.value.length }, scrollIntoView: true }) } } }} /></label><button type="button" className="fouc-action" aria-label="刷新表属性" disabled={loading} onClick={() => setRefresh(value => value + 1)}><ArrowsClockwise size={16} /></button></div>
    <div className={styles.content} role="tabpanel" aria-label={tabs.find(item => item.key === tab)?.label}>
      {loading ? <p className={styles.empty} role="status">正在读取表属性…</p> : state.error ? <p className={styles.error} role="alert">{state.error}</p> : structure && <>
        {tab === 'info' && <dl className={styles.info}>{[['表', structure.table], ['Schema', structure.schema], ['数据库', database], ...Object.entries(structure.properties).map(([name, value]) => [propertyLabels[name] ?? name, value ?? '未知'])].filter(([name, value]) => matches(name, value)).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value || '—'}</dd></div>)}</dl>}
        {tab === 'ddl' && <div className={styles.ddl}><SqlEditor value={structure.definition.sql} onChange={() => {}} onRun={() => {}} readOnly provider={structure.provider} label="表属性 DDL" editorRef={source} wrapLines={wrap} /></div>}
        {tab === 'columns' && <div className={styles.table}><table><thead><tr><th>#</th><th>列名</th><th>类型</th><th>可空</th><th>默认值</th></tr></thead><tbody>{columns.map(({ column, index }) => <tr key={column.name}><td>{index + 1}</td><td title={column.comment ?? undefined}>{column.isPrimaryKey && <Key size={12} />}{column.name}</td><td>{column.dataType}</td><td>{column.isNullable ? 'YES' : 'NO'}</td><td>{column.columnDefault ?? '—'}</td></tr>)}</tbody></table></div>}
        {tab === 'indexes' && indexes.map(index => <article key={index.name} className={styles.card}><strong>{index.name}</strong><div>{index.unique && <span className={styles.badge}>UNIQUE</span>}{index.primary && <span className={styles.badge}>PRIMARY</span>}<small>{index.method}</small></div>{index.parts.map(part => <code key={part.position}>{part.column ?? part.expression ?? (part.role === 'auxiliary' ? '辅助键' : '表达式（见 DDL）')}{part.role === 'include' ? ' · INCLUDE' : ''}{part.descending ? ' DESC' : ''}</code>)}{index.predicate && <code>{index.predicate}</code>}{index.definition && <details><summary>定义</summary><pre>{index.definition}</pre></details>}</article>)}
        {tab === 'foreignKeys' && foreignKeys.map(foreign => <article key={foreign.name} className={styles.card}><strong>{foreign.name}</strong><button type="button" className="fouc-action" disabled={pending} onClick={() => { if (!pinned) onClose(); onOpenTable(foreign.referencedSchema, foreign.referencedTable) }}>{foreign.referencedSchema}.{foreign.referencedTable}</button>{foreign.columns.map((column, index) => <code key={column}>{column} → {foreign.referencedColumns[index]}</code>)}<small>UPDATE {foreign.onUpdate} · DELETE {foreign.onDelete}</small></article>)}
        {tab === 'triggers' && triggers.map(trigger => <article key={trigger.name} className={styles.card}><strong>{trigger.name}</strong><small>{trigger.timing} · {trigger.events.join(' / ')} · {trigger.orientation} · {trigger.enabled ?? '未知'}</small><pre>{trigger.definition}</pre></article>)}
        {tab !== 'ddl' && tab !== 'info' && !({ columns: columns.length, indexes: indexes.length, foreignKeys: foreignKeys.length, triggers: triggers.length }[tab]) && <p className={styles.empty}>{needle ? '没有匹配元数据' : '暂无元数据'}</p>}
      </>}
    </div>
    {structure?.definition.warnings.length ? <details className={styles.warnings}><summary>元数据说明 · {structure.definition.warnings.length}</summary>{structure.definition.warnings.map(warning => <p key={warning}>{warning}</p>)}</details> : null}
  </WorkbenchSidePanel>
}
