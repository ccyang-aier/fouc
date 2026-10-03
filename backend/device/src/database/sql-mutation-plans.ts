import type { RelationalProvider } from '@fouc/shared';
import type { SqlMutationCommitResult, SqlMutationPrepared } from '@fouc/shared/sql-mutation';
import { sqlMutationInputSchema } from '@fouc/shared/sql-mutation';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { commitSqlMutation } from './sql-mutation-commit';
import { prepareSqlMutation, type SqlMutationPlan } from './sql-mutation-preview';

/** One instance belongs to exactly one workspace-owned session; client submits a token, never executable SQL. */
export class SqlMutationPlans {
  private readonly plans = new Map<string, { driver: RelationalDriver; value: SqlMutationPlan; expiresAt: number }>();
  private readonly previews = new Set<AbortController>();
  private active: AbortController | null = null;

  clear(): void {
    this.plans.clear();
    this.active?.abort(new Error('SQL 写操作计划已撤销'));
    for (const controller of this.previews) controller.abort(new Error('SQL 预览已撤销'));
  }

  discard(id: string): void { this.plans.delete(id); }

  async prepare(driver: RelationalDriver, provider: RelationalProvider, value: unknown, readable: () => void, signal?: AbortSignal): Promise<SqlMutationPrepared> {
    readable();
    const input = sqlMutationInputSchema.safeParse(value);
    if (!input.success) throw new DatabaseInputError('SQL 预览参数无效');
    if (this.active || this.previews.size >= 4) throw new DatabaseInputError('连接正在执行变更或已达到四个并行预览上限');
    const controller = new AbortController();
    this.previews.add(controller);
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const prepared = await prepareSqlMutation(driver, provider, input.data, request);
      readable();
      request.throwIfAborted();
      if (!prepared.plan) return { planId: null, expiresAt: null, review: prepared.review };
      const now = Date.now();
      for (const [id, plan] of this.plans) if (plan.expiresAt <= now) this.plans.delete(id);
      if (this.plans.size >= 4) throw new DatabaseInputError('未提交 SQL 计划达到四项上限，请关闭旧审查');
      const planId = crypto.randomUUID(), expiresAt = now + 5 * 60_000;
      this.plans.set(planId, { driver, value: prepared.plan, expiresAt });
      return { planId, expiresAt, review: structuredClone(prepared.review) };
    } finally { this.previews.delete(controller); }
  }

  async commit(driver: RelationalDriver, id: string, writable: () => void, signal?: AbortSignal): Promise<SqlMutationCommitResult> {
    writable();
    const plan = this.plans.get(id);
    if (!plan || plan.driver !== driver || plan.expiresAt <= Date.now()) {
      this.plans.delete(id);
      return { outcome: 'conflict' as const, affectedRows: 0, matchedRows: plan?.value.matchedRows ?? 0, executionTimeMs: 0, error: 'SQL 计划已失效或连接已变化，请重新预览' };
    }
    if (this.active) throw new DatabaseInputError('当前连接正在提交 SQL 变更');
    this.plans.delete(id);
    const controller = new AbortController();
    this.active = controller;
    try {
      writable();
      const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      return await commitSqlMutation(driver, plan.value, writable, request);
    } finally { this.active = null; }
  }
}
