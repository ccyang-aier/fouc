import type Redis from 'ioredis';
import type { RedisDatabaseInfo, RedisDatabaseList } from '@fouc/shared';
import { DatabaseInputError } from './input-error';

export function redisDatabase(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483646)
    throw new DatabaseInputError('Redis 数据库编号必须为有效非负整数');
  return value;
}
/** DBX CONFIG/keyspace discovery, retaining unknown counts instead of fabricating zeros. */
export function parseRedisKeyspace(info: string): Map<number, RedisDatabaseInfo> {
  const values = new Map<number, RedisDatabaseInfo>();
  for (const line of info.split(/\r?\n/)) {
    const match = /^db(\d+):(.*)$/.exec(line);
    if (!match) continue;
    const database = Number(match[1]);
    if (!Number.isInteger(database) || database > 2147483646) continue;
    const fields = new Map(match[2]!.split(',').map((part) => part.split('=') as [string, string]));
    const integer = (name: string) => /^\d+$/.test(fields.get(name) ?? '') ? fields.get(name)! : null;
    values.set(database, { database, keys: integer('keys'), expires: integer('expires'), averageTtlMs: integer('avg_ttl') });
  }
  return values;
}
export async function redisDatabases(client: Redis, current: number, rawOffset: unknown = 0): Promise<RedisDatabaseList> {
  const offset = redisDatabase(rawOffset);
  const results = await Promise.allSettled([client.config('GET', 'databases'), client.info('keyspace')]);
  const warnings: string[] = [];
  let configuredCount: number | null = null;
  const configuration = results[0];
  if (configuration.status === 'fulfilled' && Array.isArray(configuration.value)) {
    const index = configuration.value.findIndex((value) => String(value).toLowerCase() === 'databases');
    const count = Number(configuration.value[index + 1]);
    if (index >= 0 && Number.isInteger(count) && count > 0 && count <= 2147483647) configuredCount = count;
  }
  if (configuredCount === null) warnings.push('无法读取数据库数量配置；只列出已观察到的 DB，可输入其他编号验证连接。');
  const keyspace = results[1];
  const metadata = keyspace.status === 'fulfilled' ? parseRedisKeyspace(keyspace.value) : new Map<number, RedisDatabaseInfo>();
  if (keyspace.status === 'rejected') warnings.push('Keyspace 信息不可用，Key 数量显示为未知。');
  const ids = configuredCount === null ? [...new Set([current, ...metadata.keys()])].sort((a, b) => a - b) : [];
  const end = Math.min(offset + 128, configuredCount ?? ids.length);
  const databases: RedisDatabaseInfo[] = [];
  for (let index = offset; index < end; index++) {
    const database = configuredCount === null ? ids[index]! : index;
    databases.push(metadata.get(database) ?? {
      database,
      keys: keyspace.status === 'fulfilled' && configuredCount !== null ? '0' : null,
      expires: keyspace.status === 'fulfilled' && configuredCount !== null ? '0' : null,
      averageTtlMs: null,
    });
  }
  return { databases, configuredCount, nextOffset: end < (configuredCount ?? ids.length) ? end : null, warnings };
}

export async function redisHashExpiries(client: Redis, key: Buffer, fields: Buffer[]): Promise<{
  values: (number | null)[]; available: boolean; reason: string | null;
}> {
  if (!fields.length) return { values: [], available: false, reason: '当前批次为空，字段过期能力尚未观察' };
  try {
    const reply = await client.call('HPTTL', key, 'FIELDS', String(fields.length), ...fields);
    if (!Array.isArray(reply) || reply.length !== fields.length) throw new Error('Redis 字段过期时间响应无效');
    const values = reply.map((value) => {
      const ttl = Number(value);
      if (!Number.isSafeInteger(ttl) || ttl < -2) throw new Error('Redis 字段过期时间超出精确读取范围');
      return ttl;
    });
    return { values, available: true, reason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Optional metadata failure is explicit; it never authorizes an expiry write.
    if (/unknown command|unsupported|NOPERM|no permission/i.test(message))
      return { values: fields.map(() => null), available: false, reason: message };
    throw error;
  }
}
