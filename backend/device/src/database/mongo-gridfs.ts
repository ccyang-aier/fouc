import { addAbortSignal, Readable } from 'node:stream';
import { BSON, GridFSBucket, type GridFSBucketReadStream, type GridFSBucketReadStreamOptions, type Document, type MongoClient } from 'mongodb';
import {
  MONGO_GRIDFS_LIMITS,
  mongoGridFsDownloadName,
  type MongoGridFsBuckets,
  type MongoGridFsFile,
  type MongoGridFsPage,
  type MongoGridFsSummary,
} from '@fouc/shared/mongo-gridfs';
import { MONGO_LIMITS } from '@fouc/shared/mongo';
import { mongoCanonical, mongoNumeric, readMongoCursor } from './drivers/mongo-driver';
import { mongoDatabase, mongoObject } from './mongo-input';
import { mongoGridFsFileInput, mongoGridFsListInput, mongoGridFsNamespace, type MongoGridFsIdentity } from './mongo-gridfs-input';
import { DatabaseInputError } from './input-error';

const READ_OPTIONS = { promoteValues: false, promoteLongs: false, maxTimeMS: MONGO_LIMITS.maxTimeMs } as const;

/** Discover actual collection pairs, retaining incomplete buckets for diagnosis. */
export async function listMongoGridFsBuckets(client: MongoClient, value: unknown, signal?: AbortSignal): Promise<MongoGridFsBuckets> {
  const database = mongoDatabase(mongoObject(value).database);
  signal?.throwIfAborted();
  const cursor = client.db(database).listCollections({}, { nameOnly: true, ...READ_OPTIONS, signal });
  const page = await readMongoCursor(cursor, MONGO_LIMITS.directory, signal);
  const discovered = new Map<string, { files: boolean; chunks: boolean }>();
  for (const text of page.documents) {
    const row = BSON.EJSON.parse(text, { relaxed: false }) as Document;
    if (typeof row.name !== 'string' || row.name.startsWith('system.')) continue;
    const suffix = row.name.endsWith('.files') ? 'files' : row.name.endsWith('.chunks') ? 'chunks' : null;
    if (!suffix) continue;
    const bucket = row.name.slice(0, -suffix.length - 1);
    if (!bucket) continue;
    const pair = discovered.get(bucket) ?? { files: false, chunks: false };
    pair[suffix] = true;
    discovered.set(bucket, pair);
  }
  return {
    database,
    buckets: [...discovered].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, pair]) => ({
      database, bucket, filesCollection: `${bucket}.files`, chunksCollection: `${bucket}.chunks`,
      state: pair.files && pair.chunks ? 'complete' : pair.files ? 'files-only' : 'chunks-only',
    })),
    truncated: page.hasMore,
  };
}

export function mongoGridFsFileInfo(row: Document): MongoGridFsFile {
  const warnings: string[] = [];
  const numericLength = mongoNumeric(row.length);
  const length = numericLength !== null && /^\d+$/.test(numericLength) && BigInt(numericLength) <= 9223372036854775807n ? numericLength : null;
  if (length === null) warnings.push('文件长度不是有效非负64位整数；当前文件不能下载');
  const numericChunkSize = mongoNumeric(row.chunkSize);
  const chunkSize = numericChunkSize !== null && /^[1-9]\d*$/.test(numericChunkSize) && BigInt(numericChunkSize) <= 16777216n ? numericChunkSize : null;
  if (chunkSize === null) warnings.push('chunkSize 无效，无法确认完整分块读取');
  const date = row.uploadDate instanceof Date && Number.isFinite(row.uploadDate.getTime()) ? row.uploadDate.toISOString() : null;
  if (!date) warnings.push('原生 uploadDate 缺失或无效');
  const contentType = row.metadata && typeof row.metadata === 'object' && typeof row.metadata.contentType === 'string'
    ? row.metadata.contentType : typeof row.contentType === 'string' ? row.contentType : null;
  return {
    idEjson: mongoCanonical(row._id),
    filename: typeof row.filename === 'string' ? row.filename : '',
    length,
    chunkSize,
    uploadedAt: date,
    contentType,
    metadataEjson: mongoCanonical(row.metadata ?? {}),
    rawEjson: mongoCanonical(row),
    warnings,
  };
}

export async function listMongoGridFsFiles(client: MongoClient, value: unknown, signal?: AbortSignal): Promise<MongoGridFsPage> {
  const input = mongoGridFsListInput(value);
  const started = performance.now();
  signal?.throwIfAborted();
  const cursor = client.db(input.database).collection(`${input.bucket}.files`).find(input.filter, {
    ...READ_OPTIONS, signal, sort: input.sort, skip: input.offset, limit: input.limit + 1, batchSize: Math.min(input.limit + 1, 100),
  });
  const page = await readMongoCursor(cursor, input.limit, signal);
  const files = page.documents.map(text => mongoGridFsFileInfo(BSON.EJSON.parse(text, { relaxed: false }) as Document));
  const nextOffset = input.offset + files.length;
  return {
    database: input.database, bucket: input.bucket, files, offset: input.offset, limit: input.limit,
    hasMore: page.hasMore, nextOffset: page.hasMore && nextOffset <= MONGO_LIMITS.offset ? nextOffset : null,
    elapsedMs: performance.now() - started,
    warnings: ['分页按独立原生读取，读取期间的文件增删可能影响后续页。', ...(page.hasMore && nextOffset > MONGO_LIMITS.offset ? ['达到当前偏移上限，请收窄筛选。'] : [])],
  };
}

