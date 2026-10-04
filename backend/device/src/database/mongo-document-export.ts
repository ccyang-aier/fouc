import { BSON, type MongoClient } from 'mongodb';
import { Readable, addAbortSignal } from 'node:stream';
import { MONGO_DOCUMENT_TRANSFER_LIMITS as LIMITS, type MongoDocumentExportInput } from '@fouc/shared/mongo-document-transfer';
import { mongoFindInput, mongoInteger, mongoObject } from './mongo-input';
import { DatabaseInputError } from './input-error';
import { mongoCollectionSnapshot, MONGO_MUTATION_READ } from './mongo-mutation-snapshot';
import { assertMongoReadValue } from './mongo-read-policy';

export type MongoDocumentExport = { stream: Readable; filename: string; input: MongoDocumentExportInput };

function filename(database: string, collection: string): string {
  const cleaned = `${database}-${collection}`.normalize('NFC').replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '');
  let value = cleaned;
  while (Buffer.byteLength(value) > 160) value = [...value].slice(0, -1).join('');
  return `${value || 'documents'}.ndjson`;
}

export async function openMongoDocumentExport(client: MongoClient, value: unknown, signal: AbortSignal): Promise<MongoDocumentExport> {
  const raw = mongoObject(value);
  if (raw.scope !== 'all' && raw.scope !== 'first') throw new DatabaseInputError('请明确选择所有匹配文档或前 N 个文档');
  const find = mongoFindInput({ ...raw, projection: '{}', offset: 0, limit: 100 });
  assertMongoReadValue(find.parsedFilter);
  const limit = raw.scope === 'first' ? mongoInteger(raw.limit, 1000, 1, 1_000_000) : undefined;
  const metadata = await mongoCollectionSnapshot(client, find.database, find.collection, signal);
  if (!metadata) throw new DatabaseInputError('导出集合已不存在');
  signal.throwIfAborted();
  const cursor = client.db(find.database).collection(find.collection).find(find.parsedFilter, {
    ...MONGO_MUTATION_READ, sort: find.parsedSort, batchSize: 100, limit, signal,
  });
  const timeout = setTimeout(() => stream.destroy(new Error('文档导出达到 10 分钟上限；下载不完整，请缩小范围')), 10 * 60_000);
  timeout.unref?.();
  async function* chunks() {
    let bytes = 0;
    try {
      for await (const document of cursor) {
        signal.throwIfAborted();
        const chunk = Buffer.from(BSON.EJSON.stringify(document, { relaxed: false }) + '\n', 'utf8');
        bytes += chunk.byteLength;
        if (bytes > LIMITS.exportBytes) throw new Error('导出超过 1 GiB，下载不完整；请使用前 N 个文档或缩小筛选范围');
        yield chunk;
      }
    } finally { clearTimeout(timeout); await cursor.close(); }
  }
  const stream = Readable.from(chunks(), { objectMode: false, highWaterMark: 64 * 1024 });
  stream.once('close', () => { clearTimeout(timeout); void cursor.close().catch(() => undefined); });
  addAbortSignal(signal, stream);
  return { stream, filename: filename(find.database, find.collection), input: { database: find.database, collection: find.collection, filter: find.filter, sort: find.sort, scope: raw.scope, limit } };
}
