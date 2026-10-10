'use client'

import { useEffect, useRef, useState } from 'react'
import { PencilSimple, SpinnerGap } from '@phosphor-icons/react'
import type { RelationalTableStructure } from '@fouc/shared'
import type { StructureEditCommitResult, StructureEditInput, StructureEditPreview } from '@fouc/shared/relational-structure-edit'
import { backendFetch, BackendRequestError } from '@/lib/backend'
import { SqlDialog } from './sql-library-dialog'
import { TableStructureEditorPanel } from './structure-edit'
import styles from './structure-edit-action.module.css'

export function StructureEditAction({ base, schema, table, disabled, onApplied }: { base: string; schema: string; table: string; disabled: boolean; onApplied: () => void }) {
  const [target, setTarget] = useState<{ schema: string; table: string } | null>(null)
  return <><button type="button" className="fouc-action" data-surface="subtle" disabled={disabled} onClick={() => setTarget({ schema, table })}><PencilSimple size={14} />编辑表结构</button>{target && <StructureEditDialog base={base} {...target} onApplied={onApplied} onClose={() => setTarget(null)} />}</>
}
function StructureEditDialog({ base, schema, table, onApplied, onClose }: { base: string; schema: string; table: string; onApplied: () => void; onClose: () => void }) {
  const [structure, setStructure] = useState<RelationalTableStructure | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false)
  const live = useRef(true), request = useRef<AbortController | null>(null), plan = useRef<{ id: string; review: StructureEditPreview } | null>(null)
  const plansBase = `${base}/structure-edit/plans`
  const discard = (id: string) => backendFetch(`${plansBase}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined)
  useEffect(() => {
    live.current = true
    return () => { live.current = false; request.current?.abort(); const current = plan.current; plan.current = null; if (current) void backendFetch(`${plansBase}/${encodeURIComponent(current.id)}`, { method: 'DELETE' }).catch(() => undefined) }
  }, [plansBase])
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<RelationalTableStructure>(`${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setStructure(value); setError('') } }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => controller.abort()
  }, [base, schema, table, revision])
  async function preview(input: StructureEditInput) {
    const old = plan.current; plan.current = null; if (old) await discard(old.id)
    const controller = new AbortController(); request.current = controller
    const value = await backendFetch<{ planId: string; review: StructureEditPreview }>(plansBase, { method: 'POST', body: JSON.stringify({ schema, table, ...input }), signal: controller.signal })
    if (!live.current || controller.signal.aborted) { await discard(value.planId); throw new Error('结构预览已关闭') }
    plan.current = { id: value.planId, review: value.review }; return value.review
  }
  async function commit(review: StructureEditPreview) {
    const current = plan.current
    if (!current || current.review !== review) throw new Error('结构计划已变化，请重新生成预览')
    plan.current = null; setBusy(true)
    try {
      const result = await backendFetch<StructureEditCommitResult>(`${plansBase}/${encodeURIComponent(current.id)}/commit`, { method: 'POST', body: JSON.stringify({ confirm: true }) })
      if (['committed', 'partial', 'unknown'].includes(result.outcome)) onApplied()
      return result
    } catch (reason) {
      if (reason instanceof BackendRequestError && reason.status >= 400 && reason.status < 500) throw reason
      throw new Error(`结构提交结果未确认，请重新读取结构后核对。${reason instanceof Error ? reason.message : String(reason)}`)
    }
    finally { if (live.current) setBusy(false) }
  }
  return <SqlDialog title="编辑表结构" busy={busy} className={styles.dialog} onClose={onClose}><div className={styles.body}>{structure ? <TableStructureEditorPanel structure={structure} onPreview={preview} onCommit={commit} /> : error ? <div className={styles.state}><p role="alert">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>重新读取结构</button></div> : <div className={styles.state} role="status"><SpinnerGap size={18} className="mw-spin" />读取当前表的真实结构…</div>}</div></SqlDialog>
}
