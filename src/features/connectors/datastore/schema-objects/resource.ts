import { uiText, uiFailure, type UiMessage } from '../../i18n/ui-message';
import { useLocale } from '@/lib/i18n';

import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend';
export function useSchemaObjectResource<T>(url: string | null, body: string, revision: number) {
  const locale = useLocale();
  const key = `${url}:${body}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: UiMessage;
  }>({ key: '', data: null, error: '' });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void backendFetch<T>(url, { method: 'POST', body, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: '' });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            data: null,
            error: uiFailure(error),
          });
      });
    return () => controller.abort();
  }, [url, body, revision, key]);
  return state.key === key
    ? { data: state.data, error: uiText(state.error, locale), loading: false }
    : { data: null, error: '', loading: url !== null };
}
