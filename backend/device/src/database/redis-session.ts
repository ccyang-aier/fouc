import Redis from 'ioredis';
import type {
  RedisBlob,
  RedisCommandResult,
  RedisScanPage,
  RedisSession,
  RedisValueData,
  RedisValuePage,
} from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { redisCommand, redisConfig, redisCursor, redisKey } from './redis-input';
import { redisBlob } from './redis-blob';
import { RedisMutationManager, sameRedisSnapshot } from './redis-mutation';
import { REDIS_WRITE_BYTES } from './redis-mutation-input';
export { redisBlob } from './redis-blob';

const PAGE_SIZE = 100;
const STRING_BYTES = 65536;
type Entry = { session: RedisSession; client: Redis; mutations: RedisMutationManager; changingMode: boolean };

/** Standalone sessions keep SELECT immutable; no business Redis configuration is read. */
export class RedisSessionManager {
  private readonly entries = new Map<string, Entry>();
  async connect(workspaceId: string, value: unknown): Promise<RedisSession> {
    if (!workspaceId.trim() || workspaceId.length > 128) throw new DatabaseInputError('工作空间无效');
    const config = redisConfig(value);
    const password = (value as Record<string, unknown>).password;
    if (typeof password !== 'string') throw new DatabaseInputError('Redis 密码参数无效');
    const client = new Redis({
      host: config.host,
      port: config.port,
      db: config.database,
      username: config.username || undefined,
      password: password || undefined,
      tls: config.tls ? { rejectUnauthorized: true } : undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      enableReadyCheck: false,
      retryStrategy: () => null,
      maxRetriesPerRequest: 0,
      connectTimeout: 10000,
      commandTimeout: 10000,
      stringNumbers: true,
    });
    client.on('error', () => {});
    try {
      await client.connect();
      await client.ping();
      const info = await client.info('server').catch(() => '');
      const mode = /^redis_mode:([^\r\n]+)/m.exec(info)?.[1];
      if (mode && mode !== 'standalone')
        throw new DatabaseInputError('Cluster / Sentinel 连接尚未开放，请使用 Standalone 数据源');
      const session: RedisSession = {
        provider: 'redis',
        id: crypto.randomUUID(),
        workspaceId,
        database: config.database,
        version: /^redis_version:([^\r\n]+)/m.exec(info)?.[1] ?? null,
        mode: 'standalone',
        readOnly: true,
      };
      this.entries.set(session.id, { session, client, mutations: new RedisMutationManager(client), changingMode: false });
      return session;
    } catch (error) {
      client.disconnect();
      throw error;
    }
  }
  private entry(workspaceId: string, id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry || entry.session.workspaceId !== workspaceId)
      throw new DatabaseInputError('当前工作空间中的 Redis 连接已断开');
    return entry;
  }
  async setReadOnly(workspaceId: string, id: string, readOnly: unknown): Promise<RedisSession> {
    if (typeof readOnly !== 'boolean') throw new DatabaseInputError('Redis 写入开关无效');
    const entry = this.entry(workspaceId, id);
    if (entry.changingMode) throw new DatabaseInputError('Redis 写入模式正在切换，请等待结果');
    entry.mutations.clear();
    entry.changingMode = true;
    try {
      if (!readOnly) {
        const available = await entry.client.eval('return redis.acl_check_cmd ~= nil and 1 or 0', 0);
        if (String(available) !== '1') throw new DatabaseInputError('当前写入流程需要 Redis 7 或更高版本');
      }
      entry.session.readOnly = readOnly;
      return { ...entry.session };
    } finally { entry.changingMode = false; }
  }
  private writable(workspaceId: string, id: string): Entry {
    const entry = this.entry(workspaceId, id);
    if (entry.changingMode) throw new DatabaseInputError('Redis 写入模式正在切换');
    if (entry.session.readOnly) throw new DatabaseInputError('请先解锁当前 Redis 会话的写入');
    return entry;
  }
  prepare(workspaceId: string, id: string, mutation: unknown, version: unknown) {
    return this.writable(workspaceId, id).mutations.prepare(mutation, version);
  }
  commit(workspaceId: string, id: string, planId: unknown, confirmed: unknown) {
    return this.writable(workspaceId, id).mutations.commit(planId, confirmed);
  }
  async editString(workspaceId: string, id: string, rawKey: unknown): Promise<{ content: RedisBlob; writeVersion: string }> {
    const { client, mutations } = this.writable(workspaceId, id);
    const key = redisKey(rawKey);
    const before = await mutations.snapshot(key);
    if (before.type !== 'string') throw new DatabaseInputError('Key 类型已变化，请刷新');
    const content = await client.getrangeBuffer(key, 0, REDIS_WRITE_BYTES);
    if (content.length > REDIS_WRITE_BYTES) throw new DatabaseInputError('字符串超过当前 1 MiB 编辑上限');
    const after = await mutations.snapshot(key);
    if (!sameRedisSnapshot(before, after)) throw new DatabaseInputError('读取期间 Key 已变化，请重新读取');
    return { content: redisBlob(content), writeVersion: mutations.remember(after) };
  }
  async scan(workspaceId: string, id: string, cursor: unknown, pattern: unknown): Promise<RedisScanPage> {
    const { client } = this.entry(workspaceId, id);
    const current = redisCursor(cursor);
    if (typeof pattern !== 'string' || Buffer.byteLength(pattern) > 4096)
      throw new DatabaseInputError('Key 匹配规则无效');
    const [next, keys] = await client.scanBuffer(current, 'MATCH', pattern || '*', 'COUNT', PAGE_SIZE);
    // COUNT is a hint. Keep every returned key, even when the batch exceeds it.
    const pipeline = client.pipeline();
    for (const key of keys) {
      pipeline.type(key);
      pipeline.ttl(key);
    }
    const metadata = await pipeline.exec();
    if (!metadata) throw new Error('Redis 扫描未返回元数据');
    for (const [error] of metadata) if (error) throw error;
    return {
      cursor: next.toString(),
      totalKeys: String(await client.dbsize()),
      keys: keys.map((key, index) => ({
        key: redisBlob(key),
        type: String(metadata[index * 2]![1]),
        ttl: Number(metadata[index * 2 + 1]![1]),
      })),
    };
  }
  async value(
    workspaceId: string,
    id: string,
    rawKey: unknown,
    rawCursor: unknown = '0',
  ): Promise<RedisValuePage> {
    const { client, session, mutations } = this.entry(workspaceId, id);
    const key = redisKey(rawKey);
    let before: Awaited<ReturnType<RedisMutationManager['snapshot']>> | null = null;
    let writeVersion: string | null = null;
    let writeUnavailable: string | null = session.readOnly ? '解锁写入后可编辑' : null;
    if (!session.readOnly) {
      try { before = await mutations.snapshot(key); }
      catch (error) { writeUnavailable = error instanceof Error ? error.message : String(error); }
    }
    const type = await client.type(key);
    let cursor: string;
    if (type === 'stream') {
      if (
        typeof rawCursor !== 'string' ||
        !/^(0|\d{1,20}-\d{1,20})$/.test(rawCursor) ||
        rawCursor.split('-').some((part) => BigInt(part) > 18446744073709551615n)
      )
        throw new DatabaseInputError('Stream 游标无效');
      cursor = rawCursor;
    } else cursor = redisCursor(rawCursor);
    const ttl = Number(await client.ttl(key));
    let data: RedisValueData;
    if (type === 'string') {
      const content = await client.getrangeBuffer(key, 0, STRING_BYTES);
      data = {
        kind: 'string',
        content: redisBlob(content.subarray(0, STRING_BYTES)),
        total: String(await client.strlen(key)),
        truncated: content.length > STRING_BYTES,
      };
    } else if (type === 'list' || type === 'zset') {
      if (BigInt(cursor) > BigInt(Number.MAX_SAFE_INTEGER - PAGE_SIZE))
        throw new DatabaseInputError('集合分页范围无效');
      const start = Number(cursor);
      const total = String(await (type === 'list' ? client.llen(key) : client.zcard(key)));
      const nextCursor = BigInt(start + PAGE_SIZE) < BigInt(total) ? String(start + PAGE_SIZE) : null;
      if (type === 'list')
        data = {
          kind: 'list',
          total,
          nextCursor,
          items: (await client.lrangeBuffer(key, start, start + PAGE_SIZE - 1)).map((bytes, index) => ({
            index: String(start + index),
            value: redisBlob(bytes),
          })),
        };
      else {
        const items = await client.zrangeBuffer(key, start, start + PAGE_SIZE - 1, 'WITHSCORES');
        data = {
          kind: 'zset',
          total,
          nextCursor,
          items: items
            .filter((_, index) => index % 2 === 0)
            .map((bytes, index) => ({ member: redisBlob(bytes), score: items[index * 2 + 1]!.toString() })),
        };
      }
    } else if (type === 'set' || type === 'hash') {
      const [next, items] = await (type === 'set'
        ? client.sscanBuffer(key, cursor, 'COUNT', PAGE_SIZE)
        : client.hscanBuffer(key, cursor, 'COUNT', PAGE_SIZE));
      const nextCursor = next.toString() === '0' ? null : next.toString();
      const total = String(await (type === 'set' ? client.scard(key) : client.hlen(key)));
      data =
        type === 'set'
          ? { kind: 'set', total, nextCursor, items: items.map(redisBlob) }
          : {
              kind: 'hash',
              total,
              nextCursor,
              items: items
                .filter((_, index) => index % 2 === 0)
                .map((bytes, index) => ({
                  field: redisBlob(bytes),
                  value: redisBlob(items[index * 2 + 1]!),
                })),
            };
    } else if (type === 'stream') {
      // Stream IDs have two independent 64-bit parts, so use a separate API cursor.
      const start = cursor === '0' ? '-' : cursor;
      const entries = await client.xrangeBuffer(key, start, '+', 'COUNT', PAGE_SIZE + 1);
      data = {
        kind: 'stream',
        total: String(await client.xlen(key)),
        nextCursor: entries.length > PAGE_SIZE ? entries[PAGE_SIZE]![0].toString() : null,
        items: entries.slice(0, PAGE_SIZE).map(([entryId, fields]) => ({
          id: entryId.toString(),
          fields: fields
            .filter((_, index) => index % 2 === 0)
            .map((bytes, index) => ({ field: redisBlob(bytes), value: redisBlob(fields[index * 2 + 1]!) })),
        })),
      };
    } else data = { kind: type === 'none' ? 'none' : 'unsupported' };
    if (before) {
      try {
        const after = await mutations.snapshot(key);
        if (sameRedisSnapshot(before, after)) writeVersion = mutations.remember(after);
        else writeUnavailable = '读取期间 Key 已变化，请刷新后编辑';
      } catch (error) { writeUnavailable = error instanceof Error ? error.message : String(error); }
    }
    return { key: redisBlob(key), type, ttl, data, writeVersion, writeUnavailable };
  }
  async command(workspaceId: string, id: string, value: unknown): Promise<RedisCommandResult> {
    const { client } = this.entry(workspaceId, id);
    const [command, ...args] = redisCommand(value);
    const start = performance.now();
    const result = await client.call(command!, ...args);
    return { command: command!, result, executionTimeMs: Math.round(performance.now() - start) };
  }
  disconnect(workspaceId: string, id: string): void {
    const { client, mutations } = this.entry(workspaceId, id);
    mutations.clear();
    this.entries.delete(id);
    client.disconnect();
  }
  shutdown(): void {
    for (const { session } of this.entries.values()) this.disconnect(session.workspaceId, session.id);
  }
}
