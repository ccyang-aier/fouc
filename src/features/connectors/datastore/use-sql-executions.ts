"use client"
import { useEffect, useRef, useState } from 'react'
import { sqlExecutionActive, type SqlExecutionPoll, type SqlExecutionSnapshot, type SqlStatementRange, type SqlTemplateInput } from '@fouc/shared'
import { backendFetch, BackendRequestError } from '@/lib/backend'

export type SqlExecutionUI = { running: boolean; snapshot: SqlExecutionSnapshot | null; error: string; connectionError: string; selectedResult: number }
/** Each document owns its execution; switching tabs cannot reroute results or cancellation. */
export function useSqlExecutions(base: string, onFinished: () => void) {
  const [executions, setExecutions] = useState<Record<string, SqlExecutionUI>>({})
  const locks = useRef(new Set<string>())
  const registrations = useRef(new Map<string, { id: string | null; cancelRequested: boolean; terminal: boolean }>())
  const alive = useRef(true), finished = useRef(onFinished)
  useEffect(() => { finished.current = onFinished }, [onFinished])
  useEffect(() => {
    alive.current = true
    const owned = registrations.current
    return () => {
      alive.current = false
      for (const registration of owned.values()) {
        registration.cancelRequested = true
        if (registration.id) void backendFetch(`${base}/executions/${registration.id}/cancel`, { method: 'POST' }).catch(() => undefined)
      }
    }
  }, [base])
  function publish(tabId: string, snapshot: SqlExecutionSnapshot) {
    if (!alive.current) return
    const registration = registrations.current.get(tabId)
    if (!registration || registration.id !== snapshot.id) return
    if (registration.terminal && sqlExecutionActive(snapshot)) return
    if (!sqlExecutionActive(snapshot)) { registration.terminal = true; locks.current.delete(tabId) }
    setExecutions((items) => {
      const previous = items[tabId]
      if (previous?.snapshot?.id === snapshot.id && previous.snapshot.revision > snapshot.revision) return items
      return { ...items, [tabId]: { running: sqlExecutionActive(snapshot), snapshot, error: '', connectionError: '', selectedResult: previous?.snapshot?.id === snapshot.id ? previous.selectedResult : 0 } }
    })
  }
  async function cancel(tabId: string) {
    const registration = registrations.current.get(tabId)
    if (!registration) return
    registration.cancelRequested = true
    if (!registration.id) return
    try {
      const snapshot = await backendFetch<SqlExecutionSnapshot>(`${base}/executions/${registration.id}/cancel`, { method: 'POST' })
      publish(tabId, snapshot)
    } catch (reason) {
      if (alive.current && registrations.current.get(tabId) === registration) setExecutions((items) => ({ ...items, [tabId]: { ...items[tabId], connectionError: `取消请求未确认：${reason instanceof Error ? reason.message : String(reason)}。可重试取消。` } }))
    }
  }
  async function run(tabId: string, target: SqlStatementRange, schema: string | null, template: SqlTemplateInput = {}) {
    if (locks.current.has(tabId)) return
    locks.current.add(tabId)
    const registration = { id: null as string | null, cancelRequested: false, terminal: false }
    registrations.current.set(tabId, registration)
    setExecutions((items) => ({ ...items, [tabId]: { running: true, snapshot: null, error: '', connectionError: '', selectedResult: 0 } }))
    try {
      let snapshot = await backendFetch<SqlExecutionSnapshot>(`${base}/executions`, { method: 'POST', body: JSON.stringify({ sql: target.sql, offset: target.from, schema, maxRows: 500, ...template }) })
      registration.id = snapshot.id
      if (registration.cancelRequested || !alive.current) {
        snapshot = await backendFetch<SqlExecutionSnapshot>(`${base}/executions/${snapshot.id}/cancel`, { method: 'POST' })
      }
      publish(tabId, snapshot)
      while (sqlExecutionActive(snapshot) && !registration.terminal && alive.current) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        if (!alive.current || registration.terminal) break
        try {
          const update = await backendFetch<SqlExecutionPoll>(`${base}/executions/${snapshot.id}?revision=${snapshot.revision}`)
          if (registration.terminal || registrations.current.get(tabId) !== registration) break
          if (update.execution) { snapshot = update.execution; publish(tabId, snapshot) }
          else setExecutions((items) => items[tabId]?.connectionError ? { ...items, [tabId]: { ...items[tabId], connectionError: '' } } : items)
        } catch (reason) {
          if (!alive.current || registration.terminal || registrations.current.get(tabId) !== registration) break
          if (reason instanceof BackendRequestError && reason.status === 400) {
            setExecutions((items) => ({ ...items, [tabId]: { ...items[tabId], running: false,
              connectionError: '设备会话或执行记录已释放，无法确认此查询的最终结果。已返回的结果仍保留，请重新连接后执行。' } }))
            break
          }
          setExecutions((items) => ({ ...items, [tabId]: { ...items[tabId], connectionError: `执行状态暂不可用：${reason instanceof Error ? reason.message : String(reason)}。正在重连，尚未确认查询结束。` } }))
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }
    } catch (reason) {
      if (alive.current) setExecutions((items) => ({ ...items, [tabId]: { running: false, snapshot: null, connectionError: '', selectedResult: 0, error: reason instanceof Error ? reason.message : '查询请求失败' } }))
    } finally {
      if (registrations.current.get(tabId) === registration) { locks.current.delete(tabId); registrations.current.delete(tabId) }
      if (alive.current) finished.current()
    }
  }
  function forget(ids: string[]) {
    for (const id of ids) if (!locks.current.has(id)) registrations.current.delete(id)
    setExecutions((items) => Object.fromEntries(Object.entries(items).filter(([id]) => !ids.includes(id))))
  }
  function selectResult(tabId: string, index: number) {
    setExecutions((items) => items[tabId]?.snapshot?.statements[index] ? { ...items, [tabId]: { ...items[tabId], selectedResult: index } } : items)
  }
  return { executions, locks, run, cancel, forget, selectResult }
}
