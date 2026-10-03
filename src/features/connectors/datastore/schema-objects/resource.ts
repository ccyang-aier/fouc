import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend';
export function useSchemaObjectResource<T>(url: string | null, body: string, revision: number) {
  const key = `${url}:${body}:${revision}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key: '', data: null, error: '' });
  useEffect(() => {
    if (!url) return; const controller = new AbortController();
    void backendFetch<T>(url, { method: 'POST', body, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ key, data, error: '' }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : String(error) }); });
    return () => controller.abort();
  }, [url, body, revision, key]);
  return state.key === key ? { data: state.data, error: state.error, loading: false } : { data: null, error: '', loading: url !== null };
}
