import type { RelationalProvider } from '@fouc/shared';
import type { TableImportInput, TableImportPlan, TableImportAppendSummary } from '@fouc/shared/table-import';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { columnSignature } from './relational-save';
import { appendTableImport, previewTableImport, tableImportInput } from './table-import';

type Plan = { input: TableImportInput; signature: string; bytes: number; expiresAt: number };
const LIFETIME = 5 * 60_000, MAX_BYTES = 20 * 1024 * 1024, MAX_PLANS = 4;

/** One session owns its bounded previews and a single cancellable append transaction. */
export class TableImportPlans {
  private readonly plans = new Map<string, Plan>();
  private active: AbortController | null = null;

  clear() { this.plans.clear(); this.active?.abort(); }
  discard(id: string) { this.plans.delete(id); }

  async prepare(driver: RelationalDriver, provider: RelationalProvider, value: unknown, writable: () => void, signal?: AbortSignal): Promise<TableImportPlan> {
    writable();
    const input = tableImportInput(value), review = await previewTableImport(driver, provider, input, signal);
    signal?.throwIfAborted(); writable();
    for (const [id, plan] of this.plans) if (plan.expiresAt <= Date.now()) this.plans.delete(id);
    const bytes = Buffer.byteLength(input.text), heldBytes = [...this.plans.values()].reduce((sum, plan) => sum + plan.bytes, 0);
    if (this.plans.size >= MAX_PLANS || bytes + heldBytes > MAX_BYTES) throw new DatabaseInputError('未提交的导入预览过多，请关闭旧预览后重试。');
    const planId = crypto.randomUUID();
    this.plans.set(planId, { input, bytes, signature: columnSignature(review.targetColumns), expiresAt: Date.now() + LIFETIME });
    return { planId, review };
  }

  async commit(driver: RelationalDriver, provider: RelationalProvider, id: string, writable: () => void, signal?: AbortSignal): Promise<TableImportAppendSummary> {
    writable();
    if (this.active) throw new DatabaseInputError('当前连接正在导入，请等待事务结束。');
    const plan = this.plans.get(id);
    if (!plan || plan.expiresAt <= Date.now()) { this.plans.delete(id); throw new DatabaseInputError('导入预览已失效，请重新生成。'); }
    this.plans.delete(id);
    const controller = new AbortController(); this.active = controller;
    const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    try {
      requestSignal.throwIfAborted();
      const columns = await driver.columns(plan.input.schema, plan.input.table);
      writable(); requestSignal.throwIfAborted();
      if (columnSignature(columns) !== plan.signature) throw new DatabaseInputError('表结构已变化，请刷新后重新预览导入。');
      return await appendTableImport(driver, provider, plan.input, requestSignal);
    } finally { if (this.active === controller) this.active = null; }
  }
}
