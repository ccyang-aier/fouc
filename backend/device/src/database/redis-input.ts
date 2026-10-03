import type { RedisConnectionConfig } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { publicNativeConnectionOptions } from './connection-options';

export function redisConfig(value: unknown): RedisConnectionConfig {
  if (!value || typeof value !== 'object') throw new DatabaseInputError('Redis 连接参数无效');
  const input = value as Record<string, unknown>;
  if ('ssl' in input || 'tls' in input) throw new DatabaseInputError('TLS 设置请使用统一的高级连接参数');
  if (
    input.provider !== 'redis' ||
    typeof input.host !== 'string' ||
    !input.host.trim() ||
    !Number.isInteger(input.port) ||
    Number(input.port) < 1 ||
    Number(input.port) > 65535 ||
    typeof input.username !== 'string' ||
    !Number.isInteger(input.database) ||
    Number(input.database) < 0 ||
    Number(input.database) > 2147483646
  )
    throw new DatabaseInputError('主机、端口、用户名、数据库或 TLS 参数无效');
  return {
    provider: 'redis',
    host: input.host.trim(),
    port: Number(input.port),
    username: input.username.trim(),
    database: Number(input.database),
    connectionOptions: publicNativeConnectionOptions('redis', input.connectionOptions),
  };
}

/** DBX command quoting/escaping, narrowed to bounded, proven read operations. */
export function redisCommand(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 65536)
    throw new DatabaseInputError('命令不能为空且不得超过 64 KB');
  const source = value.trim().replace(/;+$/, '');
  const tokens: string[] = [];
  let token = '',
    quote = '',
    escaping = false,
    started = false;
  for (const char of source) {
    if (escaping) {
      token += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[char] ?? char;
      escaping = false;
      started = true;
    } else if (char === '\\') {
      escaping = true;
      started = true;
    } else if (quote) {
      if (char === quote) quote = '';
      else token += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(token);
      token = '';
      started = false;
    } else {
      token += char;
      started = true;
    }
  }
  if (quote) throw new DatabaseInputError('命令引号未闭合');
  if (escaping) token += '\\';
  if (started) tokens.push(token);
  const command = tokens[0]?.toUpperCase();
  if (!command) throw new DatabaseInputError('命令不能为空');
  const singleKey = new Set(['TYPE', 'TTL', 'PTTL', 'STRLEN', 'LLEN', 'SCARD', 'HLEN', 'ZCARD', 'XLEN']);
  const accepted =
    ((command === 'PING' || command === 'DBSIZE') && tokens.length === 1) ||
    (singleKey.has(command) && tokens.length === 2) ||
    (command === 'EXISTS' && tokens.length > 1 && tokens.length <= 51) ||
    (command === 'INFO' &&
      tokens.length === 2 &&
      new Set(['server', 'clients', 'memory', 'stats', 'cpu', 'keyspace', 'replication', 'persistence']).has(
        tokens[1]!.toLowerCase(),
      ));
  if (!accepted)
    throw new DatabaseInputError('只读命令台仅开放已验证的查询命令；写入、脚本、管理和无界读取均未开放');
  tokens[0] = command;
  return tokens;
}

export function redisCursor(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,20}$/.test(value) || BigInt(value) > 18446744073709551615n)
    throw new DatabaseInputError('Redis 游标无效');
  return value;
}

export function redisKey(raw: unknown): Buffer {
  if (
    typeof raw !== 'string' ||
    raw.length > 87384 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)
  )
    throw new DatabaseInputError('Redis Key 编码无效');
  return Buffer.from(raw, 'base64');
}
