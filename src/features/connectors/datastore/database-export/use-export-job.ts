'use client';
import { uiText, type UiMessage, uiFailure } from '../../i18n/ui-message';
import { useLocale } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DatabaseExportInput, DatabaseExportProgress } from '@fouc/shared/database-export';
import { backendFetch } from '@/lib/backend';
export function databaseExportActive(progress: DatabaseExportProgress | null): boolean {
  return Boolean(progress && ['preparing', 'running', 'finalizing'].includes(progress.status));
}
export function useDatabaseExportJob(base: string) {
  const locale = useLocale();
  const [progress, setProgress] = useState<DatabaseExportProgress | null>(null);
  const [errorStored, setError] = useState<UiMessage | null>(null);
  const error = errorStored === null ? null : uiText(errorStored, locale);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recent, setRecent] = useState<DatabaseExportProgress[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const current = useRef<DatabaseExportProgress | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const url = `${base}/database-export/jobs`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, [url]);
  const update = useCallback((value: DatabaseExportProgress) => {
    current.current = value;
    if (mounted.current) {
      setProgress(value);
      setRecent((previous) => [value, ...previous.filter((job) => job.id !== value.id)]);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<DatabaseExportProgress[]>(url, { signal: controller.signal })
      .then((jobs) => {
        if (controller.signal.aborted) return;
        setRecent(jobs);
        if (jobs.length && !current.current) {
          current.current = jobs[0];
          setProgress(jobs[0]);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? uiFailure(error) : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRecent(false);
      });
    return () => controller.abort();
  }, [url]);
  useEffect(() => {
    if (!databaseExportActive(progress)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await backendFetch<DatabaseExportProgress>(
          `${url}/${encodeURIComponent(progress!.id)}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        update(value);
        setError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? uiFailure(error) : String(error));
        timer = setTimeout(() => void poll(), 1500);
      }
    };
    timer = setTimeout(() => void poll(), 650);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [progress, update, url]);
  const discard = useCallback(async () => {
    request.current?.abort();
    const job = current.current;
    if (job) await backendFetch(`${url}/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
    current.current = null;
    if (mounted.current) {
      setProgress(null);
      setError(null);
      if (job) setRecent((previous) => previous.filter((item) => item.id !== job.id));
    }
  }, [url]);
  const start = useCallback(
    async (input: DatabaseExportInput) => {
      setError(null);
      setStarting(true);
      try {
        const controller = new AbortController();
        request.current = controller;
        const job = await backendFetch<DatabaseExportProgress>(url, {
          method: 'POST',
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!mounted.current) {
          await backendFetch(`${url}/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
          return;
        }
        update(job);
      } catch (error) {
        if (mounted.current && !(error instanceof DOMException && error.name === 'AbortError'))
          setError(error instanceof Error ? uiFailure(error) : String(error));
      } finally {
        if (mounted.current) setStarting(false);
      }
    },
    [update, url],
  );
  const cancel = useCallback(async () => {
    const job = current.current;
    if (!job || !databaseExportActive(job)) return;
    setCancelling(true);
    try {
      update(
        await backendFetch<DatabaseExportProgress>(`${url}/${encodeURIComponent(job.id)}/cancel`, {
          method: 'POST',
        }),
      );
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? uiFailure(error) : String(error));
    } finally {
      if (mounted.current) setCancelling(false);
    }
  }, [update, url]);
  const select = useCallback(
    (id: string | null) => {
      const job = recent.find((item) => item.id === id) ?? null;
      current.current = job;
      setProgress(job);
      setError(null);
    },
    [recent],
  );
  return {
    progress,
    recent,
    loadingRecent,
    select,
    error,
    starting,
    cancelling,
    start,
    cancel,
    discard,
    artifactUrl: progress ? `${url}/${encodeURIComponent(progress.id)}/artifact` : null,
  };
}
