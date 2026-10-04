"use client";

import { useEffect, useRef, useState } from "react";
import { backendFetch } from "@/lib/backend";
import {
  SQLITE_BACKUP_LIMITS,
  sqliteBackupInputSchema,
  type SqliteBackupJob,
} from "@fouc/shared/sqlite-backup";
import { downloadDatabaseExport } from "../database-export/download";

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Native job state survives transport errors; closing waits for confirmed cleanup. */
export function useSqliteBackup(
  base: string,
  sourceName: string,
  onClosed: () => void,
) {
  const endpoint = `${base}/sqlite-backups`;
  const [job, setJob] = useState<SqliteBackupJob | null>(null);
  const latest = useRef<SqliteBackupJob | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [received, setReceived] = useState(0);
  const [saved, setSaved] = useState<"disk" | "browser" | null>(null);
  const download = useRef<AbortController | null>(null);
  const jobId = job?.id,
    jobStatus = job?.status;
  function remember(value: SqliteBackupJob | null) {
    latest.current = value;
    setJob(value);
  }

  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<SqliteBackupJob[]>(endpoint, {
      signal: controller.signal,
    })
      .then((jobs) => {
        if (!controller.signal.aborted && jobs[0]) {
          latest.current = jobs[0];
          setJob(jobs[0]);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      download.current?.abort();
      if (latest.current)
        void backendFetch(`${endpoint}/${latest.current.id}`, {
          method: "DELETE",
        }).catch(() => undefined);
    };
  }, [endpoint]);

  useEffect(() => {
    if (!jobId || !jobStatus || !["running", "cancelling"].includes(jobStatus))
      return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await backendFetch<SqliteBackupJob>(
          `${endpoint}/${jobId}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          latest.current = value;
          setJob(value);
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(`状态读取失败，设备任务尚未确认结束：${message(reason)}`);
      } finally {
        if (!controller.signal.aborted)
          timer = setTimeout(() => void poll(), 400);
      }
    }
    timer = setTimeout(() => void poll(), 100);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [endpoint, jobId, jobStatus]);

  async function start(filename: string) {
    const parsed = sqliteBackupInputSchema.safeParse({ filename });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "备份文件名无效");
      return;
    }
    setStarting(true);
    setError("");
    setSaved(null);
    setReceived(0);
    const startedAt = Date.now();
    try {
      if (latest.current) {
        await backendFetch(`${endpoint}/${latest.current.id}`, {
          method: "DELETE",
        });
        remember(null);
      }
      remember(
        await backendFetch<SqliteBackupJob>(endpoint, {
          method: "POST",
          body: JSON.stringify(parsed.data),
        }),
      );
    } catch (reason) {
      setError(`创建请求未完成：${message(reason)}`);
      // A lost POST response must not cause an automatic second backup.
      const jobs = await backendFetch<SqliteBackupJob[]>(endpoint).catch(
        () => [],
      );
      const recovered = jobs.find(
        (value) =>
          value.filename === parsed.data.filename &&
          value.startedAt >= startedAt - 1000,
      );
      if (recovered) remember(recovered);
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!latest.current) return;
    setCancelling(true);
    setError("");
    try {
      remember(
        await backendFetch<SqliteBackupJob>(
          `${endpoint}/${latest.current.id}/cancel`,
          { method: "POST" },
        ),
      );
    } catch (reason) {
      setError(`取消尚未确认：${message(reason)}`);
    } finally {
      setCancelling(false);
    }
  }

  async function save() {
    const current = latest.current;
    if (!current || current.status !== "ready" || current.bytes === null)
      return;
    const controller = new AbortController();
    download.current = controller;
    setDownloading(true);
    setError("");
    setReceived(0);
    setSaved(null);
    try {
      setSaved(
        await downloadDatabaseExport(
          `${endpoint}/${current.id}/artifact`,
          current.filename,
          current.bytes,
          controller.signal,
          setReceived,
          {
            forbiddenFilename: sourceName,
            browserBytes: SQLITE_BACKUP_LIMITS.browserBytes,
          },
        ),
      );
    } catch (reason) {
      if (controller.signal.aborted)
        setError("下载已取消；设备快照仍保留，可重新下载。");
      else if (reason instanceof DOMException && reason.name === "AbortError")
        setError("已取消文件选择；设备快照仍保留。");
      else setError(message(reason));
    } finally {
      setDownloading(false);
      download.current = null;
    }
  }

  async function close() {
    setClosing(true);
    setError("");
    download.current?.abort();
    try {
      if (latest.current) {
        await backendFetch(`${endpoint}/${latest.current.id}`, {
          method: "DELETE",
        });
        remember(null);
      }
      onClosed();
    } catch (reason) {
      setError(`停止与清理尚未确认，请重试关闭：${message(reason)}`);
    } finally {
      setClosing(false);
    }
  }

  return {
    job,
    error,
    loading,
    starting,
    closing,
    cancelling,
    downloading,
    received,
    saved,
    start,
    cancel,
    save,
    close,
    cancelDownload: () => download.current?.abort(),
  };
}
