import { createHash } from 'node:crypto';
import type { RelationalTableStructure } from '@fouc/shared';
import type { TableTransferPlan, TableTransferProgress, TableTransferResult } from '@fouc/shared/table-transfer';
import { DatabaseInputError } from './input-error';

export const transferStructureSignature = (value: RelationalTableStructure) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type PreparedTransfer = { workspace: string; sourceId: string; targetId: string; plan: TableTransferPlan; sourceSignature: string; targetSignature: string; expiresAt: number };
type TransferTask = { workspace: string; sourceId: string; targetId: string; controller: AbortController; revision: number; progress: TableTransferProgress | null; result: TableTransferResult | null; updatedAt: number };

/** Plans contain server-read metadata. A task survives HTTP polling and never retries a write. */
export class TableTransferPlans {
  private readonly plans = new Map<string, PreparedTransfer>();
  private readonly tasks = new Map<string, TransferTask>();
  private prune() {
    const now = Date.now();
    for (const [id, plan] of this.plans) if (plan.expiresAt <= now) this.plans.delete(id);
    for (const [id, task] of this.tasks) if (task.result && task.updatedAt < now - 10 * 60_000) this.tasks.delete(id);
  }
  prepare(workspace: string, sourceId: string, targetId: string, plan: TableTransferPlan, source: RelationalTableStructure, target: RelationalTableStructure) {
    this.prune();
    if ([...this.plans.values()].filter(value => value.sourceId === sourceId).length >= 4 || this.plans.size >= 64) throw new DatabaseInputError('未执行传输计划过多，请关闭旧审查');
    const id = crypto.randomUUID();
    this.plans.set(id, { workspace, sourceId, targetId, plan, sourceSignature: transferStructureSignature(source), targetSignature: transferStructureSignature(target), expiresAt: Date.now() + 5 * 60_000 });
    return { planId: id, plan };
  }
  consume(workspace: string, sourceId: string, id: string): PreparedTransfer {
    this.prune();
    const plan = this.plans.get(id);
    if (!plan || plan.workspace !== workspace || plan.sourceId !== sourceId) throw new DatabaseInputError('传输计划已失效，请重新准备');
    this.plans.delete(id);
    return plan;
  }
  discard(workspace: string, sourceId: string, id: string) {
    const plan = this.plans.get(id);
    if (plan && plan.workspace === workspace && plan.sourceId === sourceId) this.plans.delete(id);
  }
  start(plan: PreparedTransfer, run: (signal: AbortSignal, progress: (value: TableTransferProgress) => void) => Promise<TableTransferResult>) {
    this.prune();
    if (this.tasks.size >= 32) throw new DatabaseInputError('传输任务过多，请稍后重试');
    const id = crypto.randomUUID(), started = Date.now();
    const task: TransferTask = { workspace: plan.workspace, sourceId: plan.sourceId, targetId: plan.targetId, controller: new AbortController(), revision: 1, progress: null, result: null, updatedAt: started };
    this.tasks.set(id, task);
    const progress = (value: TableTransferProgress) => { task.progress = value; task.revision++; task.updatedAt = Date.now(); };
    void run(task.controller.signal, progress).then(result => { task.result = result; }).catch(reason => {
      task.result = { status: task.controller.signal.aborted ? 'cancelled' : 'failed', transaction: 'not-started', rowsRead: 0, rowsWritten: 0, rowsCommitted: 0, batchesWritten: 0, bytesRead: 0, sourceHasMore: null, elapsedMs: Date.now() - started, error: reason instanceof Error ? reason.message : String(reason) };
    }).finally(() => { task.revision++; task.updatedAt = Date.now(); });
    return { taskId: id };
  }
  private task(workspace: string, sourceId: string, id: string) {
    this.prune();
    const value = this.tasks.get(id);
    if (!value || value.workspace !== workspace || value.sourceId !== sourceId) throw new DatabaseInputError('当前工作空间中的传输任务不存在或已过期');
    return value;
  }
  poll(workspace: string, sourceId: string, id: string) {
    const task = this.task(workspace, sourceId, id);
    return { revision: task.revision, progress: task.progress, result: task.result, cancelRequested: task.controller.signal.aborted };
  }
  cancel(workspace: string, sourceId: string, id: string) {
    const task = this.task(workspace, sourceId, id);
    if (!task.result) task.controller.abort(new Error('用户请求取消传输'));
    return this.poll(workspace, sourceId, id);
  }
  clearSession(id: string) {
    for (const [key, value] of this.plans) if (value.sourceId === id || value.targetId === id) this.plans.delete(key);
    for (const task of this.tasks.values()) if (!task.result && (task.sourceId === id || task.targetId === id)) task.controller.abort(new Error('传输连接已关闭'));
  }
}
