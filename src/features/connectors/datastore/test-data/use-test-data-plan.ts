'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-test-data-plan.messages';
import { useEffect, useRef, useState } from 'react';
import type { RelationalTableStructure } from '@fouc/shared';
import type { TableImportAppendSummary, TableImportPlan } from '@fouc/shared/table-import';
import { buildTestDataImport, type TestDataConfig } from '@fouc/shared/test-data';
import { backendFetch } from '@/lib/backend';
const connectorUiMessages = createUiMessages(connectorMessages);
export function useTestDataPlan({
  base,
  structure,
  writable,
  onBusyChange,
  onImported,
}: {
  base: string;
  structure: RelationalTableStructure;
  writable: boolean;
  onBusyChange: (value: boolean) => void;
  onImported: () => void;
}) {
  const { locale } = useTranslation(connectorMessages);
  const [plan, setPlan] = useState<TableImportPlan | null>(null);
  const [summary, setSummary] = useState<TableImportAppendSummary | null>(null);
  const [busy, setBusy] = useState<'generate' | 'preview' | 'commit' | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const token = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const callbacks = useRef({ onBusyChange, onImported });
  useEffect(() => {
    callbacks.current = { onBusyChange, onImported };
  }, [onBusyChange, onImported]);
  useEffect(
    () => () => {
      request.current?.abort();
      callbacks.current.onBusyChange(false);
      const current = token.current;
      if (current)
        void backendFetch(`${base}/table-import/plans/${encodeURIComponent(current)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
    },
    [base],
  );
  function discard() {
    const current = token.current;
    token.current = null;
    setPlan(null);
    if (current)
      void backendFetch(`${base}/table-import/plans/${encodeURIComponent(current)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
  }
  function back() {
    discard();
    setSummary(null);
    setError('');
  }
  async function prepare(config: TestDataConfig) {
    if (request.current || !writable) return;
    discard();
    const controller = new AbortController();
    request.current = controller;
    setBusy('generate');
    setProgress(0);
    setError('');
    callbacks.current.onBusyChange(true);
    try {
      const generated = await buildTestDataImport(structure, config, {
        signal: controller.signal,
        onProgress: (rows) => {
          if (!controller.signal.aborted) setProgress(rows);
        },
      });
      if (controller.signal.aborted) return;
      setBusy('preview');
      const response = await backendFetch<TableImportPlan>(`${base}/table-import/plans`, {
        method: 'POST',
        body: JSON.stringify(generated.input),
        signal: controller.signal,
      });
      if (request.current !== controller || controller.signal.aborted) {
        void backendFetch(`${base}/table-import/plans/${encodeURIComponent(response.planId)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
        return;
      }
      token.current = response.planId;
      if (!response.review.validation.valid) {
        discard();
        throw new Error(
          response.review.validation.errors
            .map(
              (issue) =>
                `${issue.targetColumn ? issue.targetColumn + '：' : ''}${uiText(issue, locale)}`,
            )
            .join('\n'),
        );
      }
      setPlan(response);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
        callbacks.current.onBusyChange(false);
      }
    }
  }
  async function append(confirmed: boolean) {
    if (!confirmed || !writable || !plan || request.current) return;
    const controller = new AbortController();
    const planId = plan.planId;
    request.current = controller;
    setBusy('commit');
    setError('');
    callbacks.current.onBusyChange(true);
    try {
      const result = await backendFetch<TableImportAppendSummary>(
        `${base}/table-import/plans/${encodeURIComponent(planId)}/commit`,
        {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted || request.current !== controller) return;
      token.current = null;
      setPlan(null);
      setSummary(result);
      callbacks.current.onImported();
    } catch (reason) {
      if (!controller.signal.aborted) {
        discard();
        setError(
          connectorUiMessages.message('failureWithExpiredPlan', { reason: uiFailure(reason) }),
        );
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
        callbacks.current.onBusyChange(false);
      }
    }
  }
  function cancel() {
    const committing = busy === 'commit';
    request.current?.abort();
    request.current = null;
    discard();
    setBusy(null);
    callbacks.current.onBusyChange(false);
    setError(
      committing
        ? connectorUiMessages.message(
            'requestCancelledNoCommitOutcomeReceivedRefreshTheTargetTable',
          )
        : connectorUiMessages.message('generationReviewCancelledAppendCommitWasNotInitiated'),
    );
  }
  return { plan, summary, busy, progress, error, prepare, append, cancel, back };
}
