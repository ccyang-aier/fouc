import { BSON, type Document } from 'mongodb';
import { DatabaseInputError } from './input-error';
import { mongoCollection, mongoEjson, mongoObject } from './mongo-input';

const COMMANDS = new Set(['ping', 'buildInfo', 'dbStats', 'collStats', 'count', 'distinct', 'find', 'aggregate', 'listCollections', 'listIndexes', 'listDatabases', 'explain']);
const STAGES = new Set(['$addFields', '$bucket', '$bucketAuto', '$collStats', '$count', '$densify', '$documents', '$facet', '$fill', '$geoNear', '$graphLookup', '$group', '$indexStats', '$limit', '$lookup', '$match', '$project', '$redact', '$replaceRoot', '$replaceWith', '$sample', '$set', '$setWindowFields', '$skip', '$sort', '$sortByCount', '$unionWith', '$unset', '$unwind']);
const BLOCKED = new Set(['$where', '$function', '$accumulator', '$out', '$merge']);
/** DBX read-only classification tightened to avoid evaluating server-side JavaScript. */
export function assertMongoReadValue(value: unknown, depth = 0, budget = { count: 0 }): void {
  if (depth > 64 || ++budget.count > 50_000) throw new DatabaseInputError('MongoDB 查询结构过深或过大');
  if (!value || typeof value !== 'object' || value instanceof Date) return;
  // BSON scalar prototypes are atomic; a plain document cannot forge this exemption.
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== null && prototype !== Object.prototype && '_bsontype' in value) return;
  for (const [key, child] of Object.entries(value)) {
    if (BLOCKED.has(key)) throw new DatabaseInputError(`只读查询禁止 ${key}`);
    assertMongoReadValue(child, depth + 1, budget);
  }
}
export function assertMongoReadPipeline(value: unknown): Document[] {
  if (!Array.isArray(value) || value.length > 100) throw new DatabaseInputError('聚合 pipeline 须为最多 100 个阶段的数组');
  assertMongoReadValue(value);
  for (const raw of value) {
    const stage = mongoObject(raw), keys = Object.keys(stage);
    if (keys.length !== 1 || !STAGES.has(keys[0])) throw new DatabaseInputError(`当前只读工作台未开放聚合阶段 ${keys[0] ?? ''}`);
    const name = keys[0], body = stage[name];
    if (name === '$facet') for (const pipeline of Object.values(mongoObject(body))) assertMongoReadPipeline(pipeline);
    if (name === '$lookup' && body && typeof body === 'object' && 'pipeline' in body) assertMongoReadPipeline((body as Document).pipeline);
    if (name === '$unionWith' && body && typeof body === 'object' && 'pipeline' in body) assertMongoReadPipeline((body as Document).pipeline);
  }
  return value as Document[];
}
export function mongoReadCommand(text: unknown): { name: string; command: Document } {
  const command = mongoEjson(text), name = Object.keys(command)[0];
  if (!COMMANDS.has(name)) throw new DatabaseInputError(`当前 MongoDB 工作台只允许读取命令：${name || '空命令'}`);
  for (const key of ['$db', 'lsid', 'txnNumber', 'autocommit', 'startTransaction', 'writeConcern', '$clusterTime']) if (key in command) throw new DatabaseInputError(`命令不能覆盖会话参数 ${key}`);
  assertMongoReadValue(command);
  if (['find', 'collStats', 'count', 'distinct', 'listIndexes'].includes(name)) mongoCollection(command[name]);
  if (name === 'aggregate') {
    if (command.aggregate !== 1 && typeof command.aggregate !== 'object') mongoCollection(command.aggregate);
    else if (typeof command.aggregate === 'object' && Number(command.aggregate) !== 1) throw new DatabaseInputError('aggregate 须指定集合或 1');
    assertMongoReadPipeline(command.pipeline);
    if (command.bypassDocumentValidation || command.explain) throw new DatabaseInputError('聚合选项未开放，请使用 explain 命令查看计划');
  }
  if (name === 'explain') {
    const inner = mongoObject(command.explain), innerName = Object.keys(inner)[0];
    if (!['find', 'aggregate', 'count', 'distinct'].includes(innerName)) throw new DatabaseInputError('仅支持读取查询的 explain');
    mongoReadCommand(BSON.EJSON.stringify(inner, { relaxed: false }));
    if (command.verbosity !== undefined && command.verbosity !== 'queryPlanner') throw new DatabaseInputError('explain 仅开放 queryPlanner，避免执行原始查询');
    command.verbosity = 'queryPlanner';
  }
  return { name, command };
}
