import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, mkdtemp, rm, rmdir } from "node:fs/promises";
import { addAbortSignal } from "node:stream";
import { finished } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RelationalSession } from "@fouc/shared";
import {
  SQLITE_BACKUP_LIMITS,
  sqliteBackupInputSchema,
  type SqliteBackupJob,
  type SqliteBackupScope,
} from "@fouc/shared/sqlite-backup";
import { DatabaseInputError } from "../input-error";
import { createSqliteSnapshot } from "./process";

interface Download {
  stream: ReadStream;
  closed: Promise<void>;
}
interface Entry {
  scope: SqliteBackupScope;
  session: RelationalSession;
  snapshot: SqliteBackupJob;
  controller: AbortController;
  budget: number;
  directory: string | null;
  done: Promise<void>;
  expiry: ReturnType<typeof setTimeout>;
  downloads: Set<Download>;
}

const sameScope = (left: SqliteBackupScope, right: SqliteBackupScope) =>
  left.workspaceId === right.workspaceId && left.sessionId === right.sessionId;
const publicJob = (entry: Entry): SqliteBackupJob => ({ ...entry.snapshot });
const sameSession = (left: RelationalSession, right: RelationalSession) =>
  left.id === right.id &&
  left.workspaceId === right.workspaceId &&
  left.provider === right.provider &&
  left.database === right.database;

/** Each live native session owns bounded snapshots; no client can supply a source or device target path. */
export class SqliteBackupService {
  private readonly jobs = new Map<string, Entry>();
  private closed = false;
  constructor(
    private readonly access: (
      workspaceId: string,
      id: string,
    ) => RelationalSession,
    private readonly directory = path.join(
      tmpdir(),
      "fouc-sqlite-backup",
      randomUUID(),
    ),
  ) {}

  private session(scope: SqliteBackupScope): RelationalSession {
    if (this.closed) throw new DatabaseInputError("SQLite 备份服务已关闭");
    const session = this.access(scope.workspaceId, scope.sessionId);
    if (session.provider !== "sqlite" || !path.isAbsolute(session.database))
      throw new DatabaseInputError(
        "原生备份仅适用于当前设备上的 SQLite 文件连接",
      );
    return session;
  }

  private entry(scope: SqliteBackupScope, id: string): Entry {
    const session = this.session(scope);
    const entry = this.jobs.get(id);
    if (
      !entry ||
      !sameScope(entry.scope, scope) ||
      !sameSession(entry.session, session)
    )
      throw new DatabaseInputError("当前工作空间和会话中的 SQLite 备份不存在");
    if (entry.snapshot.expiresAt <= Date.now())
      throw new DatabaseInputError("SQLite 临时快照已过期，请重新创建备份");
    return entry;
  }

  start(scope: SqliteBackupScope, input: unknown): SqliteBackupJob {
    const session = this.session(scope);
    const parsed = sqliteBackupInputSchema.safeParse(input);
    if (!parsed.success)
      throw new DatabaseInputError(
        parsed.error.issues[0]?.message ?? "备份文件名无效",
      );
    const scoped = [...this.jobs.values()].filter((entry) =>
      sameScope(entry.scope, scope),
    );
    if (
      scoped.some(
        (entry) =>
          entry.snapshot.status === "running" ||
          entry.snapshot.status === "cancelling",
      )
    )
      throw new DatabaseInputError(
        "当前会话已有 SQLite 备份运行，请等待或取消",
      );
    if (
      scoped.length >= SQLITE_BACKUP_LIMITS.sessionJobs ||
      this.jobs.size >= SQLITE_BACKUP_LIMITS.jobs
    )
      throw new DatabaseInputError("临时备份数量已达上限，请先清理旧快照");
    const reserved = [...this.jobs.values()].reduce(
      (sum, entry) =>
        sum +
        (entry.snapshot.status === "ready"
          ? (entry.snapshot.bytes ?? entry.budget)
          : entry.snapshot.status === "running" ||
              entry.snapshot.status === "cancelling" ||
              entry.directory
            ? entry.budget
            : 0),
      0,
    );
    const budget = Math.min(
      SQLITE_BACKUP_LIMITS.bytes,
      SQLITE_BACKUP_LIMITS.deviceBytes - reserved,
    );
    if (budget <= 0)
      throw new DatabaseInputError(
        "设备 SQLite 快照空间已达上限，请等待或清理已有备份",
      );
    const startedAt = Date.now();
    const entry: Entry = {
      scope: { ...scope },
      session,
      budget,
      controller: new AbortController(),
      directory: null,
      snapshot: {
        id: randomUUID(),
        revision: 0,
        status: "running",
        filename: parsed.data.filename,
        source: session.database,
        startedAt,
        finishedAt: null,
        expiresAt: startedAt + SQLITE_BACKUP_LIMITS.retentionMs,
        totalPages: null,
        remainingPages: null,
        pageSize: null,
        bytes: null,
        integrity: null,
        error: null,
      },
      done: Promise.resolve(),
      expiry: setTimeout(() => {}, 0),
      downloads: new Set(),
    };
    this.jobs.set(entry.snapshot.id, entry);
    this.retain(entry);
    entry.done = this.run(entry);
    return publicJob(entry);
  }

  private retain(entry: Entry): void {
    clearTimeout(entry.expiry);
    entry.expiry = setTimeout(
      () => {
        void this.remove(entry).catch((error) => {
          entry.snapshot.error = `临时文件清理失败：${error instanceof Error ? error.message : String(error)}`;
        });
      },
      Math.max(0, entry.snapshot.expiresAt - Date.now()),
    );
    entry.expiry.unref?.();
  }

