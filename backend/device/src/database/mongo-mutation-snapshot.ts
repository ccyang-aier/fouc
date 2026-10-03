import { BSON, type Document, type MongoClient } from 'mongodb';
import { createHash } from 'node:crypto';
import { DatabaseInputError } from './input-error';

export const MONGO_MUTATION_READ = { promoteValues: false, promoteLongs: false, maxTimeMS: 30_000 } as const;
export function mongoBsonSignature(value: Document): string { return createHash('sha256').update(BSON.serialize(value)).digest('hex'); }
export async function mongoCollectionSnapshot(client: MongoClient, database: string, collection: string, signal?: AbortSignal): Promise<Document | null> {
  const cursor = client.db(database).listCollections({ name: collection }, { ...MONGO_MUTATION_READ, signal });
  try { return await cursor.next(); } finally { await cursor.close(); }
}
export async function mongoIndexSnapshot(client: MongoClient, database: string, collection: string, signal?: AbortSignal): Promise<Document[]> {
  const options = { ...MONGO_MUTATION_READ, signal };
  const cursor = client.db(database).collection(collection).listIndexes(options);
  try { return (await cursor.toArray() as Document[]).sort((a, b) => String(a.name).localeCompare(String(b.name))); }
  finally { await cursor.close(); }
}
function bsonType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof BSON.Int32) return 'int'; if (value instanceof BSON.Timestamp) return 'timestamp'; if (value instanceof BSON.Long) return 'long';
  if (value instanceof BSON.Double || typeof value === 'number') return 'double'; if (value instanceof BSON.Decimal128) return 'decimal';
  if (value instanceof BSON.ObjectId) return 'objectId'; if (value instanceof BSON.Binary) return 'binData';
  if (value instanceof BSON.Timestamp) return 'timestamp'; if (value instanceof Date) return 'date';
  if (value instanceof BSON.BSONRegExp || value instanceof RegExp) return 'regex';
  if (value instanceof BSON.Code) return value.scope ? 'javascriptWithScope' : 'javascript';
  if (value instanceof BSON.MinKey) return 'minKey'; if (value instanceof BSON.MaxKey) return 'maxKey';
  if (value instanceof BSON.BSONSymbol) return 'symbol';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : typeof value === 'boolean' ? 'bool' : typeof value;
}
/** Numeric BSON types compare as equivalent in MongoDB, so $$ROOT equality also needs nested type guards. */
export function mongoDocumentCasFilter(original: Document): Document {
  let nodes = 0;
  const guard = (value: unknown, expression: unknown, depth: number): Document => {
    if (depth > 24 || ++nodes > 4096) throw new DatabaseInputError('当前文档写入最多支持 24 层 / 4096 个值，请缩小文档结构');
    const type = bsonType(value), children: Document[] = [];
    if (type === 'object') for (const [field, child] of Object.entries(value as Document)) children.push(guard(child, { $getField: { field: { $literal: field }, input: '$$v' } }, depth + 1));
    if (type === 'array') (value as unknown[]).forEach((child, index) => children.push(guard(child, { $arrayElemAt: ['$$v', index] }, depth + 1)));
    return { $let: { vars: { v: expression }, in: { $cond: [{ $eq: [{ $type: '$$v' }, type] }, children.length ? { $and: children } : true, false] } } };
  };
  const filter: Document = { _id: original._id, $expr: { $and: [{ $eq: ['$$ROOT', { $literal: original }] }, guard(original, '$$ROOT', 0)] } };
  if (BSON.serialize(filter).byteLength > 4 * 1024 * 1024) throw new DatabaseInputError('文档冲突保护表达式超过 4 MiB，请缩小文档结构');
  return filter;
}
