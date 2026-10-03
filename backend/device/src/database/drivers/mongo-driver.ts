import { BSON, MongoClient, type Abortable, type AggregateOptions, type ListIndexesOptions, type Document } from 'mongodb';
import { MONGO_LIMITS, type MongoCollectionInfo, type MongoCollectionList, type MongoCommandResult, type MongoCountResult, type MongoDatabaseList, type MongoDocumentPage, type MongoIndex, type MongoIndexList } from '@fouc/shared/mongo';
import { DatabaseInputError } from '../input-error';
import { mongoConnection, mongoDatabase, mongoEjson, mongoFindInput, mongoInteger, mongoNamespace, mongoObject } from '../mongo-input';
import { assertMongoReadValue, mongoReadCommand } from '../mongo-read-policy';

export interface MongoDriver {
  readonly database: string; readonly host: string; readonly version: string | null;
  databases(signal?: AbortSignal): Promise<MongoDatabaseList>;
  collections(input: unknown, signal?: AbortSignal): Promise<MongoCollectionList>;
  find(input: unknown, signal?: AbortSignal): Promise<MongoDocumentPage>;
  count(input: unknown, signal?: AbortSignal): Promise<MongoCountResult>;
  indexes(input: unknown, signal?: AbortSignal): Promise<MongoIndexList>;
  information(input: unknown, signal?: AbortSignal): Promise<MongoCollectionInfo>;
  command(input: unknown, signal?: AbortSignal): Promise<MongoCommandResult>;
  mutationClient?(): MongoClient;
  close(): Promise<void>;
}
const OPTIONS = { promoteValues: false, promoteLongs: false, maxTimeMS: MONGO_LIMITS.maxTimeMs } as const;
export function mongoCanonical(value: unknown): string { return BSON.EJSON.stringify(value, { relaxed: false }); }
export function mongoNumeric(value: unknown): string | null {
  if (value instanceof BSON.Long || value instanceof BSON.Int32 || value instanceof BSON.Double || value instanceof BSON.Decimal128) return value.toString();
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
}
type ReadCursor = AsyncIterable<Document> & { close(): Promise<void> };
/** Every cursor is owned by this call; early page bounds, failures and cancellation close it. */
export async function readMongoCursor(cursor: ReadCursor, limit: number, signal?: AbortSignal): Promise<{ documents: string[]; hasMore: boolean; bytes: number }> {
  const documents: string[] = [];
  let bytes = 0, hasMore = false;
  try {
    for await (const document of cursor) {
      signal?.throwIfAborted();
      if (documents.length === limit) { hasMore = true; break; }
      const text = mongoCanonical(document), size = Buffer.byteLength(text);
      if (bytes + size > MONGO_LIMITS.responseBytes) {
        if (!documents.length) throw new DatabaseInputError('单个文档超过 32 MiB Extended JSON 展示限制，请缩小字段投影');
        hasMore = true; break;
      }
      documents.push(text); bytes += size;
    }
    signal?.throwIfAborted();
    return { documents, hasMore, bytes };
  } finally { await cursor.close(); }
}

