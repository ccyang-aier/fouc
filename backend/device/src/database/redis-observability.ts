import type Redis from 'ioredis';
import type { RedisInfoSection, RedisInfoSnapshot, RedisSlowlogEntry, RedisSlowlogPage } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { redisBlob } from './redis-blob';
import { redisUnsigned as unsigned, redisProtocolBytes as bytes } from './redis-protocol';

const INFO_BYTES = 2 * 1024 * 1024;
const SLOWLOG_RESPONSE_BYTES = 2 * 1024 * 1024;
type Client = Pick<Redis, 'call' | 'callBuffer'>;

/** DBX INFO sections preserve unknown modules and values containing colons. */
export function redisInfoSections(text: string): RedisInfoSection[] {
  const sections: RedisInfoSection[] = [];
  let current: RedisInfoSection | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('# ')) {
      current = { name: line.slice(2).trim(), entries: [] };
      sections.push(current);
    } else if (line && !line.startsWith('#')) {
      const colon = line.indexOf(':');
      if (colon <= 0) continue;
      if (!current) { current = { name: 'Other', entries: [] }; sections.push(current); }
      current.entries.push({ key: line.slice(0, colon), value: line.slice(colon + 1) });
    }
  }
  return sections;
}
export async function redisInformation(client: Client): Promise<RedisInfoSnapshot> {
  const start = performance.now();
  const raw = await client.callBuffer('INFO', 'ALL');
  if (!Buffer.isBuffer(raw)) throw new Error('INFO ALL 未返回文本');
  if (raw.length > INFO_BYTES) throw new Error('INFO 返回超过当前 2 MiB 上限，请通过命令台查询指定分区');
  return { sections: redisInfoSections(raw.toString('utf8')), fetchedAt: Date.now(), executionTimeMs: Math.round(performance.now() - start) };
}
export function redisSlowlogCount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 10000)
    throw new DatabaseInputError('慢日志数量必须是 1–10000 的整数');
  return raw;
}
function optionalBlob(raw: unknown) {
  if (raw === null || raw === undefined) return null;
  const value = bytes(raw);
  return value.length ? redisBlob(value) : null;
}
/** Never turn malformed 64-bit numbers into zero or flatten argument boundaries. */
export function redisSlowlogEntries(raw: unknown): { entries: RedisSlowlogEntry[]; returnedByServer: number; omittedEntries: number } {
  if (!Array.isArray(raw)) throw new Error('SLOWLOG GET 未返回日志数组');
  const entries: RedisSlowlogEntry[] = [];
  let used = 0;
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 4 || !Array.isArray(item[3])) throw new Error('慢日志记录格式无效');
    const entry: RedisSlowlogEntry = {
      id: unsigned(item[0]), timestampSeconds: unsigned(item[1]), durationMicros: unsigned(item[2]),
      arguments: item[3].map((arg: unknown) => redisBlob(bytes(arg))),
      clientAddress: optionalBlob(item[4]), clientName: optionalBlob(item[5]),
      originalArgumentCount: item[6] === undefined || item[6] === null ? null : unsigned(item[6]),
    };
    const size = Buffer.byteLength(JSON.stringify(entry));
    if (used + size > SLOWLOG_RESPONSE_BYTES) break;
    entries.push(entry); used += size;
  }
  return { entries, returnedByServer: raw.length, omittedEntries: raw.length - entries.length };
}
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
export async function redisSlowlog(client: Client, rawCount: unknown): Promise<RedisSlowlogPage> {
  const count = redisSlowlogCount(rawCount);
  const start = performance.now();
  const [logs, length, config] = await Promise.allSettled([
    client.callBuffer('SLOWLOG', 'GET', String(count)),
    client.call('SLOWLOG', 'LEN'),
    client.call('CONFIG', 'GET', 'slowlog-*'),
  ]);
  if (logs.status === 'rejected') throw logs.reason;
  const result = redisSlowlogEntries(logs.value);
  const warnings: string[] = [];
  let totalEntries: string | null = null;
  let thresholdMicros: string | null = null;
  let maxEntries: string | null = null;
  if (length.status === 'fulfilled') {
    try { totalEntries = unsigned(length.value); } catch (error) { warnings.push(errorMessage(error)); }
  } else warnings.push(`日志总数未知：${errorMessage(length.reason)}`);
  if (config.status === 'fulfilled' && Array.isArray(config.value)) {
    const values = new Map<string, string>();
    for (let index = 0; index + 1 < config.value.length; index += 2)
      values.set(String(config.value[index]), String(config.value[index + 1]));
    const threshold = values.get('slowlog-log-slower-than');
    const max = values.get('slowlog-max-len');
    if (threshold && /^-?\d+$/.test(threshold)) thresholdMicros = threshold;
    if (max && /^\d+$/.test(max)) maxEntries = max;
    if (thresholdMicros === null || maxEntries === null) warnings.push('服务器未提供完整慢日志配置，阈值或容量未知。');
  } else warnings.push(`日志配置未知：${config.status === 'rejected' ? errorMessage(config.reason) : 'CONFIG GET 返回格式无效'}`);
  if (result.omittedEntries) warnings.push(`响应达到 2 MiB 上限，省略 ${result.omittedEntries} 条较早日志；可缩小查询数量。`);
  return { ...result, requestedCount: count, totalEntries, thresholdMicros, maxEntries, warnings,
    fetchedAt: Date.now(), executionTimeMs: Math.round(performance.now() - start) };
}
