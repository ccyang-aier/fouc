import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rmdir, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { DATABASE_EXPORT_MAX_STORED_BYTES, DATABASE_EXPORT_MAX_SESSION_BYTES, type DatabaseExportProgress } from '@fouc/shared/database-export';
import { DatabaseInputError } from './input-error';
import { prepareDatabaseExport } from './database-export-plan';
import { runDatabaseExport } from './database-export-run';
import type { DatabaseExportArtifact, DatabaseExportScope, NativeDatabaseExportAdapter } from './database-export-types';
import { DatabaseExportWriter } from './database-export-writer';

interface Job {
  scope: DatabaseExportScope;
  progress: DatabaseExportProgress;
  controller: AbortController;
  directory: string;
  partial: string;
  artifact: DatabaseExportArtifact | null;
  task: Promise<void>;
  storedBytes: number;
}

function sameScope(a: DatabaseExportScope, b: DatabaseExportScope): boolean {
  return a.sessionId === b.sessionId;
}

/** Device-only UUID artifacts, scoped to the owning live session. */
export class DatabaseExportJobs {
  private readonly jobs = new Map<string, Job>();
  private readonly directory: string;
  private readonly ready: Promise<void>;
  private closed = false;

  constructor(directory: string, private readonly budget = { maxStoredBytes: DATABASE_EXPORT_MAX_STORED_BYTES, maxSessionBytes: DATABASE_EXPORT_MAX_SESSION_BYTES }) {
    this.directory = resolve(directory);
    if (![budget.maxStoredBytes, budget.maxSessionBytes].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('原生导出磁盘预算须为正整数。');
    this.ready = this.initialize();
    // start() reports initialization errors through the job status, never an unhandled rejection.
    void this.ready.catch(() => undefined);
  }

  private async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    // Sessions are ephemeral. After a process restart only known UUID artifacts in
    // this dedicated namespace are stale; do not recurse into unknown directories.
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.name)) continue;
      const directory = resolve(this.directory, entry.name);
      if (!directory.startsWith(this.directory + sep)) throw new Error('导出缓存清理范围无效。');
      const files = await readdir(directory, { withFileTypes: true });
      if (files.some(file => !file.isFile() || !['partial', 'artifact'].includes(file.name))) continue;
      for (const file of files) await unlink(join(directory, file.name));
      await rmdir(directory);
    }
  }

  start(scope: DatabaseExportScope, adapter: NativeDatabaseExportAdapter, input: unknown): DatabaseExportProgress {
    if (this.closed) throw new DatabaseInputError('导出任务管理器已关闭。');
    if (!scope.sessionId) throw new DatabaseInputError('导出任务缺少会话。');
    const owned = [...this.jobs.values()].filter(job => sameScope(job.scope, scope));
    const active = owned.filter(job => ['preparing', 'running', 'finalizing'].includes(job.progress.status));
    if (active.length >= 2 || owned.length >= 16 || this.jobs.size >= 128) throw new DatabaseInputError('导出任务已达到上限，请取消运行任务或清理已完成文件后重试。');
    const id = randomUUID();
    const directory = join(this.directory, id);
    const progress: DatabaseExportProgress = {
      id, status: 'preparing', table: null, completedTables: 0, totalTables: null,
      rows: 0, bytes: 0, startedAt: Date.now(), finishedAt: null,
      error: null, review: null, summary: null, artifact: null,
    };
    const job: Job = {
      scope: { ...scope }, progress, controller: new AbortController(), directory,
      partial: join(directory, 'partial'), artifact: null, task: Promise.resolve(), storedBytes: 0,
    };
    this.jobs.set(id, job);
    job.task = this.execute(job, adapter, input);
    return structuredClone(progress);
  }

  private get(scope: DatabaseExportScope, id: string): Job {
    const job = this.jobs.get(id);
    if (!job || !sameScope(job.scope, scope)) throw new DatabaseInputError('当前会话没有这个导出任务。');
    return job;
  }

  status(scope: DatabaseExportScope, id: string): DatabaseExportProgress {
    return structuredClone(this.get(scope, id).progress);
  }

  list(scope: DatabaseExportScope): DatabaseExportProgress[] {
    return [...this.jobs.values()].reverse().filter(job => sameScope(job.scope, scope))
      .sort((a, b) => b.progress.startedAt - a.progress.startedAt)
      .map(job => structuredClone(job.progress));
  }

  cancel(scope: DatabaseExportScope, id: string): DatabaseExportProgress {
    const job = this.get(scope, id);
    if (['preparing', 'running', 'finalizing'].includes(job.progress.status)) job.controller.abort(new Error('用户取消了导出。'));
    return structuredClone(job.progress);
  }

  artifact(scope: DatabaseExportScope, id: string): DatabaseExportArtifact {
    const job = this.get(scope, id);
    if (job.progress.status !== 'completed' || !job.artifact) throw new DatabaseInputError('导出尚未完成，没有可下载的文件。');
    return { ...job.artifact };
  }

  async discard(scope: DatabaseExportScope, id: string): Promise<void> {
    const job = this.get(scope, id);
    job.controller.abort(new Error('导出任务已清理。'));
    await job.task;
    await this.remove(job);
    this.jobs.delete(id);
  }

  async closeSession(scope: DatabaseExportScope): Promise<void> {
    await Promise.all([...this.jobs.values()].filter(job => sameScope(job.scope, scope)).map(job => this.discard(scope, job.progress.id)));
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.jobs.values()].map(job => this.discard(job.scope, job.progress.id)));
  }

  private async remove(job: Job): Promise<void> {
    // Every target comes from this manager's UUID paths, never request text.
    for (const path of new Set([job.partial, job.artifact?.path].filter((value): value is string => Boolean(value)))) {
      try { await unlink(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    try { await rmdir(job.directory); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    job.storedBytes = 0;
  }

  private async execute(job: Job, adapter: NativeDatabaseExportAdapter, input: unknown): Promise<void> {
    let writer: DatabaseExportWriter | null = null;
    const signal = job.controller.signal;
    try {
      await this.ready;
      const prepared = await prepareDatabaseExport(adapter, input, signal);
      signal.throwIfAborted();
      job.progress.review = prepared.review;
      job.progress.totalTables = prepared.tables.length;
      job.progress.status = 'running';
      await mkdir(job.directory, { recursive: true, mode: 0o700 });
      const zip = prepared.review.input.packaging === 'zip';
      writer = await DatabaseExportWriter.create(job.partial, zip, signal, bytes => {
        job.storedBytes = bytes;
        job.progress.bytes = bytes;
        let total = 0, session = 0;
        for (const item of this.jobs.values()) {
          total += item.storedBytes;
          if (item.scope.sessionId === job.scope.sessionId) session += item.storedBytes;
        }
        if (total > this.budget.maxStoredBytes || session > this.budget.maxSessionBytes) throw new Error('设备 / 会话的导出临时文件预算已满，请清理已完成任务或缩小导出范围。');
      });
      const summary = await runDatabaseExport(adapter, prepared, writer, signal, update => {
        job.progress.table = update.table;
        job.progress.rows = update.rows;
        job.progress.completedTables = update.completedTables;
        if (update.finalizing) job.progress.status = 'finalizing';
      });
      writer = null;
      signal.throwIfAborted();
      const extension = zip ? 'zip' : prepared.review.input.format;
      const mimeType = zip ? 'application/zip' : extension === 'json' ? 'application/json' : extension === 'csv' ? 'text/csv;charset=utf-8' : extension === 'ndjson' ? 'application/x-ndjson' : 'application/sql';
      const filename = `fouc-${adapter.provider}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      const path = join(job.directory, 'artifact');
      // Track the final path before rename so cancellation and cleanup cannot leak it.
      job.artifact = { path, filename, mimeType, bytes: summary.bytes };
      await rename(job.partial, path);
      signal.throwIfAborted();
      job.progress.summary = summary;
      job.progress.artifact = { filename, mimeType, bytes: summary.bytes };
      job.progress.status = 'completed';
    } catch (error) {
      job.progress.status = signal.aborted ? 'cancelled' : 'failed';
      job.progress.error = signal.aborted ? null : error instanceof Error ? error.message : String(error);
      if (writer) await writer.close().catch(() => undefined);
      try { await this.remove(job); } catch (cleanupError) {
        job.progress.error = `${job.progress.error ?? '导出已取消'}；临时文件清理失败：${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
      }
      job.artifact = null;
    } finally {
      job.progress.finishedAt = Date.now();
      job.progress.table = null;
    }
  }
}
