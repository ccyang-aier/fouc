import { useEffect, useRef, useState } from 'react';
import { backendFetch } from '@/lib/backend';

export type MongoResource<T> = { data: T | null; loading: boolean; error: string };
/** A request belongs to its exact URL and body; stale completions cannot enter a new namespace. */
export function useMongoResource<T>(url: string | null, body?: string, revision = 0): MongoResource<T> & { cancel: () => void } {
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ key: string; value: MongoResource<T> }>({ key: '', value: { data: null, loading: true, error: '' } });
  const key = `${url ?? ''}:${body ?? ''}:${revision}`;
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController(); active.current = controller;
    void backendFetch<T>(url, { method: body === undefined ? 'GET' : 'POST', body, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ key, value: { data, loading: false, error: '' } }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, value: { data: null, loading: false, error: error instanceof Error ? error.message : String(error) } }); });
    return () => { controller.abort(); if (active.current === controller) active.current = null; };
  }, [url, body, revision, key]);
  const cancel = () => { active.current?.abort(); setState({ key, value: { data: null, loading: false, error: '查询已取消。' } }); };
  if (!url) return { data: null, loading: false, error: '', cancel };
  return { ...(state.key === key ? state.value : { data: null, loading: true, error: '' }), cancel };
}
