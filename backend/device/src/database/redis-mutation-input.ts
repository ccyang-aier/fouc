import type { RedisMutation } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { redisKey } from './redis-input';
import { redisJsonDraft } from './redis-json';

export const REDIS_WRITE_BYTES = 1024 * 1024;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function blob(value: unknown): string {
  if (typeof value !== 'string' || value.length > Math.ceil(REDIS_WRITE_BYTES / 3) * 4 ||
    !BASE64.test(value) || Buffer.from(value, 'base64').toString('base64') !== value)
    throw new DatabaseInputError('Redis 字节参数必须为规范 Base64，单项不得超过 1 MiB');
  return value;
}
function index(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,16}$/.test(value) || BigInt(value) > 9999n)
    throw new DatabaseInputError('List 编辑索引必须在 0–9999 之间');
  return BigInt(value).toString();
}
function integer(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new DatabaseInputError('过期时间必须是有效正整数毫秒');
  return value;
}
export function redisStreamId(value: unknown, automatic = false): string {
  if (value === '*' && automatic) return value;
  if (typeof value !== 'string' || !/^\d{1,20}-\d{1,20}$/.test(value) ||
    value.split('-').some((part) => BigInt(part) > 18446744073709551615n) ||
    value.split('-').every((part) => BigInt(part) === 0n))
    throw new DatabaseInputError('Stream ID 必须为两个 64 位整数，且不能为 0-0');
  return value.split('-').map((part) => BigInt(part).toString()).join('-');
}
function score(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128 ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))
    throw new DatabaseInputError('ZSet 分数必须为有限数值');
  return value;
}
function fields(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100)
    throw new DatabaseInputError('Stream 需要 1–100 组字段和值');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new DatabaseInputError('Stream 字段无效');
    return { field: blob(item.field), value: blob(item.value) };
  });
}
/** Whitelist fields into a new immutable plan; ignore neither malformed variants nor bytes. */
export function redisMutation(value: unknown): RedisMutation {
  if (!value || typeof value !== 'object') throw new DatabaseInputError('Redis 变更参数无效');
  const input = value as Record<string, unknown>;
  const key = redisKey(input.key).toString('base64');
  const kind = input.kind;
  let result: RedisMutation;
  switch (kind) {
    case 'delete': result = { kind, key }; break;
    case 'rename': {
      const destination = redisKey(input.destination).toString('base64');
      if (destination === key) throw new DatabaseInputError('新 Key 与原 Key 相同');
      result = { kind, key, destination }; break;
    }
    case 'expiry': case 'hash-expiry': {
      const target = kind === 'hash-expiry' ? { kind, key, field: blob(input.field) } : { kind, key };
      if (input.mode === 'persist') result = { ...target, mode: 'persist' };
      else if (input.mode === 'relative' || input.mode === 'absolute') {
        const milliseconds = integer(input.milliseconds);
        if (input.mode === 'relative' && Number(milliseconds) > Number.MAX_SAFE_INTEGER - Date.now())
          throw new DatabaseInputError('TTL 对应的绝对时间超出精确编辑范围');
        if (input.mode === 'absolute' && Number(milliseconds) <= Date.now())
          throw new DatabaseInputError('指定过期时间必须晚于当前时间');
        result = { ...target, mode: input.mode, milliseconds };
      } else throw new DatabaseInputError('过期时间方式无效');
      break;
    }
    case 'string-set': result = { kind, key, value: blob(input.value) }; break;
    case 'json-set': result = { kind, key, json: redisJsonDraft(input.json) }; break;
    case 'list-push':
      if (input.side !== 'left' && input.side !== 'right') throw new DatabaseInputError('List 插入方向无效');
      result = { kind, key, side: input.side, value: blob(input.value) }; break;
    case 'list-set': result = { kind, key, index: index(input.index), value: blob(input.value) }; break;
    case 'list-remove': result = { kind, key, index: index(input.index) }; break;
    case 'set-add': case 'set-remove': case 'zset-remove':
      result = { kind, key, member: blob(input.member) }; break;
    case 'hash-add': result = { kind, key, field: blob(input.field), value: blob(input.value) }; break;
    case 'hash-set': result = { kind, key, field: blob(input.field), destination: blob(input.destination), value: blob(input.value) }; break;
    case 'hash-remove': result = { kind, key, field: blob(input.field) }; break;
    case 'zset-add': result = { kind, key, member: blob(input.member), score: score(input.score) }; break;
    case 'zset-set': result = { kind, key, member: blob(input.member), destination: blob(input.destination), score: score(input.score) }; break;
    case 'stream-add': result = { kind, key, entryId: redisStreamId(input.entryId, true), fields: fields(input.fields) }; break;
    case 'stream-remove': result = { kind, key, entryId: redisStreamId(input.entryId) }; break;
    case 'create':
      switch (input.type) {
        case 'json': result = { kind, key, type: 'json', json: redisJsonDraft(input.json) }; break;
        case 'string': case 'list': case 'set': result = { kind, key, type: input.type, value: blob(input.value) }; break;
        case 'hash': result = { kind, key, type: 'hash', field: blob(input.field), value: blob(input.value) }; break;
        case 'zset': result = { kind, key, type: 'zset', member: blob(input.member), score: score(input.score) }; break;
        case 'stream': result = { kind, key, type: 'stream', entryId: redisStreamId(input.entryId, true), fields: fields(input.fields) }; break;
        default: throw new DatabaseInputError('新建 Redis 类型无效');
      }
      break;
    default: throw new DatabaseInputError('Redis 变更类型无效');
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 2 * REDIS_WRITE_BYTES)
    throw new DatabaseInputError('Redis 变更参数总量不得超过 2 MiB');
  return result;
}
