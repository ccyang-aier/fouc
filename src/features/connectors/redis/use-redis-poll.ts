'use client';
import { backendFetch } from '@/lib/backend';
import { useEffect, useState } from 'react';
import { uiFailure, type UiMessage } from '../i18n/ui-message';

/** Serialized polling, scoped to the mounted view and verified session URL. */
export function useRedisPoll<T>(url: string, intervalSeconds: number, revision: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UiMessage>('');
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    async function poll() {
      if (controller.signal.aborted || running) return;
      running = true;
      setLoading(true);
      try {
        const result = await backendFetch<T>(url, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(uiFailure(reason));
      } finally {
        running = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          if (intervalSeconds > 0 && !document.hidden)
            timer = setTimeout(() => void poll(), intervalSeconds * 1000);
        }
      }
    }
    function visibility() {
      clearTimeout(timer);
      if (!document.hidden && intervalSeconds > 0) void poll();
    }
    void poll();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [url, intervalSeconds, revision]);
  return { data, loading, error };
}
