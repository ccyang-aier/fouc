'use client';
import { backendFetch } from '@/lib/backend';
import { useEffect, useState } from 'react';
import { uiFailure, type UiMessage } from '../i18n/ui-message';

/** POST only carries binary identifiers; these Stream endpoints perform reads. */
export function useRedisStreamRead<T>(
  url: string,
  body: string,
  revision: number,
  onResult: (result: T) => void,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UiMessage>('');
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      setLoading(true);
      try {
        const result = await backendFetch<T>(url, {
          method: 'POST',
          body,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
          onResult(result);
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(uiFailure(reason));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void read();
    return () => controller.abort();
  }, [url, body, revision, onResult]);
  return { data, loading, error };
}
