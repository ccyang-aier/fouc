import { BSON, MongoBulkWriteError, type Document, type MongoClient } from 'mongodb';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import {
  MONGO_DOCUMENT_TRANSFER_LIMITS as LIMITS,
  type MongoDocumentImportPreview,
  type MongoDocumentImportStatus,
} from '@fouc/shared/mongo-document-transfer';
import { mongoValueType } from '@fouc/shared/mongo';
import { DatabaseInputError } from './input-error';
import { mongoBsonSignature, mongoCollectionSnapshot, mongoIndexSnapshot, MONGO_MUTATION_READ } from './mongo-mutation-snapshot';
import { parseMongoDocumentImport, type ParsedMongoImport } from './mongo-document-input';

type Plan = {
  parsed: ParsedMongoImport;
  preview: MongoDocumentImportPreview;
  signature: string;
  expires: number;
  status: MongoDocumentImportStatus;
  cancel: AbortController;
};

async function collectionSignature(client: MongoClient, database: string, collection: string, signal?: AbortSignal): Promise<string> {
  const metadata = await mongoCollectionSnapshot(client, database, collection, signal);
  if (!metadata || metadata.type !== 'collection' || metadata.options?.timeseries || !metadata.info?.uuid) {
    throw new DatabaseInputError('文档追加仅支持已存在的普通集合；视图、时间序列与缺少 UUID 的集合不能导入');
  }
  const indexes = await mongoIndexSnapshot(client, database, collection, signal);
  return mongoBsonSignature({ metadata, indexes });
}

function previewFields(documents: Document[]): MongoDocumentImportPreview['fields'] {
  const fields = new Map<string, { types: Set<string>; present: number }>();
  for (const document of documents) {
    for (const [key, value] of Object.entries(document)) {
      const path = '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
      const field = fields.get(path) ?? { types: new Set<string>(), present: 0 };
      if (!fields.has(path) && fields.size >= 50) continue;
      field.present++;
      field.types.add(mongoValueType(JSON.parse(BSON.EJSON.stringify({ value }, { relaxed: false })).value));
      fields.set(path, field);
    }
  }
  return [...fields].map(([path, value]) => ({ path, types: [...value.types], present: value.present }));
}

async function existingIds(client: MongoClient, parsed: ParsedMongoImport, signal?: AbortSignal): Promise<number> {
  const collection = client.db(parsed.input.database).collection(parsed.input.collection);
  let existing = 0, start = 0;
  while (start < parsed.documents.length) {
    signal?.throwIfAborted();
    const ids: unknown[] = [];
    let bytes = 0;
    while (start < parsed.documents.length && ids.length < LIMITS.batchDocuments) {
      const id = parsed.documents[start]._id;
      const length = BSON.serialize({ value: id }).byteLength;
      if (ids.length && bytes + length > 4 * 1024 * 1024) break;
      ids.push(id);
      bytes += length;
      start++;
    }
    // The server performs BSON numeric equality; a JS string comparison would miscount Int32/Int64 IDs.
    const filter: Document = { _id: { $in: ids } }; // IDs are validated BSON values, including embedded documents and null.
    const cursor = collection.find(filter, { ...MONGO_MUTATION_READ, projection: { _id: 1 }, collation: { locale: 'simple' }, signal });
    try { for await (const _document of cursor) { void _document; existing++; } }
    finally { await cursor.close(); }
  }
  return existing;
}

/** Session-local plans are consumed before execution. Cancellation stops at an acknowledged batch boundary. */
export class MongoDocumentImportPlans {
  private readonly plans = new Map<string, Plan>();
  private readonly preparing = new Set<AbortController>();

  clear(): void {
    for (const controller of this.preparing) controller.abort(new Error('连接或写入权限已变化，请重新预览'));
    for (const plan of this.plans.values()) plan.cancel.abort(new Error('MongoDB 连接已关闭'));
    this.plans.clear();
  }

