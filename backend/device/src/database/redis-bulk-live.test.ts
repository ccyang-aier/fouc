import { expect, test } from 'bun:test';
import Redis from 'ioredis';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { RedisBulkPlans } from './redis-bulk-plans';
import { RedisSessionManager } from './redis-session';

const live = process.env.FOUC_REDIS_BULK_LIVE === '1' ? test : test.skip;

live('native Redis bulk preview, guards, binary keys, TTL, dangerous delete and scoped once-only lifecycle', async () => {
  const environment = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
  const endpoint = new URL(environment.REDIS_URL!);
  const local = ['127.0.0.1', 'localhost'].includes(endpoint.hostname) || /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(endpoint.hostname);
  if (!local || endpoint.protocol !== 'redis:') throw new Error('批量 P0 仅允许本机 / WSL 私网 Redis、独立 DB 15');
  const options = { host: endpoint.hostname, port: Number(endpoint.port || 6379), username: decodeURIComponent(endpoint.username) || undefined,
    password: decodeURIComponent(endpoint.password) || undefined, db: 15, retryStrategy: () => null, maxRetriesPerRequest: 0, commandTimeout: 10000 };
  const client = new Redis(options);
  client.on('error', () => {});
  const prefix = `fouc:bulk-p0:${crypto.randomUUID()}:`;
  const a = prefix + 'a', b = prefix + 'b', missing = prefix + 'missing', big = prefix + 'big';
  const binary = Buffer.concat([Buffer.from(prefix), Buffer.from([0, 255])]);
  const owned = [a, b, missing, big, binary];
  const raw = (key: string | Buffer) => Buffer.from(key).toString('base64');
  const plans = new RedisBulkPlans(client, 15);
  const manager = new RedisSessionManager();
  try {
    await client.ping();
    await client.set(a, 'original', 'PX', 120000);
    await client.set(b, 'permanent');
    await client.set(binary, Buffer.from([255, 0, 1]));
    const originalDump = await client.dumpBuffer(a), originalExpiry = String(await client.call('PEXPIRETIME', a));
    const readonly = await plans.prepare({ database: 15, keys: [raw(a), raw(b)], operation: { kind: 'relative-ttl', milliseconds: '60000' } });
    expect(String(await client.call('PEXPIRETIME', a))).toBe(originalExpiry);
    expect(await client.dumpBuffer(a)).toEqual(originalDump);
    expect(readonly.keys[0]?.expiresAt).toBe(originalExpiry);
    expect(readonly.keys[0]?.dumpSha256.length).toBe(64);
    await client.set(a, 'externally changed', 'KEEPTTL');
    const conflict = await plans.commit(readonly.planId, true, false);
    expect(conflict.state).toBe('conflict');
    expect(conflict.applied).toBe(0);
    expect(conflict.keys[0]?.state).toBe('conflict');
    expect(String(await client.call('PEXPIRETIME', b))).toBe('-1');
    await expect(plans.commit(readonly.planId, true, false)).rejects.toThrow('已提交');

    const ttlGuard = await plans.prepare({ database: 15, keys: [raw(a), raw(b)], operation: { kind: 'persist' } });
    await client.pexpire(a, 180000);
    expect((await plans.commit(ttlGuard.planId, true, false)).state).toBe('conflict');
    expect(String(await client.call('PEXPIRETIME', b))).toBe('-1');
    const relative = await plans.prepare({ database: 15, keys: [raw(b), raw(binary)], operation: { kind: 'relative-ttl', milliseconds: '60000' } });
    expect(relative.keys[1]?.key.encoding).toBe('binary');
    const binaryDump = await client.dumpBuffer(binary);
    const applied = await plans.commit(relative.planId, true, false);
    expect(applied.applied).toBe(2);
    expect(await client.pttl(b)).toBeGreaterThan(59000);
    expect(await client.dumpBuffer(binary)).toEqual(binaryDump);
    const absoluteTime = String(Date.now() + 120000);
    const absolute = await plans.prepare({ database: 15, keys: [raw(binary)], operation: { kind: 'absolute-ttl', milliseconds: absoluteTime } });
    expect((await plans.commit(absolute.planId, true, false)).applied).toBe(1);
    expect(String(await client.call('PEXPIRETIME', binary))).toBe(absoluteTime);
    await client.persist(b);
    const persist = await plans.prepare({ database: 15, keys: [raw(binary), raw(b), raw(missing)], operation: { kind: 'persist' } });
    const persisted = await plans.commit(persist.planId, true, false);
    expect(persisted.applied).toBe(1);
    expect(persisted.unchanged).toBe(1);
    expect(persisted.missing).toBe(1);
    expect(String(await client.call('PEXPIRETIME', binary))).toBe('-1');

    await client.set(a, 'expires naturally', 'PX', 80);
    const expiring = await plans.prepare({ database: 15, keys: [raw(a), raw(b)], operation: { kind: 'delete' } });
    await new Promise(resolve => setTimeout(resolve, 110));
    expect((await plans.commit(expiring.planId, true, true)).state).toBe('conflict');
    expect(await client.get(b)).toBe('permanent');
    const deletion = await plans.prepare({ database: 15, keys: [raw(b), raw(binary)], operation: { kind: 'delete' } });
    expect(deletion.dangerous).toBe(true);
    await expect(plans.commit(deletion.planId, true, false)).rejects.toThrow('危险确认');
    expect(await client.exists(b, binary)).toBe(2);
    expect((await plans.commit(deletion.planId, true, true)).applied).toBe(2);
    expect(await client.exists(b, binary)).toBe(0);
    await client.set(big, Buffer.alloc(1048577));
    await expect(plans.prepare({ database: 15, keys: [raw(big)], operation: { kind: 'persist' } })).rejects.toThrow('快照上限');

    await client.set(b, 'scope');
    const session = await manager.connect('redis-bulk-p0', { provider: 'redis', host: options.host, port: options.port,
      username: options.username ?? '', password: options.password ?? '', database: 15, connectionOptions: {} });
    const scoped = await manager.prepareBulk('redis-bulk-p0', session.id, { database: 15, keys: [raw(b)], operation: { kind: 'persist' } });
    expect(() => manager.prepareBulk('other-workspace', session.id, {})).toThrow('工作空间');
    await expect(manager.commitBulk('redis-bulk-p0', session.id, scoped.planId, true, false)).rejects.toThrow('解锁');
    await manager.setReadOnly('redis-bulk-p0', session.id, false);
    await expect(manager.commitBulk('redis-bulk-p0', session.id, scoped.planId, true, false)).rejects.toThrow('失效');
    const renewed = await manager.prepareBulk('redis-bulk-p0', session.id, { database: 15, keys: [raw(b)], operation: { kind: 'persist' } });
    await manager.setReadOnly('redis-bulk-p0', session.id, true);
    await manager.setReadOnly('redis-bulk-p0', session.id, false);
    await expect(manager.commitBulk('redis-bulk-p0', session.id, renewed.planId, true, false)).rejects.toThrow('失效');
    expect(await client.get(b)).toBe('scope');
  } finally {
    manager.shutdown();
    plans.clear();
    await client.del(...owned);
    client.disconnect();
  }
}, 20000);
