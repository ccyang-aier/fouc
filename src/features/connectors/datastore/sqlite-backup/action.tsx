"use client";

import { useState } from "react";
import {
  Archive,
  CheckCircle,
  CircleNotch,
  Database,
  DownloadSimple,
  Stop,
  WarningCircle,
} from "@phosphor-icons/react";
import type { RelationalSession } from "@fouc/shared";
import { SqlDialog } from "../sql-library-dialog";
import { useSqliteBackup } from "./use-sqlite-backup";
import styles from "./sqlite-backup.module.css";

function bytes(value: number): string {
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(2)} MiB`
    : `${(value / 1024).toFixed(1)} KiB`;
}

function SqliteBackupDialog({
  session,
  base,
  onClose,
}: {
  session: RelationalSession;
  base: string;
  onClose: () => void;
}) {
  const sourceName =
    session.database.split(/[\\/]/).at(-1) ?? "database.sqlite";
  const [filename, setFilename] = useState(
    `${sourceName.replace(/\.(?:db|sqlite|sqlite3)$/i, "")}-${new Date().toISOString().slice(0, 10)}.sqlite`,
  );
  const state = useSqliteBackup(base, sourceName, onClose);
  const active =
    state.job?.status === "running" || state.job?.status === "cancelling";
  const locked =
    state.loading || state.starting || state.closing || state.downloading;
  const job = state.job;
  const complete = job?.status === "ready";
  const progress =
    job?.totalPages && job.remainingPages !== null
      ? Math.max(
          0,
          Math.min(
            100,
            ((job.totalPages - job.remainingPages) / job.totalPages) * 100,
          ),
        )
      : null;
  const labels = {
    running: "正在创建一致性快照",
    cancelling: "正在停止原生任务",
    cancelled: "备份已取消",
    failed: "备份未完成",
    ready: "完整快照可下载",
  };
  return (
    <SqlDialog
      title="SQLite 原生备份"
      className={styles.dialog}
      busy={state.starting || state.closing}
      onClose={() => void state.close()}
    >
      <div className={styles.body}>
        <div className={styles.intro}>
          <Database size={24} />
          <div>
            <strong>整个 SQLite 数据库，一份完整快照</strong>
            <span>包含已提交 WAL 内容 · 源数据库保持可用</span>
          </div>
        </div>
        <dl className={styles.source}>
          <div>
            <dt>当前连接</dt>
            <dd>
              {session.info.productName} · {sourceName}
            </dd>
          </div>
          <div>
            <dt>设备源文件</dt>
            <dd title={session.database}>
              <code>{session.database}</code>
            </dd>
          </div>
        </dl>
        <label className={styles.filename}>
          备份文件名称
          <input
            aria-label="SQLite 备份文件名称"
            value={filename}
            maxLength={120}
            disabled={locked || active}
            onChange={(event) => setFilename(event.target.value)}
          />
        </label>
        <p className={styles.hint}>
          设备只创建独立临时文件，通过 SQLite backup API 读取同一快照并运行
          quick_check，再经当前会话鉴权下载。保存时请选择与运行数据库不同的文件。
        </p>
        {state.loading && (
          <div className={styles.status} role="status">
            <CircleNotch size={17} className="mw-spin" />
            <span>读取当前会话备份任务…</span>
          </div>
        )}
        {job && (
          <section
            className={styles.job}
            data-status={job.status}
            aria-label="SQLite 备份任务"
          >
            <header>
              <span>
                {active ? (
                  <CircleNotch size={17} className="mw-spin" />
                ) : complete ? (
                  <CheckCircle size={17} />
                ) : (
                  <WarningCircle size={17} />
                )}
                <strong>{labels[job.status]}</strong>
              </span>
              <small>{new Date(job.startedAt).toLocaleTimeString()}</small>
            </header>
            {active && (
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="SQLite 备份进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? undefined}
              >
                <i style={{ width: `${progress ?? 7}%` }} />
              </div>
            )}
            <dl className={styles.metrics}>
              <div>
                <dt>页进度</dt>
                <dd>
                  {job.totalPages === null || job.remainingPages === null
                    ? "正在读取"
                    : `${(job.totalPages - job.remainingPages).toLocaleString()} / ${job.totalPages.toLocaleString()}`}
                </dd>
              </div>
              <div>
                <dt>快照大小</dt>
                <dd>{job.bytes === null ? "完成后确认" : bytes(job.bytes)}</dd>
              </div>
              <div>
                <dt>原生检查</dt>
                <dd>
                  {job.integrity === "verified"
                    ? "quick_check · 通过"
                    : "等待快照完成"}
                </dd>
              </div>
            </dl>
            {complete && (
              <p className={styles.hint}>
                临时快照保留至 {new Date(job.expiresAt).toLocaleTimeString()}
                。关闭面板、断开会话或过期会清理设备文件。
              </p>
            )}
            {job.error && (
              <p role="status" className={styles.hint}>
                {job.error}
              </p>
            )}
          </section>
        )}
        {state.downloading && (
          <div className={styles.download} role="status">
            <CircleNotch size={16} className="mw-spin" />
            <span>
              正在保存 {bytes(state.received)} /{" "}
              {job?.bytes ? bytes(job.bytes) : "…"}
            </span>
            <button type="button" onClick={state.cancelDownload}>
              取消下载
            </button>
          </div>
        )}
        {state.saved && (
          <p className={styles.success} role="status">
            <CheckCircle size={16} />
            {state.saved === "disk"
              ? "备份文件已完整写入所选位置。"
              : "完整备份已交给浏览器下载，请在下载列表确认保存位置。"}
          </p>
        )}
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <details className={styles.limits}>
          <summary>范围与保存方式</summary>
          <p>
            单个原生快照最多 256 MiB，设备快照总预算 512
            MiB，每会话最多两份临时任务。原生任务超过两分钟会停止。Chrome / Edge
            支持直接流式保存；其他浏览器内存下载最多 64 MiB。
          </p>
          <p>
            这份备份不包含其他附件数据库、外部文件或未提交事务。本入口只创建与下载快照；恢复运行库仍需独占目标及关闭全部同库会话。
          </p>
        </details>
      </div>
      <footer className={styles.footer}>
        <button
          type="button"
          disabled={state.starting || state.closing}
          onClick={() => void state.close()}
        >
          {state.closing ? "停止并清理中…" : "关闭并清理"}
        </button>
        <span />
        {active ? (
          <button
            type="button"
            className={styles.cancel}
            disabled={
              state.cancelling || state.closing || job?.status === "cancelling"
            }
            onClick={() => void state.cancel()}
          >
            <Stop size={14} />
            {job?.status === "cancelling" ? "停止中…" : "取消备份"}
          </button>
        ) : (
          <button
            type="button"
            disabled={locked || !filename.trim()}
            onClick={() => void state.start(filename)}
          >
            {state.starting ? "创建中…" : job ? "重新创建" : "创建原生备份"}
          </button>
        )}
        {complete && (
          <button
            type="button"
            className={styles.primary}
            disabled={locked}
            onClick={() => void state.save()}
          >
            <DownloadSimple size={14} />
            {state.downloading ? "保存中…" : "下载备份"}
          </button>
        )}
      </footer>
    </SqlDialog>
  );
}

export function SqliteBackupAction({
  session,
  base,
  disabled = false,
}: {
  session: RelationalSession;
  base: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (session.provider !== "sqlite") return null;
  return (
    <>
      <button
        type="button"
        aria-label="SQLite 原生备份"
        title="SQLite 原生备份 · WAL 一致性快照与文件下载"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Archive size={14} />
        <span>备份</span>
      </button>
      {open && (
        <SqliteBackupDialog
          key={session.id}
          session={session}
          base={base}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
