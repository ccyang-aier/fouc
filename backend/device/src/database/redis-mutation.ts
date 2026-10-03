import type Redis from 'ioredis';
import type { RedisMutation, RedisMutationPreview, RedisMutationResult } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { redisBlob } from './redis-blob';
import { redisMutation, REDIS_WRITE_BYTES } from './redis-mutation-input';
import { REDIS_MUTATION_SCRIPT, REDIS_SNAPSHOT_SCRIPT } from './redis-mutation-script';

const LIFETIME = 5 * 60 * 1000;
type Snapshot = { key: Buffer; type: string; dump: Buffer; expiry: string; expiresAt: number; generation: number };
type Command = [string, ...(Buffer | string)[]];
type Plan = { snapshot: Snapshot; mutation: RedisMutation; commands: Command[]; expiresAt: number };
const bytes = (value: string) => Buffer.from(value, 'base64');
function invocation(plan: Plan, mode: 'preview' | 'commit'): (Buffer | string)[] {
  const { snapshot, mutation, commands } = plan;
  const key = bytes(mutation.key);
  const keys = mutation.kind === 'rename' ? [key, bytes(mutation.destination)] : [key];
  const args: (Buffer | string)[] = [snapshot.type, snapshot.dump, snapshot.expiry, mutation.kind, String(commands.length)];
  for (const command of commands) args.push(String(command.length), ...command);
  if (mutation.kind === 'hash-set') args.push(bytes(mutation.field));
  if (mutation.kind === 'zset-set') args.push(bytes(mutation.member));
  args.push(mode);
  return [REDIS_MUTATION_SCRIPT, String(keys.length), ...keys, ...args];
}

function commandsFor(mutation: RedisMutation): Command[] {
  const key = bytes(mutation.key);
  switch (mutation.kind) {
    case 'delete': return [['DEL', key]];
    case 'rename': return [['RENAMENX', key, bytes(mutation.destination)]];
    case 'expiry': return mutation.mode === 'persist' ? [['PERSIST', key]] :
      [[mutation.mode === 'relative' ? 'PEXPIRE' : 'PEXPIREAT', key, mutation.milliseconds]];
    case 'string-set': return [['SET', key, bytes(mutation.value), 'KEEPTTL']];
    case 'list-push': return [[mutation.side === 'left' ? 'LPUSH' : 'RPUSH', key, bytes(mutation.value)]];
    case 'list-set': return [['LSET', key, mutation.index, bytes(mutation.value)]];
    case 'list-remove': {
      // Never use DBX's fixed deletion placeholder: a real value could match it.
      const marker = Buffer.from(`\0fouc:remove:${crypto.randomUUID()}`);
      return [['LSET', key, mutation.index, marker], ['LREM', key, '1', marker]];
    }
    case 'set-add': return [['SADD', key, bytes(mutation.member)]];
    case 'set-remove': return [['SREM', key, bytes(mutation.member)]];
    case 'hash-add': return [['HSET', key, bytes(mutation.field), bytes(mutation.value)]];
    case 'hash-set': return [
      ['HSET', key, bytes(mutation.destination), bytes(mutation.value)],
      ...(mutation.field === mutation.destination ? [] : [['HDEL', key, bytes(mutation.field)] as Command]),
    ];
    case 'hash-remove': return [['HDEL', key, bytes(mutation.field)]];
    case 'hash-expiry': return mutation.mode === 'persist' ? [['HPERSIST', key, 'FIELDS', '1', bytes(mutation.field)]] :
      [[mutation.mode === 'relative' ? 'HPEXPIRE' : 'HPEXPIREAT', key, mutation.milliseconds, 'FIELDS', '1', bytes(mutation.field)]];
    case 'zset-add': return [['ZADD', key, mutation.score, bytes(mutation.member)]];
    case 'zset-set': return [
      ['ZADD', key, mutation.score, bytes(mutation.destination)],
      ...(mutation.member === mutation.destination ? [] : [['ZREM', key, bytes(mutation.member)] as Command]),
    ];
    case 'zset-remove': return [['ZREM', key, bytes(mutation.member)]];
    case 'stream-add': return [['XADD', key, mutation.entryId, ...mutation.fields.flatMap((field) => [bytes(field.field), bytes(field.value)])]];
    case 'stream-remove': return [['XDEL', key, mutation.entryId]];
    case 'create':
      switch (mutation.type) {
        case 'string': return [['SET', key, bytes(mutation.value), 'NX']];
        case 'list': return [['RPUSH', key, bytes(mutation.value)]];
        case 'set': return [['SADD', key, bytes(mutation.value)]];
        case 'hash': return [['HSET', key, bytes(mutation.field), bytes(mutation.value)]];
        case 'zset': return [['ZADD', key, mutation.score, bytes(mutation.member)]];
        case 'stream': return [['XADD', key, mutation.entryId, ...mutation.fields.flatMap((field) => [bytes(field.field), bytes(field.value)])]];
      }
  }
}
function requiredType(mutation: RedisMutation): string | null {
  if (mutation.kind === 'create') return 'none';
  if (mutation.kind === 'delete' || mutation.kind === 'rename' || mutation.kind === 'expiry') return null;
  return mutation.kind.split('-')[0]!;
}
export function sameRedisSnapshot(left: Snapshot, right: Snapshot): boolean {
  return left.generation === right.generation && left.key.equals(right.key) && left.type === right.type && left.expiry === right.expiry && left.dump.equals(right.dump);
}

