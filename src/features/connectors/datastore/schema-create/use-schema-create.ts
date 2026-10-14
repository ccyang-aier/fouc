'use client';

import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-schema-create.messages';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SchemaCreateCommitResult,
  SchemaCreateInput,
  SchemaCreateOptions,
  SchemaCreatePrepared,
} from '@fouc/shared/schema-create';
import { backendFetch, BackendRequestError } from '@/lib/backend';
const connectorUiMessages = createUiMessages(connectorMessages);
type StoredResult = Omit<SchemaCreateCommitResult, 'message'> & { message: UiMessage };
export function useSchemaCreate(
  base: string,
  onCreated: (name: string) => void,
  onBusyChange: (busy: boolean) => void,
) {
  const { locale } = useTranslation(connectorMessages);
  const endpoint = `${base}/schema-create`;
  const [options, setOptions] = useState<SchemaCreateOptions | null>(null);
  const [prepared, setPrepared] = useState<SchemaCreatePrepared | null>(null);
  const [storedResult, setResult] = useState<StoredResult | null>(null);
  const result = storedResult && { ...storedResult, message: uiText(storedResult.message, locale) };
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [busy, setBusy] = useState<'options' | 'preview' | 'commit' | null>('options');
  const live = useRef(true);
  const request = useRef<AbortController | null>(null);
  const held = useRef<SchemaCreatePrepared | null>(null);
  const busyCallback = useRef(onBusyChange);
  const createdCallback = useRef(onCreated);
  useEffect(() => {
    busyCallback.current = onBusyChange;
    createdCallback.current = onCreated;
  }, [onBusyChange, onCreated]);
  const discard = useCallback(
    async (id: string) => {
      await backendFetch(`${endpoint}/plans/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
        () => undefined,
      );
    },
    [endpoint],
  );
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy('options');
    setError('');
    try {
      const value = await backendFetch<SchemaCreateOptions>(`${endpoint}/options`, {
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
      const plan = held.current;
      held.current = null;
      if (plan) void discard(plan.planId);
      busyCallback.current(false);
    };
  }, [load, discard]);
  async function preview(input: SchemaCreateInput) {
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
      const value = await backendFetch<SchemaCreatePrepared>(`${endpoint}/plans`, {
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
    const old = held.current;
    held.current = null;
    setPrepared(null);
    setResult(null);
    setError('');
    if (old) await discard(old.planId);
  }
  async function commit() {
    const plan = held.current;
    if (!plan || busy || plan.expiresAt <= Date.now()) return;
    held.current = null;
    setBusy('commit');
    setError('');
    busyCallback.current(true);
    // Closing is disabled during submission. A lost response never permits replay of this token.
    try {
      const value = await backendFetch<SchemaCreateCommitResult>(
        `${endpoint}/plans/${encodeURIComponent(plan.planId)}/commit`,
        { method: 'POST', body: JSON.stringify({ confirm: true }) },
      );
      if (!live.current) return;
      setResult(value);
      if (value.outcome === 'created' || value.outcome === 'unknown')
        createdCallback.current(value.name);
    } catch (reason) {
      if (!live.current) return;
      if (reason instanceof BackendRequestError && reason.status >= 400 && reason.status < 500) {
        setResult({
          outcome: 'rejected',
          name: plan.review.name,
          target: plan.review.target,
          sql: plan.review.sql,
          executionTimeMs: 0,
          message: uiFailure(reason),
        });
      } else {
        setResult({
          outcome: 'unknown',
          name: plan.review.name,
          target: plan.review.target,
          sql: plan.review.sql,
          executionTimeMs: 0,
          message: connectorUiMessages.message(
            'theCommitResponseIsUnconfirmedRefreshTheCatalogToVerify',
            {
              p0: uiFailure(reason),
            },
          ),
        });
        createdCallback.current(plan.review.name);
      }
    } finally {
      busyCallback.current(false);
      if (live.current) setBusy(null);
    }
  }
  return { options, prepared, result, error, busy, load, preview, edit, commit };
}
