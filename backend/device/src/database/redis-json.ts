import type Redis from 'ioredis';
import { formatJsonSource, type RedisJsonCapability } from '@fouc/shared';
import { DatabaseInputError } from './input-error';

const JSON_READ_BYTES = 2 * 1024 * 1024;
export function isRedisJsonType(type: string): boolean { return /^(?:ReJSON-RL|json)$/i.test(type); }
export function redisJsonDraft(value: unknown): string {
  if (typeof value !== 'string' || Buffer.byteLength(value) > 1024 * 1024) throw new DatabaseInputError('RedisJSON 文档不得超过 1 MiB');
  if (Buffer.from(value, 'utf8').toString('utf8') !== value) throw new DatabaseInputError('RedisJSON 文档包含无法按 UTF-8 保留的孤立代理字符，请使用 JSON Unicode 转义');
  try { return formatJsonSource(value); }
  catch (error) { throw new DatabaseInputError(`RedisJSON 文档无效：${error instanceof Error ? error.message : String(error)}`); }
}
export async function redisJsonCapability(client: Redis): Promise<RedisJsonCapability> {
  try {
    const commands = await client.callBuffer('COMMAND', 'INFO', 'JSON.GET', 'JSON.SET');
    if (!Array.isArray(commands) || commands.length !== 2) throw new Error('RedisJSON 命令元数据返回无效');
    for (const [index, command] of commands.entries()) {
      if (command !== null && (!Array.isArray(command) || !Buffer.isBuffer(command[0]) || command[0].toString().toUpperCase() !== ['JSON.GET', 'JSON.SET'][index])) {
        throw new Error('RedisJSON 命令元数据返回无效');
      }
    }
    const available = commands.every((command) => command !== null);
    return { available, reason: available ? null : '当前 Redis 实例未提供 JSON.GET / JSON.SET；需启用 JSON 模块或使用内置 JSON 的 Redis。' };
  } catch (error) { return { available: null, reason: `无法确认 JSON 命令是否可用：${error instanceof Error ? error.message : String(error)}` }; }
}
export async function redisJsonValue(client: Redis, key: Buffer) {
  // Optional size metadata must not turn an ACL-restricted readable key into a fake empty value.
  const memory = await client.call('MEMORY', 'USAGE', key).catch(() => null);
  if (memory !== null && Number(memory) > JSON_READ_BYTES) throw new DatabaseInputError('RedisJSON Key 超过当前 2 MiB 完整读取范围');
  // A legacy root path returns the document itself; `$` wraps matches in an array.
  const reply = await client.callBuffer('JSON.GET', key, '.');
  if (reply === null) throw new DatabaseInputError('RedisJSON Key 在读取期间已不存在，请刷新');
  if (!Buffer.isBuffer(reply)) throw new Error('RedisJSON 响应格式无效');
  if (reply.length > JSON_READ_BYTES) throw new DatabaseInputError('RedisJSON 文档超过当前 2 MiB 完整读取范围');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(reply); formatJsonSource(content); }
  catch { throw new Error('RedisJSON 返回了无效 UTF-8 或 JSON 文档'); }
  return { kind: 'json' as const, content, byteLength: reply.length };
}
