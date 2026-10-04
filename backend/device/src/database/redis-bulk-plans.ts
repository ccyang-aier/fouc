import type Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { REDIS_BULK_LIMITS as LIMITS, type RedisBulkPreview, type RedisBulkResult, type RedisBulkKeyState } from '@fouc/shared/redis-bulk';
import { DatabaseInputError } from './input-error';
import { redisBlob } from './redis-blob';
import { redisBulkInput } from './redis-bulk-input';
import { REDIS_BULK_COMMIT_SCRIPT, REDIS_BULK_SNAPSHOT_SCRIPT } from './redis-bulk-script';

type Snapshot = { type: string; dump: Buffer; expiry: string };
type Plan = { preview: RedisBulkPreview; snapshots: Snapshot[] };
const KEY_STATES = new Set<RedisBulkKeyState>(['applied', 'unchanged', 'missing', 'conflict', 'failed', 'skipped', 'unknown']);

export class RedisBulkPlans {
  private readonly plans = new Map<string, Plan>();
  private generation = 0;
  private executing = false;
  private preparing = 0;
  constructor(private readonly client: Redis, private readonly database: number) {}

  clear(): void {
    if (this.executing) throw new DatabaseInputError('Redis 原子批次已经发送，请等待确认后锁定或断开');
    this.generation++;
    this.plans.clear();
  }
  discard(id: unknown): void { if (typeof id === 'string') this.plans.delete(id); }
  private prune(): void {
    for (const [id, plan] of this.plans) if (plan.preview.expiresAt < Date.now()) this.plans.delete(id);
  }
  async prepare(value: unknown, signal?: AbortSignal): Promise<RedisBulkPreview> {
    if (this.executing) throw new DatabaseInputError('当前 Redis 连接正在执行批次');
    this.prune();
    if (this.plans.size + this.preparing >= 4) throw new DatabaseInputError('最多保留或读取 4 份批量预览，请关闭旧预览');
    const input = redisBulkInput(value, this.database), generation = this.generation;
    signal?.throwIfAborted();
    this.preparing++;
    try {
      const milliseconds = 'milliseconds' in input.operation ? input.operation.milliseconds : '';
      const reply = await this.client.callBuffer('EVAL_RO', REDIS_BULK_SNAPSHOT_SCRIPT, String(input.keys.length),
        ...input.keys.map(key => Buffer.from(key, 'base64')), input.operation.kind, milliseconds, String(LIMITS.snapshotBytes), String(LIMITS.snapshotTotalBytes));
      signal?.throwIfAborted();
      if (generation !== this.generation) throw new DatabaseInputError('连接、数据库或写入权限已变化，请重新预览');
      if (!Array.isArray(reply) || reply.length !== 3 || !Array.isArray(reply[2]) || reply[2].length !== input.keys.length) throw new Error('Redis 批量快照返回无效');
      const snapshots: Snapshot[] = reply[2].map(row => {
        if (!Array.isArray(row) || row.length !== 3 || !Buffer.isBuffer(row[1])) throw new Error('Redis 原始 DUMP 快照返回无效');
        return { type: String(row[0]), dump: row[1], expiry: String(row[2]) };
      });
      const preview: RedisBulkPreview = {
        planId: crypto.randomUUID(),
        database: this.database,
        operation: input.operation,
        serverTime: String(reply[0]),
        expiresAt: Date.now() + LIMITS.planMs,
        dangerous: String(reply[1]) === '1',
        keys: input.keys.map((key, index) => ({
          key: redisBlob(Buffer.from(key, 'base64')),
          type: snapshots[index].type,
          expiresAt: snapshots[index].expiry,
          dumpBytes: snapshots[index].dump.byteLength,
          dumpSha256: createHash('sha256').update(snapshots[index].dump).digest('hex'),
        })),
        notes: [
          'EVAL_RO 只读预览，不修改任何 Key。提交前在单个 Lua 脚本内检查全部原始 DUMP、类型、绝对期限和命令权限；任一冲突则整个批次不写入。',
          '单个 Lua 批次没有并发交错；Redis 不提供脚本错误回滚。运行时命令失败会停止后续项，并如实保留已确认结果。',
          '预览时缺失且提交时仍缺失的 Key 跳过；自然过期或被外部修改的原 Key 会阻断提交。相对 TTL 从实际确认执行时开始。',
          '只处理明确选择的最多 100 个 Key；不扩展通配符。每个快照最多 1 MiB、合计 8 MiB，仅支持 Redis 7+ Standalone。',
        ],
      };
      this.plans.set(preview.planId, { preview, snapshots });
      return preview;
    } finally { this.preparing--; }
  }
  async commit(id: unknown, confirmed: unknown, dangerConfirmed: unknown, signal?: AbortSignal): Promise<RedisBulkResult> {
    if (typeof id !== 'string' || confirmed !== true) throw new DatabaseInputError('请明确确认已预览的 Redis 批量变更');
    if (this.executing) throw new DatabaseInputError('Redis 批量变更正在执行');
    this.prune();
    const plan = this.plans.get(id);
    if (!plan) throw new DatabaseInputError('批量计划已过期、失效或已提交，请重新预览');
    if (plan.preview.dangerous && dangerConfirmed !== true) throw new DatabaseInputError('删除或立即过期需要额外危险确认');
    signal?.throwIfAborted();
    this.plans.delete(id); // Consume before dispatch; a transport failure never re-enables this plan.
    this.executing = true;
    const started = performance.now();
    const result: RedisBulkResult = { planId: id, database: this.database, state: 'unknown', executionTimeMs: 0, keys: [], applied: 0, unchanged: 0, missing: 0, unknown: 0 };
    try {
      const { preview, snapshots } = plan;
      const milliseconds = 'milliseconds' in preview.operation ? preview.operation.milliseconds : '';
      const reply = await this.client.callBuffer('EVAL', REDIS_BULK_COMMIT_SCRIPT, String(preview.keys.length),
        ...preview.keys.map(item => Buffer.from(item.key.rawBase64, 'base64')), preview.operation.kind, milliseconds,
        preview.dangerous ? '1' : '0', String(LIMITS.snapshotBytes), String(LIMITS.snapshotTotalBytes),
        ...snapshots.flatMap(item => [item.type, item.dump, item.expiry]));
      if (!Array.isArray(reply) || reply.length !== 3 || !Array.isArray(reply[2]) || reply[2].length !== preview.keys.length || !['complete', 'conflict', 'partial'].includes(String(reply[0]))) throw new Error('Redis 批量确认返回无效，请核对全部 Key');
      const rows = reply[2].map((row, index) => {
        if (!Array.isArray(row) || row.length !== 3 || !KEY_STATES.has(String(row[0]) as RedisBulkKeyState)) throw new Error('Redis 批量逐项确认返回无效');
        return { key: preview.keys[index].key, state: String(row[0]) as RedisBulkKeyState, expiresAt: String(row[1]) || null, reason: String(row[2]) || null };
      });
      result.state = String(reply[0]) as RedisBulkResult['state'];
      result.keys = rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Redis rejects these before starting the write phase. Socket/timeout or unexpected script errors remain unknown.
      const rejected = /^(?:NOPERM|NOAUTH|READONLY|OOM|BUSY|NOSCRIPT)|FOUC_(?:LIMIT|PERMISSION)/i.test(message);
      result.state = rejected ? 'failed' : 'unknown';
      result.keys = plan.preview.keys.map(item => ({ key: item.key, state: rejected ? 'failed' : 'unknown', expiresAt: null, reason: message }));
    } finally { this.executing = false; result.executionTimeMs = Math.round(performance.now() - started); }
    for (const key of result.keys) {
      if (key.state === 'applied') result.applied++;
      if (key.state === 'unchanged') result.unchanged++;
      if (key.state === 'missing') result.missing++;
      if (key.state === 'unknown') result.unknown++;
    }
    return result;
  }
}
