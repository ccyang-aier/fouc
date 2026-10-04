'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DATABASE_ACTIVITY_LIMITS, type DatabaseActivitySnapshot } from '@fouc/shared/database-activity';
import { backendFetch } from '@/lib/backend';

/** DBX single-flight polling and bounded chart history, owned by the mounted scope. */
export function useDatabaseActivity(base: string, blocked: boolean) {
  const [samples, setSamples] = useState<DatabaseActivitySnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [interval, setIntervalSeconds] = useState(5);
  const [paused, setPaused] = useState(false);
  const request = useRef<AbortController | null>(null);
  const block = useRef(blocked);
  useEffect(() => { block.current = blocked; }, [blocked]);

  const refresh = useCallback(async () => {
    if (request.current || block.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const sample = await backendFetch<DatabaseActivitySnapshot>(`${base}/activity/snapshot`, { signal: controller.signal });
      if (!controller.signal.aborted && request.current === controller) setSamples(previous => [...previous, sample].slice(-DATABASE_ACTIVITY_LIMITS.samples));
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }, [base]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(); });
    return () => { disposed = true; request.current?.abort(); request.current = null; };
  }, [refresh]);

  useEffect(() => {
    if (paused || blocked) return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, interval * 1000);
    return () => window.clearInterval(timer);
  }, [paused, blocked, interval, refresh]);

  function pause(value: boolean) {
    setPaused(value);
    if (value) {
      request.current?.abort();
      request.current = null;
      setBusy(false);
    }
  }

  return { samples, latest: samples.at(-1), busy, error, interval, setIntervalSeconds, paused, pause, refresh };
}
