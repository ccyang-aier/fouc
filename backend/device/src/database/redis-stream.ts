import type Redis from 'ioredis';
import type { RedisStreamGroup, RedisStreamConsumer, RedisStreamPendingEntry, RedisStreamPendingPage } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { redisKey } from './redis-input';
import { redisBlob } from './redis-blob';
import { redisUnsigned, redisProtocolBytes } from './redis-protocol';

const PAGE_SIZE = 100;
type Client = Pick<Redis, 'callBuffer'>;
function array(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) throw new Error('Redis Stream 未返回数组');
  return raw;
}
function attributes(raw: unknown): Map<string, unknown> {
  const parts = array(raw);
  if (parts.length % 2) throw new Error('Redis Stream 属性格式无效');
  const result = new Map<string, unknown>();
  for (let index = 0; index < parts.length; index += 2) result.set(redisProtocolBytes(parts[index]).toString(), parts[index + 1]);
  return result;
}
function optionalUnsigned(raw: unknown): string | null {
  return raw === null || raw === undefined || String(raw) === '-1' ? null : redisUnsigned(raw);
}
/** Stream IDs contain independent unsigned 64-bit parts; 0-0 is a legal group position. */
export function redisStreamPosition(raw: unknown): string {
  if (typeof raw !== 'string' || !/^\d{1,20}-\d{1,20}$/.test(raw)) throw new DatabaseInputError('Stream 游标必须为完整消息 ID');
  try { return raw.split('-').map(redisUnsigned).join('-'); }
  catch { throw new DatabaseInputError('Stream 游标超出 64 位范围'); }
}
export function redisStreamGroupsReply(raw: unknown): RedisStreamGroup[] {
  return array(raw).map((row) => {
    const value = attributes(row);
    return { name: redisBlob(redisProtocolBytes(value.get('name'))), consumers: redisUnsigned(value.get('consumers')),
      pending: redisUnsigned(value.get('pending')), lastDeliveredId: redisStreamPosition(redisProtocolBytes(value.get('last-delivered-id')).toString()),
      entriesRead: optionalUnsigned(value.get('entries-read')), lag: optionalUnsigned(value.get('lag')) };
  });
}
export function redisStreamConsumersReply(raw: unknown): RedisStreamConsumer[] {
  return array(raw).map((row) => {
    const value = attributes(row);
    return { name: redisBlob(redisProtocolBytes(value.get('name'))), pending: redisUnsigned(value.get('pending')),
      idleMs: redisUnsigned(value.get('idle')), inactiveMs: optionalUnsigned(value.get('inactive')) };
  });
}
export function redisStreamPendingReply(raw: unknown): RedisStreamPendingEntry[] {
  return array(raw).map((item) => {
    const row = array(item);
    if (row.length !== 4) throw new Error('Redis Pending 记录格式无效');
    return { id: redisStreamPosition(redisProtocolBytes(row[0]).toString()), consumer: redisBlob(redisProtocolBytes(row[1])),
      idleMs: redisUnsigned(row[2]), deliveries: redisUnsigned(row[3]) };
  });
}
function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value)) > 2 * 1024 * 1024) throw new Error('Stream 元数据超过当前 2 MiB 读取上限');
  return value;
}
export async function redisStreamGroups(client: Client, key: unknown) {
  const groups = bounded(redisStreamGroupsReply(await client.callBuffer('XINFO', 'GROUPS', redisKey(key))));
  return { groups, fetchedAt: Date.now() };
}
export async function redisStreamConsumers(client: Client, key: unknown, group: unknown) {
  const consumers = bounded(redisStreamConsumersReply(await client.callBuffer('XINFO', 'CONSUMERS', redisKey(key), redisKey(group))));
  return { consumers, fetchedAt: Date.now() };
}
/** DBX inclusive cursor + lookahead: ACK/removal of the cursor must not skip its successor. */
export function redisStreamPendingSlice(entries: RedisStreamPendingEntry[], cursor: string | null) {
  const remaining = cursor && entries[0]?.id === cursor ? entries.slice(1) : entries;
  const page = remaining.slice(0, PAGE_SIZE);
  return { entries: page, nextCursor: remaining.length > PAGE_SIZE ? page.at(-1)!.id : null };
}
export async function redisStreamPending(client: Client, key: unknown, group: unknown, rawCursor: unknown, consumer: unknown): Promise<RedisStreamPendingPage> {
  const cursor = rawCursor === null || rawCursor === undefined ? null : redisStreamPosition(rawCursor);
  const args = [redisKey(key), redisKey(group), cursor ?? '-', '+', String(PAGE_SIZE + 1 + Number(cursor !== null))];
  if (consumer !== null && consumer !== undefined) args.push(redisKey(consumer));
  const entries = redisStreamPendingReply(await client.callBuffer('XPENDING', ...args));
  return bounded({ ...redisStreamPendingSlice(entries, cursor), fetchedAt: Date.now() });
}
