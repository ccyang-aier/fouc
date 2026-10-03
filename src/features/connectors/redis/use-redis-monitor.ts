"use client"
import { useEffect, useRef, useState } from 'react'
import type { RedisMonitorRecord } from '@fouc/shared'
import { redisMonitorFrame, redisMonitorRows } from './redis-monitor-model'
import { readRedisFrames } from './redis-live-stream'

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
    try {
      await readRedisFrames(`${base}/monitor`, controller.signal, redisMonitorFrame, (frame) => {
        if (controller.signal.aborted || active.current !== controller) return
        if (frame.type === 'error') throw new Error(frame.message)
        if (frame.type === 'ready') setState((current) => ({ ...current, status: 'listening' }))
        else setState((current) => ({ ...current, records: redisMonitorRows(current.records, frame.records), dropped: current.dropped + frame.dropped }))
      })
    } catch (reason) {
      if (!controller.signal.aborted && active.current === controller) setState((current) => ({ ...current, status: 'failed', error: reason instanceof Error ? reason.message : String(reason) }))
    } finally {
      if (active.current === controller) active.current = null
    }
  }
  return { state, start, stop, clear }
}