  private async run(entry: Entry): Promise<void> {
    const signal = entry.controller.signal;
    const timeout = setTimeout(
      () =>
        entry.controller.abort(
          new Error("SQLite 备份超过两分钟，已停止原生任务"),
        ),
      SQLITE_BACKUP_LIMITS.timeoutMs,
    );
    timeout.unref?.();
    try {
      await mkdir(this.directory, { recursive: true });
      signal.throwIfAborted();
      entry.directory = await mkdtemp(path.join(this.directory, "snapshot-"));
      signal.throwIfAborted();
      const result = await createSqliteSnapshot(
        entry.session.database,
        path.join(entry.directory, "snapshot.sqlite"),
        entry.budget,
        signal,
        (progress) => {
          Object.assign(entry.snapshot, {
            totalPages: progress.totalPages,
            remainingPages: progress.remainingPages,
            pageSize: progress.pageSize,
          });
          entry.snapshot.revision++;
        },
      );
      signal.throwIfAborted();
      if (!sameSession(this.session(entry.scope), entry.session))
        throw new Error("源会话已变化，备份已停止");
      Object.assign(entry.snapshot, result, {
        status: "ready",
        remainingPages: 0,
        integrity: "verified",
        finishedAt: Date.now(),
        expiresAt: Date.now() + SQLITE_BACKUP_LIMITS.retentionMs,
      });
      this.retain(entry);
    } catch (error) {
      entry.snapshot.status = signal.aborted ? "cancelled" : "failed";
      entry.snapshot.error =
        error instanceof Error ? error.message : String(error);
      entry.snapshot.finishedAt = Date.now();
      try {
        await this.cleanFiles(entry);
      } catch (cleanupError) {
        entry.snapshot.error += `；临时文件清理失败：${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
      }
    } finally {
      clearTimeout(timeout);
      entry.snapshot.revision++;
    }
  }

  status(scope: SqliteBackupScope, id: string): SqliteBackupJob {
    return publicJob(this.entry(scope, id));
  }
  list(scope: SqliteBackupScope): SqliteBackupJob[] {
    this.session(scope);
    return [...this.jobs.values()]
      .filter(
        (entry) =>
          sameScope(entry.scope, scope) &&
          entry.snapshot.expiresAt > Date.now(),
      )
      .sort((left, right) => right.snapshot.startedAt - left.snapshot.startedAt)
      .map(publicJob);
  }
  cancel(scope: SqliteBackupScope, id: string): SqliteBackupJob {
    const entry = this.entry(scope, id);
    if (entry.snapshot.status === "running") {
      entry.snapshot.status = "cancelling";
      entry.snapshot.revision++;
      entry.controller.abort(new Error("SQLite 备份已由用户取消"));
    }
    return publicJob(entry);
  }

  download(scope: SqliteBackupScope, id: string, signal?: AbortSignal) {
    const entry = this.entry(scope, id);
    signal?.throwIfAborted();
    if (
      entry.snapshot.status !== "ready" ||
      !entry.directory ||
      !entry.snapshot.bytes ||
      entry.snapshot.integrity !== "verified"
    )
      throw new DatabaseInputError("SQLite 快照尚未通过原生完整性检查");
    if (entry.downloads.size >= 2)
      throw new DatabaseInputError("当前备份已有两个下载，请等待现有下载结束");
    const stream = createReadStream(
      path.join(entry.directory, "snapshot.sqlite"),
    );
    const download = {
      stream,
      closed: finished(stream).catch(() => undefined),
    };
    entry.downloads.add(download);
    stream.once("close", () => entry.downloads.delete(download));
    if (signal) addAbortSignal(signal, stream);
    return {
      stream,
      bytes: entry.snapshot.bytes,
      filename: entry.snapshot.filename,
      mimeType: "application/vnd.sqlite3",
    };
  }

  private async cleanFiles(entry: Entry): Promise<void> {
    const directory = entry.directory;
    if (!directory) return;
    if (path.dirname(directory) !== this.directory)
      throw new Error("SQLite 临时文件路径超出备份目录");
    for (const name of [
      "snapshot.sqlite",
      "snapshot.sqlite-wal",
      "snapshot.sqlite-shm",
      "snapshot.sqlite-journal",
    ])
      await rm(path.join(directory, name), { force: true });
    await rmdir(directory).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    entry.directory = null;
  }

  private async remove(entry: Entry): Promise<void> {
    clearTimeout(entry.expiry);
    if (!entry.controller.signal.aborted)
      entry.controller.abort(new Error("SQLite 备份任务或会话已关闭"));
    for (const download of entry.downloads)
      download.stream.destroy(new Error("SQLite 临时快照已关闭"));
    await Promise.all([...entry.downloads].map((download) => download.closed));
    await entry.done;
    await this.cleanFiles(entry);
    this.jobs.delete(entry.snapshot.id);
  }

  async discard(scope: SqliteBackupScope, id: string): Promise<void> {
    await this.remove(this.entry(scope, id));
  }
  async closeSession(scope: SqliteBackupScope): Promise<void> {
    await Promise.all(
      [...this.jobs.values()]
        .filter((entry) => sameScope(entry.scope, scope))
        .map((entry) => this.remove(entry)),
    );
  }
  async close(): Promise<void> {
    this.closed = true;
    await Promise.all(
      [...this.jobs.values()].map((entry) => this.remove(entry)),
    );
    await rmdir(this.directory).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}
