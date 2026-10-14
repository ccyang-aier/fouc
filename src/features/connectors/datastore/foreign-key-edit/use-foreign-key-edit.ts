'use client';

import { uiText, uiFailure, type UiMessage, createUiMessages } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-foreign-key-edit.messages';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FOREIGN_KEY_ACTIONS,
  FOREIGN_KEY_EDIT_LIMITS,
  type ForeignKeyEditOptions,
  type ForeignKeyTarget,
  type ForeignKeyEditInput,
  type ForeignKeyEditPrepared,
  type ForeignKeyEditCommitResult,
} from '@fouc/shared/foreign-key-edit';
import { backendFetch } from '@/lib/backend';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface ForeignKeyEditContext {
  base: string;
  schema: string;
  table: string;
  writable: boolean;
  onUnlock: () => Promise<void>;
  onChanged: () => void;
  onBusyChange?: (busy: boolean) => void;
}
const explain = uiFailure;
type StoredResult = Omit<ForeignKeyEditCommitResult, 'message'> & { message: UiMessage };
/** Owns scoped native catalog requests and the single-use review lifecycle. */
export function useForeignKeyEdit({
  base,
  schema,
  table,
  writable,
  onUnlock,
  onChanged,
  onBusyChange,
}: ForeignKeyEditContext) {
  const { locale } = useTranslation(connectorMessages);
  const endpoint = `${base}/foreign-key-edit`;
  const [options, setOptions] = useState<ForeignKeyEditOptions | null>(null);
  const [retry, setRetry] = useState(0);
  const [referenceSchema, setReferenceSchema] = useState(schema),
    [referenceTable, setReferenceTable] = useState('');
  const [targetState, setTargetState] = useState<{
    schema: string;
    table: string;
    data: ForeignKeyTarget | null;
    error: UiMessage;
  } | null>(null);
  const target =
    targetState?.schema === referenceSchema && targetState.table === referenceTable
      ? targetState.data
      : null;
  const targetError =
    targetState?.schema === referenceSchema && targetState.table === referenceTable
      ? uiText(targetState.error, locale)
      : '';
  const [referenceKey, setReferenceKey] = useState(''),
    [locals, setLocals] = useState<string[]>([]);
  const [kind, setKind] = useState<'create' | 'drop'>('create');
  const [name, setName] = useState(`fk_${table}`.slice(0, 55)),
    [dropName, setDropName] = useState('');
  const [onDelete, setOnDelete] = useState<(typeof FOREIGN_KEY_ACTIONS)[number]>('NO ACTION');
  const [onUpdate, setOnUpdate] = useState<(typeof FOREIGN_KEY_ACTIONS)[number]>('NO ACTION');
  const [prepared, setPrepared] = useState<ForeignKeyEditPrepared | null>(null);
  const latestPlan = useRef<string | null>(null);
  const [storedResult, setResult] = useState<StoredResult | null>(null);
  const result = useMemo(
    () => storedResult && { ...storedResult, message: uiText(storedResult.message, locale) },
    [storedResult, locale],
  );
  const [busy, setBusy] = useState<'prepare' | 'commit' | 'unlock' | 'edit' | null>(null);
  const [errorStored, setError] = useState<UiMessage>(''),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const notice = uiText(noticeStored, locale);
  const [confirmed, setConfirmed] = useState(false),
    [clock, setClock] = useState(0);
  const preview = useRef<AbortController | null>(null);
  const selectedKey = target?.keys.find((key) => key.name === referenceKey);
  const remaining = prepared ? Math.max(0, Math.ceil((prepared.expiresAt - clock) / 1000)) : 0;
  const input: ForeignKeyEditInput =
    kind === 'drop'
      ? { kind, name: dropName }
      : {
          kind,
          name,
          referencedSchema: referenceSchema,
          referencedTable: referenceTable,
          columns: (selectedKey?.columns ?? []).map((referenced, index) => ({
            referenced,
            local: locals[index] ?? '',
          })),
          onDelete,
          onUpdate,
        };
  const valid =
    kind === 'drop'
      ? Boolean(options?.foreignKeys.some((key) => key.name === dropName))
      : Boolean(
          name.trim() &&
          selectedKey &&
          locals.length === selectedKey.columns.length &&
          locals.every(Boolean) &&
          new Set(locals).size === locals.length,
        );
  const locked = busy === 'commit' || busy === 'unlock';
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<ForeignKeyEditOptions>(
      `${endpoint}/options?${new URLSearchParams({ schema, table })}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setOptions(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(explain(reason));
      });
    return () => {
      controller.abort();
      preview.current?.abort();
      if (latestPlan.current)
        void backendFetch(`${endpoint}/plans/${latestPlan.current}`, {
          method: 'DELETE',
        }).catch(() => undefined);
    };
  }, [endpoint, schema, table, retry]);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<ForeignKeyTarget>(
      `${endpoint}/target?${new URLSearchParams({ schema: referenceSchema, table: referenceTable })}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted)
          setTargetState({
            schema: referenceSchema,
            table: referenceTable,
            data,
            error: '',
          });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setTargetState({
            schema: referenceSchema,
            table: referenceTable,
            data: null,
            error: explain(reason),
          });
      });
    return () => controller.abort();
  }, [endpoint, referenceSchema, referenceTable, retry]);
  useEffect(() => {
    if (!prepared || result) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [prepared, result]);
  async function prepare() {
    const controller = new AbortController();
    preview.current = controller;
    setBusy('prepare');
    setError('');
    setNotice('');
    setConfirmed(false);
    try {
      const value = await backendFetch<ForeignKeyEditPrepared>(`${endpoint}/plans`, {
        method: 'POST',
        body: JSON.stringify({ schema, table, input }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        latestPlan.current = value.planId;
        setPrepared(value);
        setClock(value.expiresAt - FOREIGN_KEY_EDIT_LIMITS.lifetimeMs);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(explain(reason));
    } finally {
      setBusy(null);
      preview.current = null;
    }
  }
  async function edit() {
    setBusy('edit');
    setError('');
    try {
      if (latestPlan.current)
        await backendFetch(`${endpoint}/plans/${latestPlan.current}`, {
          method: 'DELETE',
        });
      latestPlan.current = null;
      setPrepared(null);
      setResult(null);
      setConfirmed(false);
    } catch (reason) {
      setError(explain(reason));
    } finally {
      setBusy(null);
    }
  }
  async function unlock() {
    setBusy('unlock');
    setError('');
    try {
      await onUnlock();
    } catch (reason) {
      setError(explain(reason));
    } finally {
      setBusy(null);
    }
  }
  async function commit() {
    if (!prepared || !writable || !confirmed || !remaining) return;
    setBusy('commit');
    setError('');
    onBusyChange?.(true);
    try {
      const value = await backendFetch<ForeignKeyEditCommitResult>(
        `${endpoint}/plans/${prepared.planId}/commit`,
        { method: 'POST', body: JSON.stringify({ confirm: true }) },
      );
      latestPlan.current = null;
      setResult(value);
      if (value.outcome !== 'rejected') onChanged();
    } catch (reason) {
      latestPlan.current = null;
      setResult({
        outcome: 'unknown',
        message: connectorUiMessages.message(
          'theCommitResultIsUnconfirmedRefreshTheNativeForeignKey',
          {
            p0: uiFailure(reason),
          },
        ),
        schema,
        table,
        sql: prepared.review.sql,
        executionTimeMs: 0,
      });
      onChanged();
    } finally {
      setBusy(null);
      onBusyChange?.(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(prepared!.review.sql);
      setNotice(connectorUiMessages.message('completeForeignKeyDdlCopied'));
    } catch {
      setNotice(
        connectorUiMessages.message('clipboardWriteUnavailableCopyManuallyFromTheSqlPreview'),
      );
    }
  }
  function resetReference(nextSchema: string, nextTable: string) {
    setReferenceSchema(nextSchema);
    setReferenceTable(nextTable);
    setReferenceKey('');
    setLocals([]);
  }
  const dropped = options?.foreignKeys.find((key) => key.name === dropName);
  function retryOptions() {
    setError('');
    setRetry((value) => value + 1);
  }
  return {
    options,
    target,
    targetError,
    referenceSchema,
    referenceTable,
    referenceKey,
    setReferenceKey,
    locals,
    setLocals,
    selectedKey,
    kind,
    setKind,
    name,
    setName,
    dropName,
    setDropName,
    onDelete,
    setOnDelete,
    onUpdate,
    setOnUpdate,
    prepared,
    result,
    busy,
    error,
    notice,
    confirmed,
    setConfirmed,
    remaining,
    locked,
    valid,
    dropped,
    prepare,
    edit,
    unlock,
    commit,
    copy,
    resetReference,
    retryOptions,
  };
}
export type ForeignKeyEditModel = ReturnType<typeof useForeignKeyEdit>;
