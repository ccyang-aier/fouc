'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowsLeftRight, ArrowRight, SpinnerGap } from '@phosphor-icons/react'
import type { DatabaseObjectInfo, RelationalProvider, RelationalTableStructure } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SchemaDiffPanel } from './schema-diff'
import { SqlDialog } from './sql-library-dialog'
import styles from './data-tools.module.css'

type Source = { schema: string; table: string; tables: DatabaseObjectInfo[]; schemas: string[] }
type Props = Source & { base: string; provider: RelationalProvider; disabled: boolean }
export function SchemaCompareAction(props: Props) {
  const [source, setSource] = useState<Source | null>(null)
  return <><button type="button" aria-label="比较表结构" disabled={props.disabled || !props.table} onClick={() => setSource({ schema: props.schema, table: props.table, tables: props.tables, schemas: props.schemas })}><ArrowsLeftRight size={15} /><span>比较结构</span></button>
    {source && <SchemaCompareDialog {...source} base={props.base} provider={props.provider} onClose={() => setSource(null)} />}</>
}

function SchemaCompareDialog({ base, provider, schema, table, tables, schemas, onClose }: Source & { base: string; provider: RelationalProvider; onClose: () => void }) {
  const [sourceSchema, setSourceSchema] = useState(schema), [sourceTable, setSourceTable] = useState(tables.find((item) => item.name !== table && item.kind === 'table')?.name ?? '')
  const [catalog, setCatalog] = useState<{ schema: string; items: DatabaseObjectInfo[]; error: string } | null>(null)
  const [comparison, setComparison] = useState<{ source: RelationalTableStructure; target: RelationalTableStructure } | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort(); request.current = null }, [])
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<DatabaseObjectInfo[]>(`${base}/schemas/${encodeURIComponent(sourceSchema)}/tables`, { signal: controller.signal }).then((items) => {
      if (!controller.signal.aborted) setCatalog({ schema: sourceSchema, items: items.filter((item) => item.kind === 'table'), error: '' })
    }).catch((reason) => { if (!controller.signal.aborted) setCatalog({ schema: sourceSchema, items: [], error: reason instanceof Error ? reason.message : String(reason) }) })
    return () => controller.abort()
  }, [base, sourceSchema])
  function changeSchema(value: string) { request.current?.abort(); request.current = null; setSourceSchema(value); setSourceTable(''); setComparison(null); setError(''); setLoading(false) }
  function changeTable(value: string) { request.current?.abort(); request.current = null; setSourceTable(value); setComparison(null); setError(''); setLoading(false) }
  async function compare() {
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    setLoading(true); setComparison(null); setError('')
    const read = (targetSchema: string, targetTable: string) => backendFetch<RelationalTableStructure>(`${base}/schemas/${encodeURIComponent(targetSchema)}/tables/${encodeURIComponent(targetTable)}/structure`, { signal: controller.signal })
    try {
      const [source, target] = await Promise.all([read(sourceSchema, sourceTable), read(schema, table)])
      if (request.current === controller && !controller.signal.aborted) setComparison({ source, target })
    } catch (reason) { if (request.current === controller && !controller.signal.aborted) { setError(reason instanceof Error ? reason.message : String(reason)); controller.abort() } }
    finally { if (request.current === controller) setLoading(false) }
  }
  const items = catalog?.schema === sourceSchema ? catalog.items : [], catalogError = catalog?.schema === sourceSchema ? catalog.error : ''
  return <SqlDialog title="比较表结构" className={styles.dialog} onClose={onClose}>
    {comparison && <div className={styles.mobileSource}><span title={`${sourceSchema}.${sourceTable} → ${schema}.${table}`}>{sourceSchema}.{sourceTable} → {schema}.{table}</span><button type="button" onClick={() => setComparison(null)}>修改来源</button></div>}
    <div className={styles.sources} data-ready={!!comparison}><label>参考 Schema<select aria-label="结构比较参考 Schema" value={sourceSchema} disabled={loading} onChange={(event) => changeSchema(event.target.value)}>{schemas.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>参考表<select aria-label="结构比较参考表" value={sourceTable} disabled={loading || catalog?.schema !== sourceSchema} onChange={(event) => changeTable(event.target.value)}><option value="">选择参考表</option>{items.map((item) => <option key={item.name} disabled={sourceSchema === schema && item.name === table}>{item.name}</option>)}</select></label><ArrowRight size={16} /><label>当前目标<strong>{schema}.{table}</strong><small>生成将目标调整为参考结构的审查脚本</small></label>
      <button type="button" disabled={loading || !sourceTable || !!catalogError || catalog?.schema !== sourceSchema || sourceSchema === schema && sourceTable === table} onClick={() => void compare()}>{loading ? '读取结构…' : comparison ? '重新比较' : '读取并比较'}</button></div>
    {(error || catalogError) && <p className={styles.error} role="alert">{error || catalogError}</p>}
    <div className={styles.body}>{loading ? <div className={styles.state} role="status"><SpinnerGap size={17} className="mw-spin" />正在读取两个对象的真实结构…</div> : comparison ? <SchemaDiffPanel key={`${comparison.source.schema}:${comparison.source.table}:${comparison.target.schema}:${comparison.target.table}`} provider={provider} {...comparison} sourceLabel={`${sourceSchema}.${sourceTable}`} targetLabel={`${schema}.${table}`} onClose={onClose} /> : <div className={styles.state}>选择参考表后比较字段、索引、约束与原始 DDL。</div>}</div>
  </SqlDialog>
}
