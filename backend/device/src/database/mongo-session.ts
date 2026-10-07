import type { MongoSession } from '@fouc/shared/mongo';
import { DatabaseInputError } from './input-error';
import { connectMongo, type MongoDriver } from './drivers/mongo-driver';
import { MongoMutationPlans } from './mongo-mutation-plans';
import { MongoDocumentImportPlans } from './mongo-document-plans';
import { openMongoDocumentExport, type MongoDocumentExport } from './mongo-document-export';
import { listMongoGridFsBuckets, listMongoGridFsFiles, openMongoGridFsDownload, summarizeMongoGridFs, type MongoGridFsDownload } from './mongo-gridfs';

type Entry = { session: MongoSession; driver: MongoDriver; requests: Set<AbortController>; touched: number; mutations: MongoMutationPlans; documentImports: MongoDocumentImportPlans; saving: boolean };
type DriverFactory = (value: unknown, signal?: AbortSignal) => Promise<MongoDriver>;
/** Session ownership is checked before any database call, including metadata and disconnect. */
export class MongoSessionManager {
  private readonly entries = new Map<string, Entry>();
  private readonly connections = new Map<AbortController, {  connectionId: string | null }>();
  private disposed = false;
  private readonly timer: ReturnType<typeof setInterval>;
  constructor(private readonly factory: DriverFactory = connectMongo, private readonly maxSessions = 32, private readonly idleMs = 30 * 60_000) {
    this.timer = setInterval(() => { void this.expire(); }, Math.min(idleMs, 60_000));
    this.timer.unref?.();
  }
  async connect(input: unknown, connectionId: string | null = null, signal?: AbortSignal): Promise<MongoSession> {
    if (connectionId !== null && (!connectionId || connectionId.length > 128)) throw new DatabaseInputError('MongoDB 连接标识无效');
    if (this.disposed) throw new DatabaseInputError('MongoDB 运行时已关闭');
    await this.expire();
    if (this.entries.size + this.connections.size >= this.maxSessions) throw new DatabaseInputError('MongoDB 会话已达到 32 个上限，请关闭未使用的连接');
    const controller = new AbortController(), abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted(); signal?.addEventListener('abort', abort, { once: true }); this.connections.set(controller, { connectionId });
    try {
      const driver = await this.factory(input, controller.signal);
      if (controller.signal.aborted || this.disposed) { await driver.close(); controller.signal.throwIfAborted(); throw new DatabaseInputError('MongoDB 运行时已关闭'); }
      const session: MongoSession = { provider: 'mongodb', id: crypto.randomUUID(), connectionId, database: driver.database, host: driver.host, version: driver.version, readOnly: true };
      this.entries.set(session.id, { session, driver, requests: new Set(), touched: Date.now(), mutations: new MongoMutationPlans(), documentImports: new MongoDocumentImportPlans(), saving: false });
      return { ...session };
    } finally { this.connections.delete(controller); signal?.removeEventListener('abort', abort); }
  }
  private entry(id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry) throw new DatabaseInputError('当前会话中的 MongoDB 连接已断开');
    entry.touched = Date.now(); return entry;
  }
  private async run<T>(id: string, signal: AbortSignal | undefined, operation: (driver: MongoDriver, signal: AbortSignal) => Promise<T>): Promise<T> {
    const entry = this.entry(id), controller = new AbortController(), abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted(); signal?.addEventListener('abort', abort, { once: true }); entry.requests.add(controller);
    try { const value = await operation(entry.driver, controller.signal); controller.signal.throwIfAborted(); return value; }
    finally { entry.requests.delete(controller); entry.touched = Date.now(); signal?.removeEventListener('abort', abort); }
  }
  databases(id: string, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.databases(request)); }
  collections(id: string, value: unknown, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.collections(value, request)); }
  find(id: string, value: unknown, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.find(value, request)); }
  count(id: string, value: unknown, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.count(value, request)); }
  indexes(id: string, value: unknown, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.indexes(value, request)); }
  information(id: string, value: unknown, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.information(value, request)); }
  command(id: string, value: unknown, signal?: AbortSignal) { return this.run(id, signal, (driver, request) => driver.command(value, request)); }
  gridFsBuckets(id: string, value: unknown, signal?: AbortSignal) {
    return this.run(id, signal, (driver, request) => listMongoGridFsBuckets(this.gridFsClient(driver), value, request));
  }
  gridFsFiles(id: string, value: unknown, signal?: AbortSignal) {
    return this.run(id, signal, (driver, request) => listMongoGridFsFiles(this.gridFsClient(driver), value, request));
  }
  gridFsSummary(id: string, value: unknown, signal?: AbortSignal) {
    return this.run(id, signal, (driver, request) => summarizeMongoGridFs(this.gridFsClient(driver), value, request));
  }
  private gridFsClient(driver: MongoDriver) {
    if (!driver.mutationClient) throw new DatabaseInputError('当前驱动未提供原生 GridFS 读取客户端');
    return driver.mutationClient();
  }
  async gridFsDownload(id: string, value: unknown, signal?: AbortSignal): Promise<MongoGridFsDownload> {
    const entry = this.entry(id);
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    entry.requests.add(controller);
    const release = () => {
      entry.requests.delete(controller);
      entry.touched = Date.now();
      signal?.removeEventListener('abort', abort);
    };
    try {
      const download = await openMongoGridFsDownload(this.gridFsClient(entry.driver), value, controller.signal);
      download.stream.once('close', release);
      // Observing errors does not consume data; toWeb/HTTP owns stream backpressure.
      download.stream.on('error', () => undefined);
      if (controller.signal.aborted) {
        download.stream.destroy();
        controller.signal.throwIfAborted();
      }
      return download;
    } catch (error) { release(); throw error; }
  }
  setWriteAccess(id: string, enabled: boolean): MongoSession {
    const entry = this.entry(id);
    if (entry.saving) throw new DatabaseInputError('请等待 MongoDB 当前写入确认');
    entry.mutations.clear(); entry.documentImports.clear(); entry.session = { ...entry.session, readOnly: !enabled };
    return { ...entry.session };
  }
  private writable(id: string) {
    const entry = this.entry(id);
    if (entry.session.readOnly || !entry.driver.mutationClient) throw new DatabaseInputError('当前 MongoDB 会话只读，请先解锁写入');
    return entry;
  }
  prepareMutation(id: string, input: unknown, signal?: AbortSignal) {
    const entry = this.writable(id);
    return entry.mutations.prepare(entry.driver.mutationClient!(), input, () => {
      if (this.writable(id) !== entry || entry.saving) throw new DatabaseInputError('MongoDB 连接正在提交，请稍后重新预览');
    }, signal);
  }
  discardMutation(id: string, planId: string) { this.entry(id).mutations.discard(planId); }
  async commitMutation(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('MongoDB 当前连接正在提交');
    entry.saving = true;
    try { return await entry.mutations.commit(entry.driver.mutationClient!(), planId, () => {
      if (this.writable(id) !== entry) throw new DatabaseInputError('MongoDB 连接已变化');
    }, signal); }
    finally { entry.saving = false; }
  }
  prepareDocumentImport(id: string, input: unknown, signal?: AbortSignal) {
    const entry = this.entry(id);
    return this.run(id, signal, (driver, request) => entry.documentImports.prepare(this.gridFsClient(driver), input, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('MongoDB 连接正在提交，请稍后重新预览');
    }, request));
  }
  documentImportStatus(id: string, planId: string) {
    return this.entry(id).documentImports.status(planId);
  }
  cancelDocumentImport(id: string, planId: string) {
    return this.entry(id).documentImports.cancel(planId);
  }
  discardDocumentImport(id: string, planId: string) {
    this.entry(id).documentImports.discard(planId);
  }
  async commitDocumentImport(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('MongoDB 当前连接正在提交');
    const controller = new AbortController(), abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    entry.requests.add(controller);
    entry.saving = true;
    try {
      return await entry.documentImports.commit(entry.driver.mutationClient!(), planId, () => {
        if (this.writable(id) !== entry) throw new DatabaseInputError('MongoDB 连接已变化');
      }, controller.signal);
    } finally {
      entry.saving = false;
      entry.requests.delete(controller);
      signal?.removeEventListener('abort', abort);
      entry.touched = Date.now();
    }
  }
  async exportDocuments(id: string, input: unknown, signal?: AbortSignal): Promise<MongoDocumentExport> {
    const entry = this.entry(id);
    const controller = new AbortController(), abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    entry.requests.add(controller);
    const release = () => {
      entry.requests.delete(controller);
      signal?.removeEventListener('abort', abort);
      entry.touched = Date.now();
    };
    try {
      const download = await openMongoDocumentExport(this.gridFsClient(entry.driver), input, controller.signal);
      download.stream.once('close', release);
      download.stream.on('error', () => undefined);
      if (controller.signal.aborted) { download.stream.destroy(); controller.signal.throwIfAborted(); }
      return download;
    } catch (error) { release(); throw error; }
  }
  async disconnect(id: string): Promise<void> {
    const entry = this.entry(id); this.entries.delete(id);
    entry.mutations.clear(); entry.documentImports.clear();
    for (const request of entry.requests) request.abort(new Error('MongoDB 会话已关闭'));
    await entry.driver.close();
  }
  async closeConnection(connectionId: string): Promise<void> {
    for (const [controller, scope] of this.connections) if (scope.connectionId === connectionId) controller.abort(new Error('MongoDB 连接已删除'));
    await Promise.all([...this.entries.values()].filter(entry => entry.session.connectionId === connectionId).map(entry => this.disconnect(entry.session.id)));
  }
  private async expire(): Promise<void> {
    const now = Date.now();
    await Promise.all([...this.entries.values()].filter(entry => !entry.requests.size && now - entry.touched > this.idleMs).map(entry => this.disconnect(entry.session.id).catch(() => {})));
  }
  async dispose(): Promise<void> {
    this.disposed = true; clearInterval(this.timer);
    for (const connection of this.connections.keys()) connection.abort(new Error('MongoDB 运行时已关闭'));
    await Promise.all([...this.entries.values()].map(entry => this.disconnect(entry.session.id).catch(() => {})));
  }
}
