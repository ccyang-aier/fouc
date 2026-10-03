import { BSON, type Document, type MongoClient } from 'mongodb';
import { MONGO_MUTATION_TITLES, type MongoMutationInput, type MongoMutationReview, type MongoMutationSummary } from '@fouc/shared/mongo-mutation';
import { DatabaseInputError } from './input-error';
import { mongoEjson } from './mongo-input';
import { mongoCanonical, mongoNumeric } from './drivers/mongo-driver';
import { mongoCreateCollectionOptions, mongoCreateIndexSpec, mongoMutationInput, mutationDocument } from './mongo-mutation-input';
import { MONGO_MUTATION_READ, mongoBsonSignature, mongoCollectionSnapshot, mongoDocumentCasFilter, mongoIndexSnapshot } from './mongo-mutation-snapshot';

export type MongoMutationPlan = {
  readonly input: MongoMutationInput; readonly metadataSignature: string | null;
  readonly original: Document | null; readonly candidate: Document | null; readonly casFilter: Document | null;
  readonly keys: Document | null; readonly options: Document | null; readonly indexesSignature: string | null;
  readonly review: MongoMutationReview;
};
export class MongoMutationConflictError extends Error { constructor(message = '目标内容已在预览后变化，请刷新并重新生成计划。') { super(message); this.name = 'MongoMutationConflictError'; } }
export class MongoMutationOutcomeUnknownError extends Error { constructor(message: string) { super(`写入结果未确认，请刷新目标核对后再决定是否重试；${message}`); this.name = 'MongoMutationOutcomeUnknownError'; } }

