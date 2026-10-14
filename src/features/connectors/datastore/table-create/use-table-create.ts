'use client';

import { uiText, type UiMessage, uiFailure } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-table-create.messages';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TableCreateCommitResult,
  TableCreateInput,
  TableCreateOptions,
  TableCreatePrepared,
} from '@fouc/shared/table-create';
import { backendFetch, BackendRequestError } from '@/lib/backend';
export function useTableCreate(
  base: string,
  onCreated: () => void,
  onBusyChange: (busy: boolean) => void,
) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const endpoint = `${base}/table-create`;
  const [options, setOptions] = useState<TableCreateOptions | null>(null);
  const [prepared, setPrepared] = useState<TableCreatePrepared | null>(null);
  const [result, setResult] = useState<TableCreateCommitResult | null>(null);
  const [busy, setBusy] = useState<'loading' | 'preview' | 'commit' | null>('loading');
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const live = useRef(true),
    held = useRef<TableCreatePrepared | null>(null),
    request = useRef<AbortController | null>(null);
  const callbacks = useRef({ onCreated, onBusyChange });
  useEffect(() => {
    callbacks.current = { onCreated, onBusyChange };
  }, [onCreated, onBusyChange]);
  const discard = useCallback(
    (id: string) =>
      backendFetch(`${endpoint}/plans/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
        () => undefined,
      ),
    [endpoint],
  );
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy('loading');
    setError('');
    try {
      const value = await backendFetch<TableCreateOptions>(`${endpoint}/options`, {
        signal: controller.signal,
      });
      if (live.current && !controller.signal.aborted) setOptions(value);
    } catch (reason) {
      if (live.current && !controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (live.current && !controller.signal.aborted) setBusy(null);
    }
  }, [endpoint]);
  useEffect(() => {
    live.current = true;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      live.current = false;
      request.current?.abort();
      const current = held.current;
      held.current = null;
      if (current) void discard(current.planId);
      callbacks.current.onBusyChange(false);
    };
  }, [discard, load]);
  async function preview(input: TableCreateInput) {
    if (busy) return;
    setBusy('preview');
    setError('');
    setResult(null);
    const old = held.current;
    held.current = null;
    setPrepared(null);
    if (old) await discard(old.planId);
    const controller = new AbortController();
    request.current = controller;
    try {
      const value = await backendFetch<TableCreatePrepared>(`${endpoint}/plans`, {
        method: 'POST',
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!live.current || controller.signal.aborted) {
        await discard(value.planId);
        return;
      }
      held.current = value;
      setPrepared(value);
    } catch (reason) {
      if (live.current && !controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (live.current && !controller.signal.aborted) setBusy(null);
    }
  }
  async function edit() {
    const current = held.current;
    held.current = null;
    setPrepared(null);
    setResult(null);
    setError('');
    if (current) await discard(current.planId);
  }
  async function commit() {
    const current = held.current;
    if (!current || busy || current.expiresAt <= Date.now()) return;
    held.current = null;
    setBusy('commit');
    setError('');
    callbacks.current.onBusyChange(true);
    try {
      const value = await backendFetch<TableCreateCommitResult>(
        `${endpoint}/plans/${encodeURIComponent(current.planId)}/commit`,
        { method: 'POST', body: JSON.stringify({ confirm: true }) },
      );
      if (!live.current) return;
      setResult(value);
      if (value.outcome === 'created' || value.outcome === 'unknown') callbacks.current.onCreated();
    } catch (reason) {
      if (!live.current) return;
      const rejected =
        reason instanceof BackendRequestError && reason.status >= 400 && reason.status < 500;
      setResult({
        outcome: rejected ? 'rejected' : 'unknown',
        schema: current.review.schema,
        table: current.review.table,
        sql: current.review.sql,
        executionTimeMs: 0,
        message: `${rejected ? '' : tConnector('tableCreationResponseUnconfirmedRefreshTheCatalogToVerify')}${reason instanceof Error ? uiText(reason, locale) : String(reason)}`,
      });
      if (!rejected) callbacks.current.onCreated();
    } finally {
      callbacks.current.onBusyChange(false);
      if (live.current) setBusy(null);
    }
  }
  return { options, prepared, result, busy, error, load, preview, edit, commit };
}
