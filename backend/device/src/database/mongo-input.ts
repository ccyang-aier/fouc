import { BSON, type Document } from 'mongodb';
import { MONGO_LIMITS, type MongoConnectionInput, type MongoFindInput, type MongoNamespace } from '@fouc/shared/mongo';
import { DatabaseInputError } from './input-error';
import { buildConnectionSource, parseConnectionSource } from '@fouc/shared/connection-options-url';

export function mongoObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('MongoDB 参数须为对象');
  return value as Record<string, unknown>;
}
export function mongoDatabase(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\s/\\.\0"$]/.test(value) || Buffer.byteLength(value) > 63) throw new DatabaseInputError('数据库名称无效');
  return value;
}
export function mongoCollection(value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.startsWith('system.') || value.includes('$') || Buffer.byteLength(value) > 220) throw new DatabaseInputError('集合名称无效，系统集合未开放');
  return value;
}
export function mongoNamespace(value: unknown): MongoNamespace {
  const input = mongoObject(value);
  return { database: mongoDatabase(input.database), collection: mongoCollection(input.collection) };
}
export function mongoInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new DatabaseInputError(`分页参数须为 ${min}–${max} 的整数`);
  return value;
}

/** Validate tokens before EJSON.parse; bare unsafe integers must never round silently. */
function assertJsonNumbers(text: string): void {
  let string = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (string) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') string = false; continue; }
    if (char === '"') { string = true; continue; }
    if (char === '-' || /\d/.test(char)) {
      const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index))?.[0];
      if (!token) continue;
      const number = Number(token);
      if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number)))
        throw new DatabaseInputError('超出安全整数范围的数值须使用 {"$numberLong":"…"} 或 {"$numberDecimal":"…"}，避免精度丢失');
      index += token.length - 1;
    }
  }
}
function assertEjsonScalars(value: unknown, depth = 0, budget = { count: 0 }): void {
  if (depth > 64 || ++budget.count > 50_000) throw new DatabaseInputError('Extended JSON 结构超过 64 层或 50000 个值');
  if (!value || typeof value !== 'object') return;
  const object = value as Record<string, unknown>, keys = Object.keys(object);
  if (keys.length === 1 && (keys[0] === '$numberLong' || keys[0] === '$numberInt')) {
    const raw = object[keys[0]];
    if (typeof raw !== 'string' || !/^-?\d+$/.test(raw) || raw.length > 21) throw new DatabaseInputError(`${keys[0]} 须为有效整数字符串`);
    const number = BigInt(raw), long = keys[0] === '$numberLong';
    if (number < (long ? -9223372036854775808n : -2147483648n) || number > (long ? 9223372036854775807n : 2147483647n)) throw new DatabaseInputError(`${keys[0]} 超出 BSON 整数范围`);
  }
  if (keys.length === 1 && keys[0] === '$binary') {
    const binary = mongoObject(object.$binary), base64 = binary.base64;
    if (typeof base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64) || Buffer.from(base64, 'base64').toString('base64') !== base64 || typeof binary.subType !== 'string' || !/^[0-9a-fA-F]{2}$/.test(binary.subType)) throw new DatabaseInputError('$binary 须使用有效 base64 和两位十六进制 subType');
  }
  if (keys.length === 1 && keys[0] === '$timestamp') {
    const timestamp = mongoObject(object.$timestamp);
    for (const key of ['t', 'i']) if (typeof timestamp[key] !== 'number' || !Number.isInteger(timestamp[key]) || (timestamp[key] as number) < 0 || (timestamp[key] as number) > 4294967295) throw new DatabaseInputError('$timestamp 的 t / i 须为无符号 32 位整数');
  }
  if (keys.length === 1 && keys[0] === '$date' && object.$date && typeof object.$date === 'object') {
    const date = mongoObject(object.$date), text = date.$numberLong;
    if (typeof text === 'string' && /^-?\d+$/.test(text) && text.length <= 21 && (BigInt(text) < -8640000000000000n || BigInt(text) > 8640000000000000n)) throw new DatabaseInputError('$date 超出标准 Date 可表示范围');
  }
  for (const child of Object.values(object)) assertEjsonScalars(child, depth + 1, budget);
}
export function mongoEjson(value: unknown, fallback = '{}'): Document {
  if (value === undefined) value = fallback;
  if (typeof value !== 'string' || Buffer.byteLength(value) > MONGO_LIMITS.inputBytes) throw new DatabaseInputError('Extended JSON 文本最多 256 KiB');
  assertJsonNumbers(value);
  try {
    assertEjsonScalars(JSON.parse(value));
    const result: unknown = BSON.EJSON.parse(value, { relaxed: false });
    const object = mongoObject(result);
    if ('_bsontype' in object) throw new DatabaseInputError('这里需要 Extended JSON 对象');
    return object;
  } catch (error) {
    if (error instanceof DatabaseInputError) throw error;
    throw new DatabaseInputError(`Extended JSON 无效：${error instanceof Error ? error.message : String(error)}`);
  }
}
export function mongoFindInput(value: unknown): MongoFindInput & { parsedFilter: Document; parsedSort: Document; parsedProjection: Document } {
  const input = mongoObject(value), namespace = mongoNamespace(value);
  const parsedFilter = mongoEjson(input.filter), parsedSort = mongoEjson(input.sort), parsedProjection = mongoEjson(input.projection);
  const numeric = (value: unknown) => value instanceof BSON.Int32 || value instanceof BSON.Double ? value.valueOf() : value;
  for (const [key, value] of Object.entries(parsedSort)) {
    const direction = numeric(value);
    if (!key || key.includes('\0') || (direction !== 1 && direction !== -1)) throw new DatabaseInputError('排序方向只能为 1 或 -1');
    parsedSort[key] = direction;
  }
  if (!Object.keys(parsedSort).length) parsedSort._id = 1;
  else if (!('_id' in parsedSort)) parsedSort._id = 1;
  let mode: number | null = null;
  for (const [key, value] of Object.entries(parsedProjection)) {
    const flag = numeric(value);
    if (!key || key.includes('\0') || ![0, 1, false, true].includes(flag as number | boolean)) throw new DatabaseInputError('当前投影仅支持字段 0 / 1 包含或排除');
    const include = flag ? 1 : 0;
    if (key !== '_id' && mode !== null && mode !== include) throw new DatabaseInputError('投影不能混用包含和排除（_id 除外）');
    if (key !== '_id') mode = include;
    parsedProjection[key] = include;
  }
  return { ...namespace, filter: typeof input.filter === 'string' ? input.filter : '{}', sort: typeof input.sort === 'string' ? input.sort : '{}', projection: typeof input.projection === 'string' ? input.projection : '{}', parsedFilter, parsedSort, parsedProjection, offset: mongoInteger(input.offset, 0, 0, MONGO_LIMITS.offset), limit: mongoInteger(input.limit, MONGO_LIMITS.defaultPage, 1, MONGO_LIMITS.page) };
}
export function mongoConnection(value: unknown): { uri: string; database: string; host: string } {
  const input = mongoObject(value) as MongoConnectionInput;
  if (input.provider !== undefined && input.provider !== 'mongodb') throw new DatabaseInputError('MongoDB Provider 无效');
  if ('tls' in input || 'ssl' in input) throw new DatabaseInputError('TLS 设置请使用统一的高级连接参数');
  let uri: string;
  if (input.uri !== undefined) {
    if (typeof input.uri !== 'string' || input.uri.length > 8192 || !/^mongodb(?:\+srv)?:\/\//.test(input.uri) || /[\r\n\0]/.test(input.uri)) throw new DatabaseInputError('MongoDB URI 无效');
    try { parseConnectionSource(input.uri, 'mongodb'); } catch (error) { throw new DatabaseInputError(error instanceof Error ? error.message : 'MongoDB URI 无效'); }
    uri = input.uri;
  } else {
    const host = input.host;
    if (typeof host !== 'string' || !host.trim() || host.length > 253 || /[\s/@?#\0]/.test(host)) throw new DatabaseInputError('MongoDB 主机无效');
    const port = mongoInteger(input.port, 27017, 1, 65535);
    if ((input.username !== undefined && typeof input.username !== 'string') || (input.password !== undefined && typeof input.password !== 'string')) throw new DatabaseInputError('MongoDB 身份参数无效');
    if (!input.username && input.password) throw new DatabaseInputError('密码需要用户名');
    try {
      uri = buildConnectionSource({ provider: 'mongodb', host: host.trim(), port, username: input.username ?? '', password: input.password ?? '', database: mongoDatabase(input.database || 'admin'), connectionOptions: input.connectionOptions ?? {}, mongo: { ...(input.mongo ?? { srv: false, hosts: [{ host: host.trim(), port }], directConnection: true }), authSource: input.authSource !== undefined ? mongoDatabase(input.authSource) : input.mongo?.authSource } }, 'url', true).text;
    } catch (error) { throw new DatabaseInputError(error instanceof Error ? error.message : 'MongoDB 连接参数无效'); }
  }
  // URL's authority is used solely for a credential-free display; MongoClient parses the URI.
  const withoutScheme = uri.replace(/^mongodb(?:\+srv)?:\/\//, ''), authority = withoutScheme.split(/[/?]/)[0];
  const host = authority.slice(authority.lastIndexOf('@') + 1);
  const path = withoutScheme.slice(authority.length).split('?')[0].replace(/^\//, '');
  let uriDatabase = '';
  try { uriDatabase = decodeURIComponent(path); } catch { throw new DatabaseInputError('MongoDB URI 数据库转义无效'); }
  return { uri, database: mongoDatabase(input.database || uriDatabase || 'admin'), host };
}