async function originalDocument(client: MongoClient, input: MongoMutationInput, original: Document, signal?: AbortSignal): Promise<Document> {
  if (!Object.hasOwn(original, '_id')) throw new DatabaseInputError('编辑 / 删除需要含 _id 的完整原始文档，请先取消字段投影并重新读取。');
  const current = await client.db(input.database).collection(input.collection).findOne({ _id: original._id }, { ...MONGO_MUTATION_READ, collation: { locale: 'simple' }, signal });
  if (!current || mongoBsonSignature(current) !== mongoBsonSignature(original)) throw new MongoMutationConflictError('完整 BSON 原始文档与数据库不一致，请刷新并取消字段投影后重试。');
  return current;
}
function metadataSignature(value: Document | null): string | null { return value ? mongoBsonSignature(value) : null; }
async function collectionCount(client: MongoClient, input: MongoMutationInput, signal?: AbortSignal): Promise<string | null> {
  try { const stats = await client.db(input.database).command({ collStats: input.collection, scale: 1 }, { ...MONGO_MUTATION_READ, signal }); return mongoNumeric(stats.count); }
  catch { signal?.throwIfAborted(); return null; }
}
export async function prepareMongoMutation(client: MongoClient, value: unknown, signal?: AbortSignal): Promise<{ plan: MongoMutationPlan; review: MongoMutationReview }> {
  const input = mongoMutationInput(value), operation = input.operation;
  signal?.throwIfAborted();
  const metadata = await mongoCollectionSnapshot(client, input.database, input.collection, signal);
  if (operation === 'create-collection' && metadata) throw new DatabaseInputError('集合已存在，请使用新的集合名称');
  if (operation !== 'create-collection' && !metadata) throw new DatabaseInputError('目标集合不存在，请先创建集合');
  if (metadata?.type === 'view' && operation !== 'drop-collection') throw new DatabaseInputError('视图不能进行文档或索引写入');
  if (metadata?.type === 'timeseries' && ['replace-document', 'delete-document'].includes(operation)) throw new DatabaseInputError('当前时间序列集合仅开放新增文档，替换 / 删除留待专门流程');
  let original: Document | null = null, candidate: Document | null = null, casFilter: Document | null = null;
  let keys: Document | null = null, options: Document | null = null, indexesSignature: string | null = null;
  const review: MongoMutationReview = { database: input.database, collection: input.collection, operation, title: MONGO_MUTATION_TITLES[operation], destructive: operation === 'delete-document' || operation === 'drop-collection' || operation === 'drop-index', before: null, after: null, documentId: null, indexName: null, affectedCount: null, warnings: [] };
  if (operation === 'insert-document') {
    candidate = mutationDocument(input.documentEjson);
    if (!Object.hasOwn(candidate, '_id')) candidate = { _id: new BSON.ObjectId(), ...candidate };
    const exists = await client.db(input.database).collection(input.collection).findOne({ _id: candidate._id }, { ...MONGO_MUTATION_READ, projection: { _id: 1 }, collation: { locale: 'simple' }, signal });
    if (exists) throw new DatabaseInputError('相同 BSON _id 的文档已存在，新增不会覆盖它');
    review.after = mongoCanonical(candidate); review.documentId = mongoCanonical({ _id: candidate._id }); review.affectedCount = '1';
  }
  if (operation === 'replace-document' || operation === 'delete-document') {
    original = await originalDocument(client, input, mutationDocument(input.originalEjson), signal);
    casFilter = mongoDocumentCasFilter(original);
    review.before = mongoCanonical(original); review.documentId = mongoCanonical({ _id: original._id }); review.affectedCount = '1';
    if (operation === 'replace-document') {
      candidate = mutationDocument(input.documentEjson);
      if (Object.hasOwn(candidate, '_id') && mongoBsonSignature({ _id: candidate._id }) !== mongoBsonSignature({ _id: original._id })) throw new DatabaseInputError('_id 不可在替换流程中修改');
      candidate = { _id: original._id, ...candidate };
      review.after = mongoCanonical(candidate);
      review.warnings.push('替换会移除新文档中未保留的字段。_id 的 BSON 值与类型保持不变。');
    }
    review.warnings.push('提交时以完整文档和嵌套 BSON 类型进行原子冲突检查；该保护需要 MongoDB 5.0 或更高版本。');
  }
  if (operation === 'create-collection') { options = mongoCreateCollectionOptions(input.optionsEjson); review.after = mongoCanonical({ create: input.collection, ...options }); review.affectedCount = '0'; }
  if (operation === 'create-index' || operation === 'drop-index' || operation === 'drop-collection') {
    const indexes = metadata?.type === 'view' ? [] : await mongoIndexSnapshot(client, input.database, input.collection, signal);
    indexesSignature = mongoBsonSignature({ indexes });
    if (operation === 'create-index') {
      const spec = mongoCreateIndexSpec(input.keysEjson, input.optionsEjson); keys = spec.keys; options = spec.options; review.indexName = spec.name;
      if (indexes.some(index => index.name === spec.name)) throw new DatabaseInputError('相同名称的索引已存在，请选择其他名称');
      review.after = mongoCanonical({ key: keys, ...options }); review.affectedCount = '1';
      if (options.unique) review.warnings.push('唯一索引会检查现有文档；重复键会导致原生索引创建失败。');
      if (options.expireAfterSeconds !== undefined) review.warnings.push('TTL 索引创建后，MongoDB 会按规则自动删除过期文档。');
    } else if (operation === 'drop-index') {
      const index = indexes.find(item => item.name === input.indexName);
      if (!index) throw new DatabaseInputError('目标索引不存在');
      review.indexName = input.indexName; review.before = mongoCanonical(index); review.affectedCount = '1';
      review.warnings.push('删除后查询计划与性能可能改变。原生 MongoDB 会拒绝删除最后一个必需的分片键索引。');
    } else {
      review.before = mongoCanonical({ metadata, indexes }); review.affectedCount = await collectionCount(client, input, signal);
      review.warnings.push(`删除集合会移除全部文档及索引${review.affectedCount === null ? '（文档数未知）' : `（预览时 ${review.affectedCount} 个文档）`}。`);
    }
    review.warnings.push('集合与索引 DDL 在提交前复核元数据；外部客户端在复核与执行之间的并发变更不受事务或回滚保护。');
  }
  const plan: MongoMutationPlan = { input, metadataSignature: metadataSignature(metadata), original, candidate, casFilter, keys, options, indexesSignature, review };
  return { plan, review };
}

