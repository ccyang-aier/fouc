import { REDIS_BULK_LIMITS as LIMITS, type RedisBulkInput, type RedisBulkOperation } from '@fouc/shared/redis-bulk';
import { DatabaseInputError } from './input-error';
import { redisKey } from './redis-input';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('Redis 批量参数须为对象');
  return value as Record<string, unknown>;
}

export function redisBulkInput(value: unknown, database: number): RedisBulkInput {
  const input = object(value), action = object(input.operation);
  if (input.database !== database) throw new DatabaseInputError('当前 Redis 数据库已变化，请重新选择 Key');
  if (!Array.isArray(input.keys) || !input.keys.length || input.keys.length > LIMITS.keys) throw new DatabaseInputError('明确选择 1–100 个 Key，不接受通配符范围');
  let total = 0;
  const seen = new Set<string>();
  const keys = input.keys.map(raw => {
    const key = redisKey(raw), canonical = key.toString('base64');
    total += key.byteLength;
    if (canonical !== raw || key.byteLength > LIMITS.keyBytes || seen.has(canonical)) throw new DatabaseInputError('Key 须为规范 Base64、无重复且单个不超过 64 KiB');
    seen.add(canonical);
    return canonical;
  });
  if (total > LIMITS.keyTotalBytes) throw new DatabaseInputError('所选 Key 的名称合计超过 256 KiB');
  let operation: RedisBulkOperation;
  if (action.kind === 'delete' || action.kind === 'persist') operation = { kind: action.kind };
  else if (action.kind === 'relative-ttl' || action.kind === 'absolute-ttl') {
    if (typeof action.milliseconds !== 'string' || !/^[1-9]\d{0,15}$/.test(action.milliseconds) || BigInt(action.milliseconds) > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new DatabaseInputError('TTL 或绝对时间须为精确的正整数毫秒；永久请明确选择 PERSIST');
    }
    operation = { kind: action.kind, milliseconds: action.milliseconds };
  } else throw new DatabaseInputError('批量操作仅支持删除、相对 TTL、绝对时间和 PERSIST');
  return { database, keys, operation };
}
