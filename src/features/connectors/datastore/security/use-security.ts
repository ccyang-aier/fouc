'use client';
import { uiText, uiFailure, type UiMessage } from '../../i18n/ui-message';
import { useLocale } from '@/lib/i18n';

import { useCallback, useEffect, useState } from 'react';
import type {
  DatabaseSecurityDetail,
  DatabaseSecurityDirectory,
} from '@fouc/shared/database-security';
import { backendFetch } from '@/lib/backend';
export function useDatabaseSecurity(base: string, schema: string) {
  const locale = useLocale();
  const [directoryState, setDirectory] = useState<{
    key: string;
    data: DatabaseSecurityDirectory | null;
    error: UiMessage;
  } | null>(null);
  const [detailState, setDetail] = useState<{
    key: string;
    data: DatabaseSecurityDetail | null;
    error: UiMessage;
  } | null>(null);
  const [selected, setPrincipalId] = useState('');
  const [revision, setRevision] = useState(0);
  const directoryKey = JSON.stringify([base, revision]);
  const busy = directoryState?.key !== directoryKey;
  const directory = busy ? null : (directoryState?.data ?? null);
  const error = busy ? '' : uiText(directoryState?.error ?? '', locale);
  const principalId = directory?.principals.some((item) => item.id === selected)
    ? selected
    : (directory?.principals.find(
        (item) =>
          directory.identity.current ===
          (item.host === null ? item.name : `${item.name}@${item.host}`),
      )?.id ??
      directory?.principals[0]?.id ??
      '');
  const detailKey = JSON.stringify([directoryKey, principalId, schema]);
  const detailBusy = Boolean(principalId) && detailState?.key !== detailKey;
  const detail = detailBusy ? null : (detailState?.data ?? null);
  const detailError = detailBusy ? '' : uiText(detailState?.error ?? '', locale);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<DatabaseSecurityDirectory>(`${base}/security/directory`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setDirectory({ key: directoryKey, data: value, error: '' });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setDirectory({
            key: directoryKey,
            data: null,
            error: uiFailure(reason),
          });
      });
    return () => controller.abort();
  }, [base, directoryKey]);
  useEffect(() => {
    if (!directory || busy || !principalId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ principalId, ...(schema ? { schema } : {}) });
    void backendFetch<DatabaseSecurityDetail>(`${base}/security/detail?${query}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setDetail({ key: detailKey, data: value, error: '' });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setDetail({
            key: detailKey,
            data: null,
            error: uiFailure(reason),
          });
      });
    return () => controller.abort();
  }, [base, principalId, schema, directory, busy, detailKey]);
  const refresh = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);
  return {
    directory,
    detail,
    principalId,
    setPrincipalId,
    busy,
    detailBusy,
    error,
    detailError,
    refresh,
  };
}
