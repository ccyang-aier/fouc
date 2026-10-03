import { BSON } from 'mongodb';
import { MONGO_GRIDFS_LIMITS } from '@fouc/shared/mongo-gridfs';
import { DatabaseInputError } from './input-error';
import { mongoCollection, mongoDatabase, mongoEjson, mongoInteger, mongoObject } from './mongo-input';
import { assertMongoReadValue } from './mongo-read-policy';

export type MongoGridFsIdentity = string | number | boolean | BSON.ObjectId | BSON.Long | BSON.Int32 | BSON.Double | BSON.Decimal128 | BSON.Binary | Date;

function isGridFsIdentity(id: unknown): id is MongoGridFsIdentity {
  return typeof id === 'string' || typeof id === 'number' || typeof id === 'boolean'
    || id instanceof BSON.ObjectId || id instanceof BSON.Long || id instanceof BSON.Int32
    || id instanceof BSON.Double || id instanceof BSON.Decimal128 || id instanceof BSON.Binary || id instanceof Date;
}

export function mongoGridFsNamespace(value: unknown) {
  const input = mongoObject(value);
  const database = mongoDatabase(input.database);
  const bucket = mongoCollection(input.bucket);
  if (Buffer.byteLength(bucket) > MONGO_GRIDFS_LIMITS.bucketNameBytes) throw new DatabaseInputError('GridFS bucket 名称超过200字节');
  if (Buffer.byteLength(`${database}.${bucket}.chunks`) > 255) throw new DatabaseInputError('GridFS 完整命名空间超过255字节');
  return { database, bucket };
}

export function mongoGridFsListInput(value: unknown) {
  const namespace = mongoGridFsNamespace(value);
  const input = mongoObject(value);
  const filter = mongoEjson(input.filter);
  assertMongoReadValue(filter);
  const sort = mongoEjson(input.sort);
  for (const [field, direction] of Object.entries(sort)) {
    const numeric = direction instanceof BSON.Int32 || direction instanceof BSON.Double ? direction.valueOf() : direction;
    if (!field || field.includes('\0') || ![1, -1].includes(numeric as number)) throw new DatabaseInputError('GridFS 排序仅支持字段 1 / -1');
    sort[field] = numeric;
  }
  if (!Object.keys(sort).length) sort.uploadDate = -1;
  if (!('_id' in sort)) sort._id = -1;
  return {
    ...namespace,
    filter,
    sort,
    offset: mongoInteger(input.offset, 0, 0, 1_000_000),
    limit: mongoInteger(input.limit, MONGO_GRIDFS_LIMITS.defaultPage, 1, MONGO_GRIDFS_LIMITS.maxPage),
  };
}

export function mongoGridFsFileInput(value: unknown) {
  const namespace = mongoGridFsNamespace(value);
  const input = mongoObject(value);
  if (typeof input.idEjson !== 'string' || !input.idEjson.trim() || input.idEjson.length > 8192) throw new DatabaseInputError('GridFS 文件身份无效');
  const wrapped = mongoEjson(`{"value":${input.idEjson}}`);
  const id: unknown = wrapped.value;
  if (!isGridFsIdentity(id)) throw new DatabaseInputError('当前 GridFS 下载仅支持实际 BSON 标量文件身份');
  return { ...namespace, id };
}
