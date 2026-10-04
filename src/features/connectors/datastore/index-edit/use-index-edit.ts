'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RelationalSession } from '@fouc/shared'
import type { IndexEditOptions, IndexEditPrepared, IndexEditInput, IndexEditCommitResult } from '@fouc/shared/index-edit'
import { backendFetch, BackendRequestError } from '@/lib/backend'

export function useIndexEdit(base: string, schema: string, table: string, onChanged: () => void, onWriteAccessChanged?: (session: RelationalSession) => void) {
  const endpoint = `${base}/index-edit`
  const [options, setOptions] = useState<IndexEditOptions | null>(null)
  const [session, setSession] = useState<RelationalSession | null>(null)
  const [prepared, setPrepared] = useState<IndexEditPrepared | null>(null)
  const [result, setResult] = useState<IndexEditCommitResult | null>(null)
  const [busy, setBusy] = useState<'loading' | 'preview' | 'unlock' | 'commit' | null>('loading')
  const [error, setError] = useState('')
  const live = useRef(true), held = useRef<IndexEditPrepared | null>(null), request = useRef<AbortController | null>(null)
  const callbacks = useRef({ onChanged, onWriteAccessChanged })
  useEffect(() => { callbacks.current = { onChanged, onWriteAccessChanged } }, [onChanged, onWriteAccessChanged])
  const discard = useCallback((id: string) => backendFetch(`${endpoint}/plans/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined), [endpoint])
  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy('loading'); setError('')
    try {
      const [current, metadata] = await Promise.all([
        backendFetch<RelationalSession>(base, { signal: controller.signal }),
        backendFetch<IndexEditOptions>(`${endpoint}/options?${new URLSearchParams({ schema, table })}`, { signal: controller.signal }),
      ])
      if (live.current && !controller.signal.aborted) { setSession(current); setOptions(metadata) }
    } catch (reason) {
      if (live.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    } finally { if (live.current && !controller.signal.aborted) setBusy(null) }
  }, [base, endpoint, schema, table])
  useEffect(() => {
    live.current = true; let disposed = false
    queueMicrotask(() => { if (!disposed) void load() })
    return () => {
      disposed = true; live.current = false; request.current?.abort()
      const current = held.current; held.current = null
      if (current) void discard(current.planId)
    }
  }, [discard, load])

  async function preview(input: IndexEditInput) {
    if (busy) return
    setBusy('preview'); setError(''); setResult(null)
    const old = held.current; held.current = null; setPrepared(null)
    if (old) await discard(old.planId)
    const controller = new AbortController(); request.current = controller
    try {
      const value = await backendFetch<IndexEditPrepared>(`${endpoint}/plans`, { method: 'POST', body: JSON.stringify(input), signal: controller.signal })
      if (!live.current || controller.signal.aborted) { await discard(value.planId); return }
      held.current = value; setPrepared(value)
    } catch (reason) {
      if (live.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    } finally { if (live.current && !controller.signal.aborted) setBusy(null) }
  }
  async function edit() {
    const current = held.current; held.current = null; setPrepared(null); setResult(null); setError('')
    if (current) await discard(current.planId)
  }
  async function unlock() {
    if (busy) return
    setBusy('unlock'); setError('')
    try {
      const current = await backendFetch<RelationalSession>(`${base}/write-access`, { method: 'PUT', body: JSON.stringify({ enabled: true }) })
      if (live.current) { setSession(current); callbacks.current.onWriteAccessChanged?.(current) }
    } catch (reason) { if (live.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (live.current) setBusy(null) }
  }
  async function commit() {
    const current = held.current
    if (!current || busy || current.expiresAt <= Date.now()) return
    held.current = null; setBusy('commit'); setError('')
    try {
      const value = await backendFetch<IndexEditCommitResult>(`${endpoint}/plans/${encodeURIComponent(current.planId)}/commit`, { method: 'POST', body: JSON.stringify({ confirm: true }) })
      if (!live.current) return
      setResult(value)
      if (value.outcome !== 'rejected') callbacks.current.onChanged()
    } catch (reason) {
      if (!live.current) return
      const rejected = reason instanceof BackendRequestError && reason.status >= 400 && reason.status < 500
      setResult({ outcome: rejected ? 'rejected' : 'unknown', schema, table, index: current.review.index, sql: current.review.sql, executionTimeMs: 0, message: `${rejected ? '' : '提交响应未确认，请刷新真实结构核对。'}${reason instanceof Error ? reason.message : String(reason)}` })
      if (!rejected) callbacks.current.onChanged()
    } finally { if (live.current) setBusy(null) }
  }
  const writable = Boolean(session && !session.capabilities.restrictions.readOnly && session.capabilities.capabilities.tableDataEdit)
  return { options, prepared, result, busy, error, writable, load, preview, edit, unlock, commit }
}
