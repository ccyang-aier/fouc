"use client"
import { useEffect, useRef, useState } from 'react'
import type { RedisMonitorRecord } from '@fouc/shared'
import { getBackendEndpoint } from '@/lib/backend'
import { RedisMonitorDecoder, redisMonitorRows } from './redis-monitor-model'

export interface RedisMonitorState {
  status: 'idle' | 'connecting' | 'listening' | 'stopped' | 'failed'
  records: RedisMonitorRecord[]
  dropped: number
  error: string
}
const empty = (): RedisMonitorState => ({ status: 'idle', records: [], dropped: 0, error: '' })
export function useRedisMonitor(base: string) {
  const [state, setState] = useState<RedisMonitorState>(empty)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => { active.current?.abort(); active.current = null }, [base])
  function stop() {
    active.current?.abort(); active.current = null
    setState((current) => ({ ...current, status: 'stopped' }))
  }
  function clear() { setState(empty()) }
  async function start() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setState({ ...empty(), status: 'connecting' })
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const endpoint = await getBackendEndpoint()
      const response = await fetch(`${endpoint.baseUrl}${base}/monitor`, { method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}) }, body: '{}' })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error?.message ?? `MONITOR 连接失败 (${response.status})`) }
      if (!response.body || !response.headers.get('content-type')?.startsWith('application/x-ndjson')) throw new Error('Redis MONITOR 流不可用')
      reader = response.body.getReader()
      const decoder = new RedisMonitorDecoder()
      while (!controller.signal.aborted) {
        const chunk = await reader.read()
        if (chunk.done) { decoder.finish(); throw new Error('Redis MONITOR 连接已结束') }
        for (const frame of decoder.feed(chunk.value)) {
          if (controller.signal.aborted || active.current !== controller) return
          if (frame.type === 'error') throw new Error(frame.message)
          if (frame.type === 'ready') setState((current) => ({ ...current, status: 'listening' }))
          else setState((current) => ({ ...current, records: redisMonitorRows(current.records, frame.records), dropped: current.dropped + frame.dropped }))
        }
      }
    } catch (reason) {
      if (!controller.signal.aborted && active.current === controller) setState((current) => ({ ...current, status: 'failed', error: reason instanceof Error ? reason.message : String(reason) }))
    } finally {
      await reader?.cancel().catch(() => {})
      reader?.releaseLock()
      if (active.current === controller) active.current = null
    }
  }
  return { state, start, stop, clear }
}