class NativeMongoDriver implements MongoDriver {
  constructor(private readonly client: MongoClient, readonly database: string, readonly host: string, readonly version: string | null) {}
  mutationClient() { return this.client; }
  async databases(signal?: AbortSignal): Promise<MongoDatabaseList> {
    signal?.throwIfAborted();
    const result = await this.client.db('admin').command({ listDatabases: 1, authorizedDatabases: true }, { ...OPTIONS, signal });
    const all = Array.isArray(result.databases) ? result.databases as Document[] : [];
    return { databases: all.slice(0, MONGO_LIMITS.directory).map(item => ({ name: String(item.name), sizeBytes: mongoNumeric(item.sizeOnDisk), empty: typeof item.empty === 'boolean' ? item.empty : null })), truncated: all.length > MONGO_LIMITS.directory };
  }
  async collections(value: unknown, signal?: AbortSignal): Promise<MongoCollectionList> {
    const database = mongoDatabase(mongoObject(value).database);
    const page = await readMongoCursor(this.client.db(database).listCollections({}, { ...OPTIONS, signal, nameOnly: false, batchSize: 100 }), MONGO_LIMITS.directory, signal);
    return { database, collections: page.documents.map(text => {
      const item = BSON.EJSON.parse(text, { relaxed: false }) as Document;
      const kind: 'collection' | 'view' | 'timeseries' | 'unknown' = ['collection', 'view', 'timeseries'].includes(item.type) ? item.type as 'collection' | 'view' | 'timeseries' : 'unknown';
      return { name: String(item.name), kind, options: mongoCanonical(item.options ?? {}) };
    }).sort((a, b) => a.name.localeCompare(b.name)), truncated: page.hasMore };
  }
  async find(value: unknown, signal?: AbortSignal): Promise<MongoDocumentPage> {
    const input = mongoFindInput(value), start = performance.now();
    assertMongoReadValue(input.parsedFilter);
    const offset = input.offset!, limit = input.limit!;
    const cursor = this.client.db(input.database).collection(input.collection).find(input.parsedFilter, { ...OPTIONS, signal, sort: input.parsedSort, projection: input.parsedProjection, skip: offset, limit: limit + 1, batchSize: Math.min(limit + 1, 100) });
    const page = await readMongoCursor(cursor, limit, signal);
    const next = offset + page.documents.length;
    return { database: input.database, collection: input.collection, ...page, offset, limit, nextOffset: page.hasMore && next <= MONGO_LIMITS.offset ? next : null, elapsedMs: performance.now() - start, warnings: next > MONGO_LIMITS.offset ? ['分页达到当前 1000000 条偏移限制，请收窄筛选。'] : [] };
  }
  async count(value: unknown, signal?: AbortSignal): Promise<MongoCountResult> {
    const namespace = mongoNamespace(value), filter = mongoEjson(mongoObject(value).filter), start = performance.now();
    assertMongoReadValue(filter);
    const cursor = this.client.db(namespace.database).collection(namespace.collection).aggregate([{ $match: filter }, { $count: 'count' }], { ...OPTIONS, signal, allowDiskUse: false });
    const page = await readMongoCursor(cursor, 1, signal);
    const result = page.documents.length ? BSON.EJSON.parse(page.documents[0], { relaxed: false }) as Document : null;
    const count = result ? mongoNumeric(result.count) : '0';
    if (count === null) throw new Error('MongoDB 计数结果无法识别');
    return { ...namespace, count, elapsedMs: performance.now() - start };
  }
  async indexes(value: unknown, signal?: AbortSignal): Promise<MongoIndexList> {
    const namespace = mongoNamespace(value);
    // 7.7 public ListIndexesOptions omits Abortable; its AbstractCursor consumes signal.
    const options: ListIndexesOptions & Abortable = { ...OPTIONS, signal, batchSize: 100 };
    const page = await readMongoCursor(this.client.db(namespace.database).collection(namespace.collection).listIndexes(options), MONGO_LIMITS.directory, signal);
    const indexes: MongoIndex[] = page.documents.map(raw => {
      const item = BSON.EJSON.parse(raw, { relaxed: false }) as Document;
      return { name: String(item.name), keys: Object.entries(item.key ?? {}).map(([field, direction]) => ({ field, direction: mongoNumeric(direction) ?? String(direction) })), unique: item.unique === true || item.name === '_id_', primary: item.name === '_id_', sparse: item.sparse === true, hidden: item.hidden === true, expiresAfterSeconds: mongoNumeric(item.expireAfterSeconds), partialFilter: item.partialFilterExpression ? mongoCanonical(item.partialFilterExpression) : null, collation: item.collation ? mongoCanonical(item.collation) : null, raw };
    });
    return { ...namespace, indexes, truncated: page.hasMore };
  }
  async information(value: unknown, signal?: AbortSignal): Promise<MongoCollectionInfo> {
    const namespace = mongoNamespace(value);
    const result: MongoCollectionInfo = { ...namespace, count: null, sizeBytes: null, storageBytes: null, averageDocumentBytes: null, indexBytes: null, indexCount: null, raw: null, warnings: [] };
    try {
      const stats = await this.client.db(namespace.database).command({ collStats: namespace.collection, scale: 1 }, { ...OPTIONS, signal });
      result.count = mongoNumeric(stats.count); result.sizeBytes = mongoNumeric(stats.size); result.storageBytes = mongoNumeric(stats.storageSize);
      result.averageDocumentBytes = mongoNumeric(stats.avgObjSize); result.indexBytes = mongoNumeric(stats.totalIndexSize); result.indexCount = mongoNumeric(stats.nindexes); result.raw = mongoCanonical(stats);
    } catch (error) {
      signal?.throwIfAborted();
      result.warnings.push(`集合统计不可用：${error instanceof Error ? error.message : String(error)}`);
    }
    return result;
  }
  async command(value: unknown, signal?: AbortSignal): Promise<MongoCommandResult> {
    const input = mongoObject(value), database = mongoDatabase(input.database), limit = mongoInteger(input.limit, MONGO_LIMITS.defaultPage, 1, MONGO_LIMITS.page);
    const { name, command } = mongoReadCommand(input.command), start = performance.now(), db = this.client.db(database);
    let cursor: ReadCursor | null = null;
    const warnings: string[] = [];
    if (name === 'find') {
      const numeric = (value: unknown): unknown => value instanceof BSON.Int32 || value instanceof BSON.Double ? value.valueOf() : value;
      for (const key of Object.keys(command)) if (!['find', 'filter', 'projection', 'sort', 'skip', 'limit', 'maxTimeMS', 'comment'].includes(key)) throw new DatabaseInputError(`find 选项未开放：${key}`);
      const query = mongoFindInput({ database, collection: command.find, filter: mongoCanonical(command.filter ?? {}), projection: mongoCanonical(command.projection ?? {}), sort: mongoCanonical(command.sort ?? {}), offset: numeric(command.skip), limit: command.limit === undefined ? limit : numeric(command.limit) });
      const page = await this.find(query, signal);
      return { database, commandName: name, value: null, documents: page.documents, hasMore: page.hasMore, elapsedMs: page.elapsedMs, warnings: page.warnings };
    }
    if (name === 'aggregate') {
      for (const key of Object.keys(command)) if (!['aggregate', 'pipeline', 'cursor', 'maxTimeMS', 'comment', 'allowDiskUse'].includes(key)) throw new DatabaseInputError(`aggregate 选项未开放：${key}`);
      const options: AggregateOptions & Abortable = { ...OPTIONS, signal, allowDiskUse: false, batchSize: 100 };
      cursor = typeof command.aggregate === 'string'
        ? db.collection(command.aggregate).aggregate(command.pipeline, options)
        : db.aggregate(command.pipeline, options);
      warnings.push(`聚合最多展示 ${limit} 个文档；更多结果请收窄 pipeline。`);
    } else if (name === 'listCollections') {
      cursor = db.listCollections(command.filter ?? {}, { ...OPTIONS, signal, batchSize: 100 });
    } else if (name === 'listIndexes') {
      const options: ListIndexesOptions & Abortable = { ...OPTIONS, signal, batchSize: 100 };
      cursor = db.collection(command.listIndexes).listIndexes(options);
    }
    if (cursor) {
      const page = await readMongoCursor(cursor, limit, signal);
      return { database, commandName: name, value: null, documents: page.documents, hasMore: page.hasMore, elapsedMs: performance.now() - start, warnings };
    }
    if (name === 'explain') command.verbosity = 'queryPlanner';
    command.maxTimeMS = MONGO_LIMITS.maxTimeMs;
    const raw = await db.command(command, { ...OPTIONS, signal });
    const text = mongoCanonical(raw);
    if (Buffer.byteLength(text) > MONGO_LIMITS.responseBytes) throw new DatabaseInputError('命令结果超过 32 MiB 展示限制，请使用有界的 find / aggregate');
    return { database, commandName: name, value: text, documents: [], hasMore: false, elapsedMs: performance.now() - start, warnings };
  }
  close() { return this.client.close(true); }
}

export async function connectMongo(value: unknown, signal?: AbortSignal): Promise<MongoDriver> {
  const input = mongoConnection(value);
  const client = new MongoClient(input.uri, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000, maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60_000, promoteValues: false, promoteLongs: false });
  const abort = () => { void client.close(true); };
  signal?.throwIfAborted(); signal?.addEventListener('abort', abort, { once: true });
  try {
    await client.connect(); signal?.throwIfAborted();
    const db = client.db(input.database);
    await db.command({ ping: 1 }, { ...OPTIONS, signal });
    const build = await db.command({ buildInfo: 1 }, { ...OPTIONS, signal }).catch(() => null);
    signal?.throwIfAborted();
    return new NativeMongoDriver(client, input.database, input.host, typeof build?.version === 'string' ? build.version : null);
  } catch (error) { await client.close(true); throw error; }
  finally { signal?.removeEventListener('abort', abort); }
}