  private get(id: string): Plan {
    const plan = this.plans.get(id);
    if (!plan || Date.now() > plan.expires) {
      if (plan?.status.state !== 'running') this.plans.delete(id);
      if (plan?.status.state === 'running') return plan;
      throw new DatabaseInputError('导入计划已失效，请重新读取文件并预览');
    }
    return plan;
  }

  status(id: string): MongoDocumentImportStatus {
    const status = this.get(id).status;
    return { ...status, insertedIds: status.insertedIds.map(item => ({ ...item })), error: status.error ? { ...status.error } : null };
  }

  cancel(id: string): MongoDocumentImportStatus {
    const plan = this.get(id);
    plan.status.cancelRequested = true;
    plan.cancel.abort(new Error('用户取消了文档追加'));
    if (plan.status.state === 'ready') {
      plan.status.state = 'cancelled';
      plan.parsed.documents = [];
    }
    return this.status(id);
  }

  discard(id: string): void {
    const plan = this.plans.get(id);
    if (plan?.status.state === 'running') { this.cancel(id); return; }
    this.plans.delete(id);
  }

  async prepare(client: MongoClient, input: unknown, assertCurrent: () => void, signal?: AbortSignal): Promise<MongoDocumentImportPreview> {
    for (const [id, plan] of this.plans) if (plan.expires < Date.now() && plan.status.state !== 'running') this.plans.delete(id);
    if (this.plans.size + this.preparing.size >= 4) throw new DatabaseInputError('导入预览最多保留 4 份，请关闭旧预览');
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    this.preparing.add(controller);
    try {
      assertCurrent();
      const parsed = await parseMongoDocumentImport(input, controller.signal);
      const retained = [...this.plans.values()].reduce((total, plan) => total + (plan.parsed.documents.length ? plan.parsed.bytes : 0), 0);
      if (retained + parsed.bytes > 64 * 1024 * 1024) throw new DatabaseInputError('当前连接中的待执行导入文档合计最多 64 MiB，请关闭旧预览');
      const { database, collection } = parsed.input;
      const signature = await collectionSignature(client, database, collection, controller.signal);
      const existing = await existingIds(client, parsed, controller.signal);
      controller.signal.throwIfAborted();
      assertCurrent();
      // Recheck after asynchronous reads, so concurrent previews cannot exceed the retained-memory bound.
      const currentBytes = [...this.plans.values()].reduce((total, plan) => total + (plan.parsed.documents.length ? plan.parsed.bytes : 0), 0);
      if (currentBytes + parsed.bytes > 64 * 1024 * 1024) throw new DatabaseInputError('当前连接导入预览已达到 64 MiB 上限');
      const planId = crypto.randomUUID(), expires = Date.now() + LIMITS.planMs;
      const warnings = [
        '完整文件已验证；服务端读取集合 UUID、索引和已有 ID，预览未执行写入。集合校验器与其他唯一索引由实际写入判定。',
        '有序追加遇到第一个错误即停止。已成功的批次不会回滚；取消仅停止后续批次。',
        '应用不会自动重试；MongoDB 协议级 retryWrites 遵循本连接的高级参数。',
      ];
      if (existing) warnings.push(`发现 ${existing} 个已存在的 _id，追加可能在重复 ID 处停止；不会覆盖已有文档。`);
      const preview: MongoDocumentImportPreview = {
        database, collection, planId, expiresAt: new Date(expires).toISOString(), documents: parsed.documents.length,
        bytes: parsed.bytes, idPolicy: parsed.input.idPolicy, generatedIds: parsed.generatedIds, existingIds: existing,
        samples: parsed.documents.slice(0, LIMITS.sampleDocuments).map(document => BSON.EJSON.stringify(document, { relaxed: false })),
        fields: previewFields(parsed.documents), warnings,
      };
      this.plans.set(planId, {
        parsed, preview, signature, expires, cancel: new AbortController(),
        status: { planId, state: 'ready', total: parsed.documents.length, inserted: 0, processed: 0, insertedIds: [], error: null, uncertainDocuments: 0, cancelRequested: false },
      });
      return preview;
    } finally { this.preparing.delete(controller); signal?.removeEventListener('abort', abort); }
  }