function assertWriteResult(result: Document): void {
  if (Array.isArray(result.writeErrors) && result.writeErrors.length) throw new Error(`MongoDB 写入失败：${String(result.writeErrors[0].errmsg ?? result.writeErrors[0].code)}`);
  if (result.writeConcernError) throw new MongoMutationOutcomeUnknownError(String(result.writeConcernError.errmsg ?? '写入确认超时'));
}
export async function commitMongoMutation(client: MongoClient, plan: MongoMutationPlan, signal?: AbortSignal): Promise<MongoMutationSummary> {
  signal?.throwIfAborted();
  const { input, review } = plan, start = performance.now();
  const metadata = await mongoCollectionSnapshot(client, input.database, input.collection, signal);
  if (metadataSignature(metadata) !== plan.metadataSignature) throw new MongoMutationConflictError('集合元数据 / UUID 已在预览后变化，请重新生成计划。');
  if (plan.indexesSignature !== null) {
    const indexes = metadata?.type === 'view' ? [] : await mongoIndexSnapshot(client, input.database, input.collection, signal);
    if (mongoBsonSignature({ indexes }) !== plan.indexesSignature) throw new MongoMutationConflictError('索引定义已在预览后变化，请重新生成计划。');
  }
  if (plan.original) await originalDocument(client, input, plan.original, signal);
  if (input.operation === 'drop-collection' && review.affectedCount !== null && await collectionCount(client, input, signal) !== review.affectedCount) throw new MongoMutationConflictError('集合文档数量已在预览后变化，请重新生成删除计划。');
  const db = client.db(input.database), writeConcern = { w: 'majority', wtimeout: 10_000 };
  let command: Document;
  switch (input.operation) {
    case 'insert-document': command = { insert: input.collection, documents: [plan.candidate], ordered: true, writeConcern }; break;
    case 'replace-document': command = { update: input.collection, updates: [{ q: plan.casFilter, u: plan.candidate, multi: false, upsert: false, collation: { locale: 'simple' } }], ordered: true, writeConcern }; break;
    case 'delete-document': command = { delete: input.collection, deletes: [{ q: plan.casFilter, limit: 1, collation: { locale: 'simple' } }], ordered: true, writeConcern }; break;
    case 'create-collection': command = { create: input.collection, ...plan.options, writeConcern }; break;
    case 'drop-collection': command = { drop: input.collection, writeConcern }; break;
    case 'create-index': command = { createIndexes: input.collection, indexes: [{ key: plan.keys, ...plan.options }], writeConcern }; break;
    case 'drop-index': command = { dropIndexes: input.collection, index: input.indexName, writeConcern }; break;
  }
  command.maxTimeMS = 30_000;
  let result: Document;
  try { result = await db.command(command, { ...MONGO_MUTATION_READ, signal }); assertWriteResult(result); }
  catch (error) {
    if (error instanceof MongoMutationOutcomeUnknownError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (signal?.aborted || /timeout|timed out|socket|connection.*(?:closed|lost)|ECONNRESET|EPIPE|network/i.test(message)) throw new MongoMutationOutcomeUnknownError(message);
    throw error;
  }
  // drop acknowledges the namespace removal, but does not report a document count.
  let affectedCount = input.operation === 'drop-collection' ? null : review.affectedCount;
  if (input.operation.endsWith('-document')) {
    affectedCount = mongoNumeric(result.n);
    if (affectedCount !== '1') throw new MongoMutationConflictError('文档内容已变化或目标已被删除，写入未覆盖其他文档。');
  }
  return { database: input.database, collection: input.collection, operation: input.operation, affectedCount, documentId: review.documentId, indexName: review.indexName, elapsedMs: performance.now() - start };
}
