import { BSON, type Document } from 'mongodb';
import type { MongoMutationInput } from '@fouc/shared/mongo-mutation';
import { DatabaseInputError } from './input-error';
import { mongoEjson, mongoNamespace, mongoObject } from './mongo-input';
import { assertMongoReadValue } from './mongo-read-policy';
import { mongoCanonical } from './drivers/mongo-driver';

const OPERATIONS = new Set(['insert-document', 'replace-document', 'delete-document', 'create-collection', 'drop-collection', 'create-index', 'drop-index']);
const INDEX_DIRECTIONS = new Set(['1', '-1', 'text', 'hashed', '2d', '2dsphere']);
function numeric(value: unknown): unknown { return value instanceof BSON.Int32 || value instanceof BSON.Double || value instanceof BSON.Long ? Number(value.toString()) : value; }
function boundedName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || Buffer.byteLength(value) > 512) throw new DatabaseInputError(`${label}须为最多 512 字节的非空名称`);
  return value;
}
export function mongoMutationInput(value: unknown): MongoMutationInput {
  const input = mongoObject(value), namespace = mongoNamespace(input), operation = input.operation;
  if (['admin', 'config', 'local'].includes(namespace.database)) throw new DatabaseInputError('系统数据库未开放集合或文档写入');
  if (typeof operation !== 'string' || !OPERATIONS.has(operation)) throw new DatabaseInputError('MongoDB 写入操作无效');
  const allowed = ['database', 'collection', 'operation'];
  if (operation === 'insert-document' || operation === 'replace-document') allowed.push('documentEjson');
  if (operation === 'replace-document' || operation === 'delete-document') allowed.push('originalEjson');
  if (operation === 'create-collection' || operation === 'create-index') allowed.push('optionsEjson');
  if (operation === 'create-index') allowed.push('keysEjson');
  if (operation === 'drop-index') allowed.push('indexName');
  for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new DatabaseInputError(`写入参数未开放：${key}`);
  const required = (key: string): string => {
    if (typeof input[key] !== 'string') throw new DatabaseInputError(`${key} 须提供完整 Extended JSON`);
    return mongoCanonical(mongoEjson(input[key]));
  };
  const options = (): string | undefined => input.optionsEjson === undefined ? undefined : required('optionsEjson');
  switch (operation) {
    case 'insert-document': return { ...namespace, operation, documentEjson: required('documentEjson') };
    case 'replace-document': return { ...namespace, operation, documentEjson: required('documentEjson'), originalEjson: required('originalEjson') };
    case 'delete-document': return { ...namespace, operation, originalEjson: required('originalEjson') };
    case 'create-collection': return { ...namespace, operation, optionsEjson: options() };
    case 'drop-collection': return { ...namespace, operation };
    case 'create-index': return { ...namespace, operation, keysEjson: required('keysEjson'), optionsEjson: options() };
    case 'drop-index': {
      const indexName = boundedName(input.indexName, '索引名称');
      if (indexName === '*' || indexName === '_id_') throw new DatabaseInputError('不能删除 _id 主索引或使用通配符');
      return { ...namespace, operation, indexName };
    }
    default: throw new DatabaseInputError('MongoDB 写入操作无效');
  }
}
export function mutationDocument(text: string): Document {
  const document = mongoEjson(text);
  if (Object.keys(document).some(key => key.startsWith('$'))) throw new DatabaseInputError('文档须为完整替换内容，不能包含顶层更新运算符');
  if ('_id' in document && (Array.isArray(document._id) || document._id === undefined || document._id instanceof BSON.BSONRegExp)) throw new DatabaseInputError('_id 不能为数组、Undefined 或正则表达式');
  return document;
}
export function mongoCreateCollectionOptions(text?: string): Document {
  const options = mongoEjson(text), allowed = new Set(['capped', 'size', 'max', 'validator', 'validationLevel', 'validationAction', 'collation']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new DatabaseInputError(`当前集合选项未开放：${key}`);
  if (options.capped !== undefined && typeof options.capped !== 'boolean') throw new DatabaseInputError('capped 须为布尔值');
  for (const key of ['size', 'max']) if (options[key] !== undefined) {
    const value = numeric(options[key]);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new DatabaseInputError(`${key} 须为正安全整数`);
    if (!options.capped) throw new DatabaseInputError(`${key} 仅用于 capped 集合`);
  }
  if (options.capped && options.size === undefined) throw new DatabaseInputError('capped 集合必须指定 size');
  if (options.validator !== undefined) { mongoObject(options.validator); assertMongoReadValue(options.validator); }
  if (options.validationLevel !== undefined && !['off', 'moderate', 'strict'].includes(options.validationLevel)) throw new DatabaseInputError('validationLevel 无效');
  if (options.validationAction !== undefined && !['warn', 'error'].includes(options.validationAction)) throw new DatabaseInputError('validationAction 无效');
  if (options.collation !== undefined) mongoObject(options.collation);
  return options;
}
export function mongoCreateIndexSpec(keysText: string, optionsText?: string): { keys: Document; options: Document; name: string } {
  const keys = mongoEjson(keysText), options = mongoEjson(optionsText), entries = Object.entries(keys);
  if (!entries.length || entries.length > 32) throw new DatabaseInputError('索引须包含 1–32 个字段');
  for (const [field, direction] of entries) {
    boundedName(field, '索引字段');
    if (!INDEX_DIRECTIONS.has(String(numeric(direction)))) throw new DatabaseInputError(`索引方向无效：${field}`);
    if (typeof direction !== 'string') keys[field] = numeric(direction);
  }
  const allowed = new Set(['name', 'unique', 'sparse', 'hidden', 'expireAfterSeconds', 'partialFilterExpression', 'collation', 'weights', 'default_language', 'language_override', 'wildcardProjection']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new DatabaseInputError(`索引选项未开放：${key}`);
  for (const key of ['unique', 'sparse', 'hidden']) if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new DatabaseInputError(`${key} 须为布尔值`);
  if (options.sparse && options.partialFilterExpression) throw new DatabaseInputError('sparse 与 partialFilterExpression 不能同时使用');
  if (options.unique && entries.some(([, value]) => value === 'hashed')) throw new DatabaseInputError('hashed 索引不能为 unique');
  if (options.expireAfterSeconds !== undefined) {
    const ttl = numeric(options.expireAfterSeconds);
    if (typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl < 0 || ttl > 2147483647 || entries.length !== 1 || ![1, -1].includes(numeric(entries[0][1]) as number)) throw new DatabaseInputError('TTL 索引须为单字段升/降序，expireAfterSeconds 须为 0–2147483647 的整数');
  }
  if (options.partialFilterExpression) { mongoObject(options.partialFilterExpression); assertMongoReadValue(options.partialFilterExpression); }
  for (const key of ['collation', 'weights', 'wildcardProjection']) if (options[key] !== undefined) mongoObject(options[key]);
  for (const key of ['default_language', 'language_override']) if (options[key] !== undefined && typeof options[key] !== 'string') throw new DatabaseInputError(`${key} 须为字符串`);
  const name = options.name === undefined ? entries.map(([field, direction]) => `${field}_${String(numeric(direction))}`).join('_') : boundedName(options.name, '索引名称');
  if (name === '_id_' || (entries.length === 1 && entries[0][0] === '_id' && numeric(entries[0][1]) === 1)) throw new DatabaseInputError('_id 主索引由 MongoDB 管理');
  options.name = name;
  return { keys, options, name };
}
