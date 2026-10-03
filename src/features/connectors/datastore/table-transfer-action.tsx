'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowsLeftRight, Lock, LockOpen } from '@phosphor-icons/react'
import type { DatabaseObjectInfo, RelationalSavedConnection, RelationalSession, RelationalTableStructure } from '@fouc/shared'
import type { TableTransferInput, TableTransferPlan, TableTransferProgress, TableTransferResult } from '@fouc/shared/table-transfer'
import { backendFetch } from '@/lib/backend'
import { SqlDialog } from './sql-library-dialog'
import { RelationalDialog } from './relational-dialog'
import { TableTransferPanel } from './table-transfer'
import common from './relational.module.css'
import styles from './table-transfer-action.module.css'
import type { DatabaseConnectionOptionsInput } from '@fouc/shared/connection-options'

export function TableTransferAction({ session, schema, table, name, disabled }: { session: RelationalSession; schema: string; table: string; name: string; disabled: boolean }) {
  const [source, setSource] = useState<{ schema: string; table: string } | null>(null)
  return <><button type="button" disabled={disabled || !table} onClick={() => setSource({ schema, table })}><ArrowsLeftRight size={14} />跨库传输</button>{source && <TransferDialog session={session} name={name} {...source} onClose={() => setSource(null)} />}</>
}
function TransferDialog({ session, schema, table, name, onClose }: { session: RelationalSession; schema: string; table: string; name: string; onClose: () => void }) {
  const directory = `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/relational`, sourceBase = `${directory}/sessions/${session.id}`
  const [connections, setConnections] = useState<RelationalSavedConnection[]>([]), [connectionId, setConnectionId] = useState(''), [connecting, setConnecting] = useState(false)
  const [target, setTarget] = useState<RelationalSession | null>(null), [schemas, setSchemas] = useState<string[]>([]), [targetSchema, setTargetSchema] = useState(''), [tables, setTables] = useState<DatabaseObjectInfo[]>([]), [targetTable, setTargetTable] = useState('')
  const [source, setSource] = useState<RelationalTableStructure | null>(null), [targetStructure, setTargetStructure] = useState<RelationalTableStructure | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const plan = useRef<{ id: string; value: TableTransferPlan } | null>(null), task = useRef<string | null>(null), ownedTarget = useRef<string | null>(null), live = useRef(true)
  const targetBase = target ? `${directory}/sessions/${target.id}` : null
  const connection = connections.find(value => value.id === connectionId), targetWritable = target && !target.capabilities.restrictions.readOnly && target.capabilities.capabilities.tableDataEdit
  useEffect(() => {
    live.current = true
    const controller = new AbortController()
    void Promise.all([backendFetch<RelationalSavedConnection[]>(`${directory}/connections`, { signal: controller.signal }), backendFetch<RelationalTableStructure>(`${sourceBase}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`, { signal: controller.signal })]).then(([items, structure]) => { if (!controller.signal.aborted) { setConnections(items); setSource(structure) } }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => controller.abort()
  }, [directory, sourceBase, schema, table, revision])
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      if (plan.current) void backendFetch(`${sourceBase}/transfer/plans/${plan.current.id}`, { method: 'DELETE' }).catch(() => undefined)
      if (task.current) void backendFetch(`${sourceBase}/transfer/tasks/${task.current}`, { method: 'DELETE' }).catch(() => undefined)
      if (ownedTarget.current) void backendFetch(`${directory}/sessions/${ownedTarget.current}`, { method: 'DELETE' }).catch(() => undefined)
    }
  }, [directory, sourceBase])
  useEffect(() => {
    if (!targetBase) return
    const controller = new AbortController()
    void backendFetch<string[]>(`${targetBase}/schemas`, { signal: controller.signal }).then(items => { if (!controller.signal.aborted) { setSchemas(items); setTargetSchema(items.includes('public') ? 'public' : items.includes(target!.database) ? target!.database : items[0] ?? '') } }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)) })
    return () => controller.abort()
  }, [targetBase, target])
  useEffect(() => {
    if (!targetBase || !targetSchema) return
    const controller = new AbortController()
    void backendFetch<DatabaseObjectInfo[]>(`${targetBase}/schemas/${encodeURIComponent(targetSchema)}/tables`, { signal: controller.signal }).then(items => { if (!controller.signal.aborted) { setTables(items.filter(value => value.kind === 'table')); setTargetTable('') } }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)) })
    return () => controller.abort()
  }, [targetBase, targetSchema])
  useEffect(() => {
    if (!targetBase || !targetSchema || !targetTable) return
    const controller = new AbortController()
    void backendFetch<RelationalTableStructure>(`${targetBase}/schemas/${encodeURIComponent(targetSchema)}/tables/${encodeURIComponent(targetTable)}/structure`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setTargetStructure(value) }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)) })
    return () => controller.abort()
  }, [targetBase, targetSchema, targetTable, revision])
  async function connect(password: string, connectionOptions?: DatabaseConnectionOptionsInput) {
    const value = await backendFetch<RelationalSession>(`${directory}/connections/${connectionId}/connect`, { method: 'POST', body: JSON.stringify({ password, connectionOptions }) })
    if (!live.current) { await backendFetch(`${directory}/sessions/${value.id}`, { method: 'DELETE' }); return }
    ownedTarget.current = value.id; setTarget(value); setConnecting(false); setError('')
  }
  async function unlock() {
    setBusy(true); setError('')
    try { setTarget(await backendFetch<RelationalSession>(`${targetBase}/write-access`, { method: 'PUT', body: JSON.stringify({ enabled: !targetWritable }) })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  async function prepare(input: TableTransferInput) {
    setBusy(true)
    try {
      if (plan.current) { await backendFetch(`${sourceBase}/transfer/plans/${plan.current.id}`, { method: 'DELETE' }); plan.current = null }
      const value = await backendFetch<{ planId: string; plan: TableTransferPlan }>(`${sourceBase}/transfer/plans`, { method: 'POST', body: JSON.stringify({ sourceSchema: schema, sourceTable: table, targetSessionId: target!.id, targetSchema, targetTable, input }) })
      plan.current = { id: value.planId, value: value.plan }; return value.plan
    } finally { if (live.current) setBusy(false) }
  }
  async function execute(value: TableTransferPlan, control: { signal: AbortSignal; onProgress: (value: TableTransferProgress) => void }): Promise<TableTransferResult> {
    const prepared = plan.current
    if (!prepared || prepared.value !== value) throw new Error('传输计划已变化，请重新准备')
    plan.current = null; setBusy(true)
    let cancel: (() => void) | null = null
    try {
      const started = await backendFetch<{ taskId: string }>(`${sourceBase}/transfer/plans/${prepared.id}/start`, { method: 'POST', body: JSON.stringify({ confirm: true }) })
      task.current = started.taskId
      const taskBase = `${sourceBase}/transfer/tasks/${started.taskId}`
      cancel = () => { void backendFetch(taskBase, { method: 'DELETE' }).catch(() => undefined) }
      control.signal.addEventListener('abort', cancel, { once: true }); if (control.signal.aborted) cancel()
      for (;;) {
        const state = await backendFetch<{ progress: TableTransferProgress | null; result: TableTransferResult | null }>(taskBase)
        if (state.progress) control.onProgress(state.progress)
        if (state.result) { task.current = null; return state.result }
        await new Promise(resolve => setTimeout(resolve, 400))
      }
    } finally { if (cancel) control.signal.removeEventListener('abort', cancel); if (live.current) setBusy(false) }
  }
  return <SqlDialog title="跨库表数据传输" className={styles.dialog} busy={busy} onClose={onClose}><div className={styles.body}>
    <div className={styles.targetControls}><div><strong>传输到已有表</strong><small>目标使用独立连接，退出时关闭；准备计划不写入。</small></div>{!target ? <><label>目标连接<select aria-label="传输目标连接" value={connectionId} onChange={event => setConnectionId(event.target.value)} disabled={busy}><option value="">选择已保存连接</option>{connections.map(value => <option key={value.id} value={value.id}>{value.name} · {value.config.provider}</option>)}</select></label><button type="button" className={common.primary} disabled={!connection || busy} onClick={() => setConnecting(true)}>连接目标</button></> : <><label>目标 Schema<select aria-label="传输目标Schema" value={targetSchema} disabled={busy} onChange={event => { setTargetSchema(event.target.value); setTargetStructure(null); setTargetTable('') }}>{schemas.map(value => <option key={value}>{value}</option>)}</select></label><label>目标表<select aria-label="传输目标表" value={targetTable} disabled={busy} onChange={event => { setTargetTable(event.target.value); setTargetStructure(null) }}><option value="">选择已有普通表</option>{tables.map(value => <option key={value.name}>{value.name}</option>)}</select></label><button type="button" disabled={busy} className={common.secondary} onClick={() => void unlock()}>{targetWritable ? <LockOpen size={14} /> : <Lock size={14} />}{targetWritable ? '锁定目标写入' : '解锁传输目标写入'}</button></>}</div>
    {error && <p className={styles.error} role="alert">{error}<button type="button" onClick={() => { setError(''); setRevision(value => value + 1) }}>重试读取</button></p>}
    {source && targetStructure && targetWritable ? <TableTransferPanel source={source} target={targetStructure} sourceLabel={name} targetLabel={connection?.name} onPrepare={prepare} onExecute={execute} onComplete={() => setRevision(value => value + 1)} /> : <div className={styles.empty}><ArrowsLeftRight size={28} /><strong>{!source ? '读取源结构…' : !target ? '选择并连接传输目标' : !targetWritable ? '显式解锁目标写入后配置映射' : !targetTable ? '选择一张已有目标表' : '读取目标结构…'}</strong><span>{schema}.{table} → {target ? target.info.productName : '独立原生连接'} · 不清表，不自动重试</span></div>}
  </div>{connecting && connection && <RelationalDialog workspaceId={session.workspaceId} provider={connection.config.provider} connection={connection} intent="connect" onClose={() => setConnecting(false)} onConnect={connect} onSave={async () => undefined} />}</SqlDialog>
}