/** Session-owned preview/revision stores. Relock and disconnect revoke every token. */
export class RedisMutationManager {
  private readonly revisions = new Map<string, Snapshot>();
  private readonly plans = new Map<string, Plan>();
  private executing = false;
  private generation = 0;
  constructor(private readonly client: Redis) {}
  clear(): void {
    if (this.executing) throw new DatabaseInputError('Redis 变更正在执行，请等待结果后重新锁定或断开');
    this.generation++;
    this.revisions.clear();
    this.plans.clear();
  }
  private prune(): void {
    const now = Date.now();
    for (const [id, value] of this.revisions) if (value.expiresAt <= now) this.revisions.delete(id);
    for (const [id, value] of this.plans) if (value.expiresAt <= now) this.plans.delete(id);
  }
  async snapshot(key: Buffer): Promise<Snapshot> {
    const generation = this.generation;
    const reply = await this.client.callBuffer('EVAL', REDIS_SNAPSHOT_SCRIPT, '1', key, String(REDIS_WRITE_BYTES));
    if (generation !== this.generation) throw new DatabaseInputError('Redis 编辑授权已重新锁定或断开');
    if (!Array.isArray(reply) || reply.length !== 3) throw new Error('Redis 编辑快照返回无效');
    return { key, type: String(reply[0]), dump: Buffer.from(reply[1] as Buffer), expiry: String(reply[2]), expiresAt: Date.now() + LIFETIME, generation };
  }
  remember(snapshot: Snapshot): string {
    if (snapshot.generation !== this.generation) throw new DatabaseInputError('Redis 编辑授权已失效');
    this.prune();
    // Bounded session memory; old tabs must refresh when their token is evicted.
    while (this.revisions.size >= 32) this.revisions.delete(this.revisions.keys().next().value!);
    const id = crypto.randomUUID();
    this.revisions.set(id, snapshot);
    return id;
  }
  async prepare(raw: unknown, version: unknown): Promise<RedisMutationPreview> {
    if (this.executing) throw new DatabaseInputError('Redis 变更正在执行');
    this.prune();
    const mutation = redisMutation(raw);
    const key = bytes(mutation.key);
    const current = await this.snapshot(key);
    let snapshot = current;
    if (mutation.kind !== 'create') {
      const original = typeof version === 'string' ? this.revisions.get(version) : undefined;
      if (!original || !sameRedisSnapshot(original, current))
        throw new DatabaseInputError('编辑版本已失效或 Key 已变化，请刷新后重新编辑');
      snapshot = original;
      if (snapshot.type === 'none') throw new DatabaseInputError('Key 已不存在');
    }
    const type = requiredType(mutation);
    if (type !== null && snapshot.type !== type) throw new DatabaseInputError('目标 Key 已存在或类型与变更不一致');
    const commands = commandsFor(mutation);
    const id = crypto.randomUUID();
    const expiresAt = Math.min(snapshot.expiresAt, Date.now() + LIFETIME);
    while (this.plans.size >= 20) this.plans.delete(this.plans.keys().next().value!);
    const plan = { snapshot, mutation, commands, expiresAt };
    // Dry run includes field-expiry preservation, every guard and ACL check.
    // Reply buffers preserve binary command arguments in the user-visible plan.
    const checked = await this.client.callBuffer('EVAL', ...invocation(plan, 'preview'));
    if (snapshot.generation !== this.generation) throw new DatabaseInputError('Redis 编辑授权已失效');
    if (!Array.isArray(checked)) throw new Error('Redis 变更预览返回无效');
    const previewCommands = checked.map((row) => {
      if (!Array.isArray(row) || !row.length) throw new Error('Redis 变更命令返回无效');
      return { command: String(row[0]), arguments: row.slice(1).map((arg) => redisBlob(Buffer.from(arg))) };
    });
    this.plans.set(id, plan);
    return {
      id, expiresAt, kind: mutation.kind, key: redisBlob(key),
      commands: previewCommands,
      notes: [
        '预览不会写入。确认时再次检查完整内容与绝对过期时间；发生变化则拒绝提交。',
        ...(mutation.kind === 'create' ? ['新 Key 初始为永久；创建后可单独设置过期时间。'] :
          mutation.kind === 'expiry' || mutation.kind === 'hash-expiry' ? ['相对 TTL 从确认执行时起算；永久表示移除对应过期时间。'] : ['保留 Key 当前过期时间；删除最后一个集合成员时 Key 可能消失。']),
        ...(mutation.kind === 'hash-set' ? ['若 Redis 支持字段过期时间，则保留原字段期限；所需权限不足时拒绝提交。'] : []),
        ...(commands.length > 1 || mutation.kind === 'hash-set' ? ['多步操作先核对命令权限；执行错误会尝试恢复原始快照，恢复失败将要求核对结果。'] : []),
      ],
    };
  }
  async commit(id: unknown, confirmed: unknown): Promise<RedisMutationResult> {
    if (confirmed !== true || typeof id !== 'string') throw new DatabaseInputError('请确认 Redis 变更预览');
    if (this.executing) throw new DatabaseInputError('Redis 变更正在执行');
    this.prune();
    const plan = this.plans.get(id);
    if (!plan) throw new DatabaseInputError('Redis 变更预览已过期或已提交，请重新预览');
    this.plans.delete(id);
    this.executing = true;
    const start = performance.now();
    try {
      const { mutation } = plan;
      const key = bytes(mutation.key);
      const result = await this.client.call('EVAL', ...invocation(plan, 'commit'));
      this.revisions.clear();
      const resultKey = mutation.kind === 'rename' ? bytes(mutation.destination) : key;
      return { key: redisBlob(resultKey), deleted: mutation.kind === 'delete', result: String(result), executionTimeMs: Math.round(performance.now() - start) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/FOUC_(CONFLICT|PERMISSION|LIMIT)/.test(message)) throw new DatabaseInputError(message.replace(/FOUC_\w+ /, ''));
      if (/timeout|connection|socket|closed/i.test(message)) throw new Error('Redis 提交结果未确认，请刷新 Key 核对后再操作');
      throw error;
    } finally { this.executing = false; }
  }
}
