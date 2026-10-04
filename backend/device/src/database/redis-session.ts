import Redis from 'ioredis';
import type {
  RedisBlob,
  RedisCommandResult,
  RedisScanPage,
  RedisSession,
  RedisValueData,
  RedisValuePage,
  RedisHistoryPage,
  RedisHistoryEntry,
} from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { redisCommand, redisConfig, redisCursor, redisKey } from './redis-input';
import { redisBlob } from './redis-blob';
import { RedisMutationManager, sameRedisSnapshot } from './redis-mutation';
import { REDIS_WRITE_BYTES } from './redis-mutation-input';
import { redisDatabase, redisDatabases, redisHashExpiries } from './redis-metadata';
import { RedisHistoryRepository, REDIS_HISTORY_LIMIT, redisHistoryEntry } from './redis-history';
import { redisInformation, redisSlowlog } from './redis-observability';
import { redisStreamGroups, redisStreamConsumers, redisStreamPending } from './redis-stream';
import { RedisMonitor } from './redis-monitor';
import { RedisPubSub, redisPubSubBytes } from './redis-pubsub';
import { redisUnsigned } from './redis-protocol';
import { isRedisJsonType, redisJsonCapability, redisJsonValue } from './redis-json';
import { redisNativeConnectionOptions } from './connection-options';
import { RedisBulkPlans } from './redis-bulk-plans';
export { redisBlob } from './redis-blob';

const PAGE_SIZE = 100;
const STRING_BYTES = 65536;
type Entry = { session: RedisSession; client: Redis; mutations: RedisMutationManager; bulk: RedisBulkPlans; saving: boolean; changingMode: boolean; history: RedisHistoryEntry[]; monitors: Set<RedisMonitor>; pubsubs: Map<string, RedisPubSub> };

