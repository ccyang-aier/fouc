'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TableClearInput, TableClearPrepared, TableClearCommitResult } from '@fouc/shared/table-clear'
import { backendFetch, BackendRequestError } from '@/lib/backend'

export function useTableClear(base: string, onCleared: () => void, onBusyChange: (busy: boolean) => void) {
  const endpoint = `${base}/table-clear`
  const [prepared, setPrepared] = useState<TableClearPrepared | null>(null)
  const [result, setResult] = useState<TableClearCommitResult | null>(null)
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null)
  const [error, setError] = useState('')
  const live = useRef(true), held = useRef<TableClearPrepared | null>(null), request = useRef<AbortController | null>(null)
  const operation = useRef<'preview' | 'commit' | null>(null)
  const callbacks = useRef({ onCleared, onBusyChange })
  useEffect(() => { callbacks.current = { onCleared, onBusyChange } }, [onCleared, onBusyChange])
  const discard = useCallback((id: string) => backendFetch(`${endpoint}/plans/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined), [endpoint])
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false; request.current?.abort()
      if (held.current) void discard(held.current.planId)
      held.current = null; callbacks.current.onBusyChange(false)
    }
  }, [discard])

  const preview = useCallback(async (input: TableClearInput) => {
    if (operation.current === 'commit') return
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    operation.current = 'preview'; setBusy('preview'); setError(''); setResult(null)
    const old = held.current; held.current = null; setPrepared(null)
    if (old) await discard(old.planId)
    try {
      const value = await backendFetch<TableClearPrepared>(`${endpoint}/plans`, { method: 'POST', body: JSON.stringify(input), signal: controller.signal })
      if (!live.current || controller.signal.aborted) { await discard(value.planId); return }
      held.current = value; setPrepared(value)
    } catch (reason) { if (live.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (request.current === controller) { operation.current = null; if (live.current) setBusy(null) } }
  }, [discard, endpoint])

  async function commit(tableName: string) {
    const current = held.current
    if (!current || operation.current || current.expiresAt <= Date.now() || current.review.blockedReasons.length || tableName !== current.review.confirmationName) return
    held.current = null; operation.current = 'commit'; setBusy('commit'); setError(''); callbacks.current.onBusyChange(true)
    try {
      // The UI waits for the final native outcome. Closing cannot pretend a submitted DDL was cancelled.
      const value = await backendFetch<TableClearCommitResult>(`${endpoint}/plans/${encodeURIComponent(current.planId)}/commit`, { method: 'POST', body: JSON.stringify({ confirm: true, tableName }) })
      if (!live.current) return
      setResult(value)
      if (value.outcome === 'cleared' || value.outcome === 'unknown') callbacks.current.onCleared()
    } catch (reason) {
      if (!live.current) return
      const rejected = reason instanceof BackendRequestError && reason.status >= 400 && reason.status < 500
      setResult({ outcome: rejected ? 'rejected' : 'unknown', schema: current.review.schema, table: current.review.table, sql: current.review.sql, affectedRows: null, executionTimeMs: 0, message: `${rejected ? '' : '清空提交响应未确认，请刷新原生表数据核对，禁止自动重试。'}${reason instanceof Error ? reason.message : String(reason)}` })
      if (!rejected) callbacks.current.onCleared()
    } finally { operation.current = null; callbacks.current.onBusyChange(false); if (live.current) setBusy(null) }
  }
  return { prepared, result, busy, error, preview, commit }
}