  async commit(client: MongoClient, id: string, assertWritable: () => void, signal?: AbortSignal): Promise<MongoDocumentImportStatus> {
    const plan = this.get(id), status = plan.status;
    if (status.state !== 'ready') throw new DatabaseInputError('导入计划已使用，不能重复提交或自动重试');
    assertWritable();
    status.state = 'running'; // Consume the plan before any asynchronous call.
    plan.expires = Date.now() + 30 * 60_000;
    const abort = () => { status.cancelRequested = true; plan.cancel.abort(signal?.reason); };
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    let inFlight = 0;
    try {
      if (plan.cancel.signal.aborted) { status.state = 'cancelled'; return this.status(id); }
      const { database, collection } = plan.parsed.input;
      if (await collectionSignature(client, database, collection, plan.cancel.signal) !== plan.signature) throw new DatabaseInputError('集合或索引元数据已变化，请重新预览；尚未执行写入');
      const target = client.db(database).collection(collection);
      for (let start = 0; start < plan.parsed.documents.length; start += LIMITS.batchDocuments) {
        if (plan.cancel.signal.aborted) { status.state = 'cancelled'; break; }
        assertWritable();
        const batch = plan.parsed.documents.slice(start, start + LIMITS.batchDocuments);
        inFlight = batch.length;
        try {
          // Do not abort an in-flight write: wait for its acknowledgement, then stop subsequent batches.
          const result = await target.insertMany(batch, { ordered: true, writeConcern: { w: 'majority', wtimeoutMS: 10_000 }, timeoutMS: 30_000 });
          if (!result.acknowledged) throw new Error('MongoDB 未确认本批次写入');
          for (const [index, insertedId] of Object.entries(result.insertedIds)) status.insertedIds.push({ row: start + Number(index), idEjson: BSON.EJSON.stringify({ _id: insertedId }, { relaxed: false }) });
          status.inserted += Object.keys(result.insertedIds).length;
          status.processed = start + batch.length;
          inFlight = 0;
        } catch (error) {
          const writeErrors = error instanceof MongoBulkWriteError ? (Array.isArray(error.writeErrors) ? error.writeErrors : [error.writeErrors]) : [];
          if (error instanceof MongoBulkWriteError && !error.result.getWriteConcernError()) {
            // Native ordered results filter IDs after the first rejected row. Never use preallocated IDs as proof.
            const confirmed = Object.entries(error.result.insertedIds).slice(0, error.result.insertedCount);
            for (const [index, insertedId] of confirmed) status.insertedIds.push({ row: start + Number(index), idEjson: BSON.EJSON.stringify({ _id: insertedId }, { relaxed: false }) });
            status.inserted += error.result.insertedCount;
            status.processed = start + error.result.insertedCount;
            inFlight = batch.length - error.result.insertedCount;
            if (writeErrors.length) {
              const failure = writeErrors[0];
              status.processed = start + failure.index + 1;
              status.error = { row: start + failure.index, code: failure.code, message: failure.errmsg };
              status.state = status.inserted ? 'partial' : 'failed';
              inFlight = 0;
              break;
            }
          }
          throw error;
        }
        await yieldTurn();
      }
      if (status.state === 'running') status.state = status.cancelRequested && status.processed < status.total ? 'cancelled' : 'complete';
    } catch (error) {
      status.state = inFlight ? 'unknown' : plan.cancel.signal.aborted ? 'cancelled' : status.inserted ? 'partial' : 'failed';
      status.uncertainDocuments = inFlight;
      status.error = { row: null, code: null, message: error instanceof Error ? error.message : String(error) };
    } finally {
      signal?.removeEventListener('abort', abort);
      plan.parsed.documents = []; // Keep compact results for refresh/recovery; release the validated source documents.
    }
    return this.status(id);
  }
}
