import type { MongoClient } from 'mongodb';
import { prepareMongoMutation, commitMongoMutation, type MongoMutationPlan } from './mongo-mutation';
import { DatabaseInputError } from './input-error';

/** Stored inside one workspace-owned session; locking or disconnect revokes every token. */
export class MongoMutationPlans {
  private readonly plans = new Map<string, { value: MongoMutationPlan; expiresAt: number }>();
  private active: AbortController | null = null;
  clear() { this.plans.clear(); this.active?.abort(new Error('MongoDB 写入计划已撤销')); }
  discard(id: string) { this.plans.delete(id); }
  async prepare(client: MongoClient, input: unknown, writable: () => void, signal?: AbortSignal) {
    writable(); signal?.throwIfAborted();
    const prepared = await prepareMongoMutation(client, input, signal);
    writable(); signal?.throwIfAborted();
    const now = Date.now();
    for (const [id, plan] of this.plans) if (plan.expiresAt <= now) this.plans.delete(id);
    if (this.plans.size >= 4) throw new DatabaseInputError('未提交 MongoDB 计划达到四项上限，请关闭旧审查');
    const planId = crypto.randomUUID();
    this.plans.set(planId, { value: prepared.plan, expiresAt: now + 5 * 60_000 });
    return { planId, review: prepared.review };
  }
  async commit(client: MongoClient, id: string, writable: () => void, signal?: AbortSignal) {
    const plan = this.plans.get(id);
    if (!plan || plan.expiresAt <= Date.now()) throw new DatabaseInputError('MongoDB 计划已失效，请重新预览');
    if (this.active) throw new DatabaseInputError('MongoDB 连接正在提交变更');
    this.plans.delete(id);
    const controller = new AbortController(); this.active = controller;
    try {
      writable();
      return await commitMongoMutation(client, plan.value, signal ? AbortSignal.any([signal, controller.signal]) : controller.signal);
    } finally { this.active = null; }
  }
}
