"use client"
import { useEffect, useState } from 'react'
import { backendFetch } from '@/lib/backend'

/** POST only carries binary identifiers; these Stream endpoints perform reads. */
export function useRedisStreamRead<T>(url: string, body: string, revision: number, onResult: (result: T) => void) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      setLoading(true)
      try {
        const result = await backendFetch<T>(url, { method: 'POST', body, signal: controller.signal })
        if (!controller.signal.aborted) { setData(result); setError(''); onResult(result) }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void read()
    return () => controller.abort()
  }, [url, body, revision, onResult])
  return { data, loading, error }
}
