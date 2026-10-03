import { createReadStream, type ReadStream } from 'node:fs';
import { addAbortSignal } from 'node:stream';
import { finished } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RelationalSession } from '@fouc/shared';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { DatabaseExportJobs, type DatabaseExportScope, type NativeDatabaseExportAdapter } from './database-export';

type ExportEntry = { session: RelationalSession; driver: RelationalDriver };
type Download = { scope: DatabaseExportScope; jobId: string; stream: ReadStream; closed: Promise<void> };

/** Native jobs and disk artifacts remain owned by the live workspace/session. */
export class RelationalExportService {
  private readonly downloads = new Set<Download>();
  constructor(
    private readonly access: (workspaceId: string, id: string) => ExportEntry,
    readonly jobs = new DatabaseExportJobs(join(tmpdir(), 'fouc-native-export', randomUUID())),
  ) {}

  private check(scope: DatabaseExportScope, entry: ExportEntry, signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.access(scope.workspaceId, scope.sessionId) !== entry)
      throw new DatabaseInputError('导出会话已变化，请重新连接');
  }

  private adapter(scope: DatabaseExportScope): NativeDatabaseExportAdapter {
    const entry = this.access(scope.workspaceId, scope.sessionId);
    const approveSchema = async (schema: string, signal?: AbortSignal) => {
      this.check(scope, entry, signal);
      const visible = await entry.driver.schemas();
      this.check(scope, entry, signal);
      if (!visible.includes(schema)) throw new DatabaseInputError('导出范围不属于当前连接的可见 Schema');
    };
    return {
      provider: entry.session.provider,
      database: entry.session.database,
      consistency: 'independent-reads',
      listTables: async (schema, signal) => {
        await approveSchema(schema, signal);
        const tables = await entry.driver.tables(schema);
        this.check(scope, entry, signal);
        return tables.map(table => ({ schema, name: table.name, kind: table.kind }));
      },
      structure: async (schema, table, signal) => {
        this.check(scope, entry, signal);
        const columns = await entry.driver.columns(schema, table);
        this.check(scope, entry, signal);
        if (!columns.length) throw new DatabaseInputError('导出对象不存在或当前账号无权读取字段');
        const structure = await entry.driver.structure(schema, table, columns);
        this.check(scope, entry, signal);
        return { ...structure, columns, provider: entry.session.provider, connectionId: scope.sessionId };
      },
      read: async (sql, schema, maxRows, values, signal) => {
        this.check(scope, entry, signal);
        // Only the export compiler supplies this SQL; user query text cannot enter.
        const result = await entry.driver.read(sql, schema, maxRows, values, signal);
        this.check(scope, entry, signal);
        return result;
      },
    };
  }

  start(scope: DatabaseExportScope, input: unknown) {
    return this.jobs.start(scope, this.adapter(scope), input);
  }
  list(scope: DatabaseExportScope) {
    this.access(scope.workspaceId, scope.sessionId);
    return this.jobs.list(scope);
  }
  status(scope: DatabaseExportScope, id: string) {
    this.access(scope.workspaceId, scope.sessionId);
    return this.jobs.status(scope, id);
  }
  cancel(scope: DatabaseExportScope, id: string) {
    this.access(scope.workspaceId, scope.sessionId);
    return this.jobs.cancel(scope, id);
  }

  download(scope: DatabaseExportScope, id: string, signal?: AbortSignal) {
    this.access(scope.workspaceId, scope.sessionId);
    signal?.throwIfAborted();
    const artifact = this.jobs.artifact(scope, id);
    if (this.downloads.size >= 16) throw new DatabaseInputError('正在下载的导出文件过多，请等待现有下载结束');
    const stream = createReadStream(artifact.path);
    const closed = finished(stream).catch(() => undefined);
    const download = { scope: { ...scope }, jobId: id, stream, closed };
    this.downloads.add(download);
    stream.once('close', () => this.downloads.delete(download));
    if (signal) addAbortSignal(signal, stream);
    return { stream, filename: artifact.filename, mimeType: artifact.mimeType, bytes: artifact.bytes };
  }

  private async stopDownloads(scope?: DatabaseExportScope, id?: string): Promise<void> {
    const active = [...this.downloads].filter(download =>
      (!scope || download.scope.workspaceId === scope.workspaceId && download.scope.sessionId === scope.sessionId) &&
      (!id || download.jobId === id),
    );
    for (const download of active) download.stream.destroy(new Error('导出文件的会话或任务已关闭'));
    await Promise.all(active.map(download => download.closed));
  }
  async discard(scope: DatabaseExportScope, id: string): Promise<void> {
    this.access(scope.workspaceId, scope.sessionId);
    this.jobs.status(scope, id);
    await this.stopDownloads(scope, id);
    await this.jobs.discard(scope, id);
  }
  async closeSession(scope: DatabaseExportScope): Promise<void> {
    await this.stopDownloads(scope);
    await this.jobs.closeSession(scope);
  }
  async close(): Promise<void> {
    await this.stopDownloads();
    await this.jobs.close();
  }
}
