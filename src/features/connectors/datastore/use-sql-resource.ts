'use client';
import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend';
import type { SqlHistoryPage, SqlHistorySearch } from '@fouc/shared';
import { useLocale } from '@/lib/i18n';
import { uiFailure, uiText, type UiMessage } from '../i18n/ui-message';

/** Request identity keeps stale results visible without allowing them to win a newer request. */
export function useSqlResource<T>(url: string | null, body: unknown, revision: number) {
  const locale = useLocale();
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const key = JSON.stringify([url, payload, revision]);
  const [state, setState] = useState<{ key: string; data: T | null; error: UiMessage }>({
    key: '',
    data: null,
    error: '',
  });
  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    void backendFetch<T>(url, {
      ...(payload === undefined ? {} : { method: 'POST', body: payload }),
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: '' });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setState((previous) => ({ key, data: previous.data, error: uiFailure(reason) }));
      });
    return () => controller.abort();
  }, [url, payload, key]);
  return {
    data: url === null ? null : state.data,
    error: url !== null && state.key === key ? uiText(state.error, locale) : '',
    busy: url !== null && state.key !== key,
  };
}

export function useSqlHistory(url: string, request: Partial<SqlHistorySearch>, revision: number) {
  const locale = useLocale();
  const payload = JSON.stringify(request),
    key = JSON.stringify([url, payload, revision]);
  const group = JSON.stringify([url, { ...request, cursor: null }, revision]),
    append = Boolean(request.cursor);
  const [state, setState] = useState<{
    key: string;
    group: string;
    data: SqlHistoryPage | null;
    error: UiMessage;
  }>({ key: '', group: '', data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<SqlHistoryPage>(url, {
      method: 'POST',
      body: payload,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            key,
            group,
            error: '',
            data: {
              ...data,
              entries:
                append && previous.group === group
                  ? [
                      ...new Map(
                        [...(previous.data?.entries ?? []), ...data.entries].map((entry) => [
                          entry.id,
                          entry,
                        ]),
                      ).values(),
                    ]
                  : data.entries,
            },
          }));
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setState((previous) => ({ ...previous, key, error: uiFailure(reason) }));
      });
    return () => controller.abort();
  }, [url, payload, key, group, append]);
  return {
    data: state.data,
    error: state.key === key ? uiText(state.error, locale) : '',
    busy: state.key !== key,
  };
}