export async function summarizeMongoGridFs(client: MongoClient, value: unknown, signal?: AbortSignal): Promise<MongoGridFsSummary> {
  const namespace = mongoGridFsNamespace(value);
  signal?.throwIfAborted();
  const cursor = client.db(namespace.database).collection(`${namespace.bucket}.files`).aggregate([
    { $project: {
      numericLength: { $convert: { input: '$length', to: 'decimal', onError: null, onNull: null } },
      isNumber: { $isNumber: '$length' },
    } },
    { $project: {
      numericLength: 1,
      validLength: { $cond: ['$isNumber', { $and: [
        { $gte: ['$numericLength', 0] },
        { $lte: ['$numericLength', BSON.Decimal128.fromString('9223372036854775807')] },
        { $eq: ['$numericLength', { $trunc: '$numericLength' }] },
      ] }, false] },
    } },
    { $group: {
      _id: null,
      fileCount: { $sum: BSON.Decimal128.fromString('1') },
      totalBytes: { $sum: { $cond: ['$validLength', '$numericLength', BSON.Decimal128.fromString('0')] } },
      invalidLength: { $sum: { $cond: ['$validLength', 0, 1] } },
    } },
  ], { ...READ_OPTIONS, signal, allowDiskUse: false });
  const page = await readMongoCursor(cursor, 1, signal);
  const row = page.documents.length ? BSON.EJSON.parse(page.documents[0], { relaxed: false }) as Document : null;
  const invalid = row ? mongoNumeric(row.invalidLength) : '0';
  return {
    ...namespace,
    fileCount: row ? mongoNumeric(row.fileCount) ?? '0' : '0',
    totalBytes: invalid === '0' ? row ? mongoNumeric(row.totalBytes) : '0' : null,
    warnings: invalid !== '0' ? ['部分文件长度缺失或无效，不显示误导性的总字节数。'] : [],
  };
}

export interface MongoGridFsDownload {
  stream: Readable;
  file: MongoGridFsFile;
  filename: string;
  bytes: number;
}

/** Native GridFS verifies chunk sequence and lengths while streaming; no whole-file buffer. */
export async function openMongoGridFsDownload(client: MongoClient, value: unknown, signal?: AbortSignal): Promise<MongoGridFsDownload> {
  const input = mongoGridFsFileInput(value);
  signal?.throwIfAborted();
  const database = client.db(input.database);
  const row = await database.collection<Document & { _id: MongoGridFsIdentity }>(`${input.bucket}.files`).findOne({ _id: input.id }, { ...READ_OPTIONS, signal });
  signal?.throwIfAborted();
  if (!row) throw new DatabaseInputError('GridFS 文件不存在或当前账号不可读取');
  const file = mongoGridFsFileInfo(row);
  if (file.length === null || file.chunkSize === null) throw new DatabaseInputError('文件长度或分块大小无效，无法确认完整下载范围');
  const length = BigInt(file.length);
  if (length > BigInt(MONGO_GRIDFS_LIMITS.downloadBytes)) throw new DatabaseInputError('当前单文件下载上限为1 GiB；元数据仍可浏览');
  const bucket = new GridFSBucket(database, { bucketName: input.bucket });
  // The public declaration names the default ObjectId; its implementation forwards any BSON scalar unchanged into {_id}.
  // Widen this factory contract only, retaining the validated scalar identity and the native public stream lifecycle.
  const open = bucket.openDownloadStream as (id: MongoGridFsIdentity, options?: GridFSBucketReadStreamOptions) => GridFSBucketReadStream;
  const native = open.call(bucket, input.id, { timeoutMS: 5 * 60_000 });
  native.once('file', (current: Document) => {
    if (String(current.length) !== file.length || String(current.chunkSize) !== file.chunkSize) native.destroy(new Error('GridFS 文件元数据已变化，请重新读取后下载'));
  });
  // Async iteration begins only when HTTP pulls. It bounds actual bytes and closes the native cursor on cancellation.
  const stream = Readable.from((async function* () {
    let received = 0;
    try {
      for await (const chunk of native) {
        signal?.throwIfAborted();
        received += chunk.byteLength;
        if (received > Number(length)) throw new Error('GridFS 内容超过已核对文件长度');
        yield chunk;
      }
      if (received !== Number(length)) throw new Error('GridFS 内容未完整读取');
    } finally { await native.abort().catch(() => undefined); }
  })(), { objectMode: false });
  // Aborting before the first HTTP read must also terminate the still-lazy native stream.
  stream.once('close', () => { void native.abort().catch(() => undefined); });
  native.on('error', () => undefined);
  if (signal) addAbortSignal(signal, native);
  if (signal) addAbortSignal(signal, stream);
  return { stream, file, filename: mongoGridFsDownloadName(file.filename), bytes: Number(length) };
}
