import { describe, expect, test } from 'bun:test';
import { redisCommand, redisConfig, redisCursor, redisKey } from './redis-input';
import { redisBlob } from './redis-session';

describe('native Redis input policy', () => {
  test('parses DBX quoting, empty keys and escaped characters', () => {
    expect(redisCommand('TYPE "a b";')).toEqual(['TYPE', 'a b']);
    expect(redisCommand("TTL ''")).toEqual(['TTL', '']);
    expect(redisCommand('TYPE "a\\nb\\t\\\\"')).toEqual(['TYPE', 'a\nb\t\\']);
    expect(() => redisCommand('TYPE "unclosed')).toThrow('引号');
  });
  test('blocks writes, state changes, scripts and unbounded reads', () => {
    for (const command of [
      'SET k v',
      'DEL k',
      'FLUSHDB',
      'EVAL "return 1" 0',
      'SELECT 1',
      'AUTH secret',
      'CONFIG GET *',
      'CLIENT KILL TYPE normal',
      'KEYS *',
      'GET big',
      'HGETALL huge',
      'MULTI',
      'PING; FLUSHDB',
      'UNKNOWN',
    ])
      expect(() => redisCommand(command)).toThrow();
    expect(redisCommand('INFO memory')).toEqual(['INFO', 'memory']);
    expect(() => redisCommand('INFO')).toThrow();
    expect(() => redisCommand('INFO all')).toThrow();
  });
  test('preserves 64-bit cursors and binary/empty keys', () => {
    expect(redisCursor('18446744073709551615')).toBe('18446744073709551615');
    for (const cursor of [1, '-1', '18446744073709551616', '1;DEL'])
      expect(() => redisCursor(cursor)).toThrow();
    expect(redisKey('AP8=')).toEqual(Buffer.from([0, 255]));
    expect(redisKey('')).toEqual(Buffer.alloc(0));
    expect(() => redisKey('a!')).toThrow();
  });
  test('lossless blob transport distinguishes binary and unicode', () => {
    expect(redisBlob(Buffer.from('中文'))).toEqual({
      display: '中文',
      encoding: 'utf8',
      rawBase64: '5Lit5paH',
    });
    expect(redisBlob(Buffer.from([0, 255])).encoding).toBe('binary');
    expect(redisBlob(Buffer.from([0, 255])).display).toBe('0x00ff');
  });
  test('whitelists saved config and rejects invalid DB, port and TLS', () => {
    const input = {
      provider: 'redis',
      host: ' localhost ',
      port: 6379,
      username: '',
      database: 0,
      connectionOptions: { tls: { enabled: false } },
      password: 'never-persist',
    };
    expect(redisConfig(input)).toEqual({
      provider: 'redis',
      host: 'localhost',
      port: 6379,
      username: '',
      database: 0,
      connectionOptions: { connectTimeoutMs: 10000, queryTimeoutMs: 10000, idleTimeoutMs: null, tls: { enabled: false, minVersion: 'TLSv1.2', serverName: '', caRequired: false, clientCertificateRequired: false } },
    });
    for (const change of [{ database: -1 }, { database: 1.5 }, { port: 0 }, { connectionOptions: { tls: { enabled: 'false' } } }])
      expect(() => redisConfig({ ...input, ...change })).toThrow();
  });
});