/** Each client keeps its verified DB immutable; switching creates a new session. */
export class RedisSessionManager {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly historyRepository?: RedisHistoryRepository) {}
  async connect(workspaceId: string, value: unknown, connectionId: string | null = null): Promise<RedisSession> {
    if (!workspaceId.trim() || workspaceId.length > 128) throw new DatabaseInputError('工作空间无效');
    const config = redisConfig(value);
    const password = (value as Record<string, unknown>).password;
    if (typeof password !== 'string') throw new DatabaseInputError('Redis 密码参数无效');
    const advanced = redisNativeConnectionOptions((value as Record<string, unknown>).connectionOptions, config.host);
    const client = new Redis({
      host: config.host,
      port: config.port,
      db: config.database,
      username: config.username || undefined,
      password: password || undefined,
      ...advanced.options,
      lazyConnect: true,
      enableOfflineQueue: false,
      enableReadyCheck: false,
      retryStrategy: () => null,
      maxRetriesPerRequest: 0,
      stringNumbers: true,
    });
    client.on('error', () => {});
    try {
      await client.connect();
      // ioredis emits constructor SELECT errors but can still become ready.
      // Await the acknowledgement so an invalid DB never falls through to DB 0.
      await client.select(config.database);
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
        connectionId,
        version: /^redis_version:([^\r\n]+)/m.exec(info)?.[1] ?? null,
        mode: 'standalone',
        readOnly: true,
      };
      this.entries.set(session.id, { session, client, mutations: new RedisMutationManager(client), bulk: new RedisBulkPlans(client, session.database), saving: false, changingMode: false, history: [], monitors: new Set(), pubsubs: new Map() });
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
    if (entry.saving) throw new DatabaseInputError('Redis 写入已发送，请等待实际确认后切换模式');
    entry.mutations.clear();
    entry.bulk.clear();
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
    if (entry.saving) throw new DatabaseInputError('当前 Redis 会话正在确认写入');
    if (entry.session.readOnly) throw new DatabaseInputError('请先解锁当前 Redis 会话的写入');
    return entry;
  }
  databases(workspaceId: string, id: string, offset: unknown) {
    const { client, session } = this.entry(workspaceId, id);
    return redisDatabases(client, session.database, offset);
  }
  information(workspaceId: string, id: string) {
    return redisInformation(this.entry(workspaceId, id).client);
  }
  jsonCapability(workspaceId: string, id: string) { return redisJsonCapability(this.entry(workspaceId, id).client); }
  slowlog(workspaceId: string, id: string, count: unknown) {
    return redisSlowlog(this.entry(workspaceId, id).client, count);
  }
  streamGroups(workspaceId: string, id: string, key: unknown) {
    return redisStreamGroups(this.entry(workspaceId, id).client, key);
  }
  streamConsumers(workspaceId: string, id: string, key: unknown, group: unknown) {
    return redisStreamConsumers(this.entry(workspaceId, id).client, key, group);
  }
  streamPending(workspaceId: string, id: string, key: unknown, group: unknown, cursor: unknown, consumer: unknown) {
    return redisStreamPending(this.entry(workspaceId, id).client, key, group, cursor, consumer);
  }
  monitor(workspaceId: string, id: string, signal: AbortSignal) {
    const entry = this.entry(workspaceId, id);
    const monitor = new RedisMonitor(entry.client, () => entry.monitors.delete(monitor));
    entry.monitors.add(monitor);
    return monitor.open(signal);
  }
  pubsub(workspaceId: string, id: string, signal: AbortSignal) {
    const entry = this.entry(workspaceId, id);
    const capture = new RedisPubSub(entry.client, () => entry.pubsubs.delete(capture.id));
    entry.pubsubs.set(capture.id, capture);
    return capture.open(signal);
  }
  private pubsubCapture(workspaceId: string, id: string, captureId: string) {
    const capture = this.entry(workspaceId, id).pubsubs.get(captureId);
    if (!capture) throw new DatabaseInputError('当前 Redis 会话中的 Pub/Sub 连接已断开');
    return capture;
  }
  pubsubSubscriptions(workspaceId: string, id: string, captureId: string) {
    return this.pubsubCapture(workspaceId, id, captureId).subscriptions();
  }
  pubsubChange(workspaceId: string, id: string, captureId: string, input: unknown) {
    return this.pubsubCapture(workspaceId, id, captureId).change(input);
  }
  async pubsubPublish(workspaceId: string, id: string, input: unknown) {
    const entry = this.writable(workspaceId, id);
    if (!input || typeof input !== 'object' || (input as Record<string, unknown>).confirmed !== true)
      throw new DatabaseInputError('发布消息需要明确确认');
    const value = input as Record<string, unknown>;
    const channel = redisPubSubBytes(value.channel), payload = redisPubSubBytes(value.payload, REDIS_WRITE_BYTES);
    try {
      const count = await entry.client.callBuffer('PUBLISH', channel, payload);
      return { receivers: redisUnsigned(count), publishedAt: Date.now() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/timeout|timed out|connection.*closed|socket|ECONNRESET|EPIPE/i.test(message))
        throw new Error(`发布结果未确认，请核对接收端后再决定是否重发；${message}`);
      throw error;
    }
  }
  async switchDatabase(workspaceId: string, id: string, rawDatabase: unknown): Promise<RedisSession> {
    const database = redisDatabase(rawDatabase);
    const entry = this.entry(workspaceId, id);
    if (entry.changingMode) throw new DatabaseInputError('Redis 会话正在切换，请等待结果');
    if (entry.saving) throw new DatabaseInputError('Redis 写入已发送，请等待确认后切换数据库');
    if (database === entry.session.database) return { ...entry.session };
    entry.mutations.clear();
    entry.bulk.clear();
    entry.changingMode = true;
    const client = entry.client.duplicate({ db: database, lazyConnect: true });
    client.on('error', () => {});
    try {
      await client.connect();
      await client.select(database);
      await client.ping();
      const session = { ...entry.session, id: crypto.randomUUID(), database, readOnly: true };
      this.entries.set(session.id, { session, client, mutations: new RedisMutationManager(client), bulk: new RedisBulkPlans(client, database), saving: false, changingMode: false, history: [], monitors: new Set(), pubsubs: new Map() });
      this.entries.delete(id);
      for (const monitor of entry.monitors) monitor.stop('Redis 数据库已切换，MONITOR 已停止');
      for (const capture of entry.pubsubs.values()) capture.stop('Redis 数据库已切换，Pub/Sub 已断开');
      entry.client.disconnect();
      return session;
    } catch (error) { client.disconnect(); throw error; }
    finally { entry.changingMode = false; }
  }
  history(workspaceId: string, id: string): RedisHistoryPage {
    const entry = this.entry(workspaceId, id);
    const persistent = Boolean(this.historyRepository && entry.session.connectionId);
    const entries = persistent ? this.historyRepository!.list(workspaceId, entry.session.connectionId!) : entry.history;
    return { entries: [...entries].reverse(), persistent, limit: REDIS_HISTORY_LIMIT };
  }
  clearHistory(workspaceId: string, id: string): void {
    const entry = this.entry(workspaceId, id);
    if (this.historyRepository && entry.session.connectionId) this.historyRepository.clear(workspaceId, entry.session.connectionId);
    entry.history = [];
  }
  removeConnection(workspaceId: string, connectionId: string): void {
    const entries = [...this.entries.values()].filter((entry) => entry.session.workspaceId === workspaceId && entry.session.connectionId === connectionId);
    for (const entry of entries) {
      if (entry.changingMode) throw new DatabaseInputError('连接正在切换，请等待后再删除');
      if (entry.saving) throw new DatabaseInputError('Redis 正在确认写入，请等待后再删除连接');
      entry.mutations.clear();
      entry.bulk.clear();
    }
    for (const entry of entries) this.disconnect(workspaceId, entry.session.id);
    this.historyRepository?.clear(workspaceId, connectionId);
  }
  private recordHistory(entry: Entry, record: RedisHistoryEntry): string | null {
    if (this.entries.get(entry.session.id) !== entry) return null;
    try {
      if (this.historyRepository && entry.session.connectionId)
        this.historyRepository.append(entry.session.workspaceId, entry.session.connectionId, record);
      else entry.history = [...entry.history, record].slice(-REDIS_HISTORY_LIMIT);
      return null;
    } catch (error) { return `记录历史失败：${error instanceof Error ? error.message : String(error)}`; }
  }
  prepare(workspaceId: string, id: string, mutation: unknown, version: unknown) {
    return this.writable(workspaceId, id).mutations.prepare(mutation, version);
  }
  async commit(workspaceId: string, id: string, planId: unknown, confirmed: unknown) {
    const entry = this.writable(workspaceId, id);
    entry.saving = true;
    try { return await entry.mutations.commit(planId, confirmed); }
    finally { entry.saving = false; }
  }
  prepareBulk(workspaceId: string, id: string, input: unknown, signal?: AbortSignal) {
    const entry = this.entry(workspaceId, id);
    if (entry.changingMode || entry.saving) throw new DatabaseInputError('Redis 会话正在切换或确认写入，请稍后预览');
    return entry.bulk.prepare(input, signal);
  }
  discardBulk(workspaceId: string, id: string, planId: unknown): void {
    this.entry(workspaceId, id).bulk.discard(planId);
  }
  async commitBulk(workspaceId: string, id: string, planId: unknown, confirmed: unknown, dangerConfirmed: unknown, signal?: AbortSignal) {
    const entry = this.writable(workspaceId, id);
    entry.saving = true;
    try { return await entry.bulk.commit(planId, confirmed, dangerConfirmed, signal); }
    finally { entry.saving = false; }
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
      if (type === 'set') data = { kind: 'set', total, nextCursor, items: items.map(redisBlob) };
      else {
        const fields = items.filter((_, index) => index % 2 === 0);
        const expiries = await redisHashExpiries(client, key, fields);
        data = {
          kind: 'hash', total, nextCursor,
          fieldExpiry: { available: expiries.available, reason: expiries.reason },
          items: fields.map((bytes, index) => ({ field: redisBlob(bytes), value: redisBlob(items[index * 2 + 1]!), ttlMs: expiries.values[index] ?? null })),
        };
      }
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
    } else if (isRedisJsonType(type)) data = await redisJsonValue(client, key);
    else data = { kind: type === 'none' ? 'none' : 'unsupported' };
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
    const entry = this.entry(workspaceId, id);
    const [command, ...args] = redisCommand(value);
    const start = performance.now();
    const timestamp = Date.now();
    try {
      const result = await entry.client.call(command!, ...args);
      const historyWarning = this.recordHistory(entry, redisHistoryEntry(entry.session.database, String(value).trim(), timestamp, true, result));
      return { command: command!, result, executionTimeMs: Math.round(performance.now() - start), historyWarning };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warning = this.recordHistory(entry, redisHistoryEntry(entry.session.database, String(value).trim(), timestamp, false, message));
      throw new Error(warning ? `${message}；${warning}` : message);
    }
  }
  disconnect(workspaceId: string, id: string): void {
    // Session replacement and view cleanup may both close the same session.
    if (!this.entries.has(id)) return;
    const { client, mutations, bulk, saving, monitors, pubsubs } = this.entry(workspaceId, id);
    if (this.entry(workspaceId, id).changingMode) throw new DatabaseInputError('Redis 会话正在切换，请等待后断开');
    if (saving) throw new DatabaseInputError('Redis 写入已发送，请等待实际确认后断开');
    mutations.clear();
    bulk.clear();
    for (const monitor of monitors) monitor.stop('Redis 会话已断开，MONITOR 已停止');
    for (const capture of pubsubs.values()) capture.stop('Redis 会话已断开，Pub/Sub 已断开');
    this.entries.delete(id);
    client.disconnect();
  }
  shutdown(): void {
    for (const { session } of this.entries.values()) this.disconnect(session.workspaceId, session.id);
  }
}
