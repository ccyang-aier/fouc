import { createHash } from 'node:crypto';
import { structureEditInputSchema, type StructureEditInput } from '@fouc/shared/relational-structure-edit';
import type { RelationalTableStructure } from '@fouc/shared';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { previewStructureEdit } from './structure-edit-preview';
import { commitStructureEdit } from './structure-edit-commit';

type Plan = { schema: string; table: string; input: StructureEditInput; signature: string; expiresAt: number };
const signature = (structure: RelationalTableStructure) => createHash('sha256').update(JSON.stringify(structure)).digest('hex');
/** Session-owned structured DDL plans. Client SQL and client metadata are never trusted. */
export class StructureEditPlans {
  private readonly plans = new Map<string, Plan>();
  private active: AbortController | null = null;
  async prepare(read: (schema: string, table: string) => Promise<RelationalTableStructure>, value: unknown, writable: () => void, signal?: AbortSignal) {
    writable(); signal?.throwIfAborted();
    if (!value || typeof value !== 'object') throw new DatabaseInputError('表结构编辑参数无效');
    const body = value as Record<string, unknown>;
    if (typeof body.schema !== 'string' || typeof body.table !== 'string' || !body.schema || !body.table || body.schema.length > 256 || body.table.length > 256) throw new DatabaseInputError('表结构编辑目标无效');
    const parsed = structureEditInputSchema.safeParse({ operations: body.operations });
    if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data)) > 1024 * 1024) throw new DatabaseInputError('结构化变更无效或超过 1 MiB');
    const structure = await read(body.schema, body.table);
    writable(); signal?.throwIfAborted();
    const review = previewStructureEdit(structure, parsed.data);
    const now = Date.now();
    for (const [id, plan] of this.plans) if (plan.expiresAt <= now) this.plans.delete(id);
    if (this.plans.size >= 4) throw new DatabaseInputError('未提交结构计划已达到四项上限，请关闭旧审查');
    const planId = crypto.randomUUID();
    this.plans.set(planId, { schema: body.schema, table: body.table, input: parsed.data, signature: signature(structure), expiresAt: now + 5 * 60_000 });
    return { planId, review };
  }
  discard(id: string) { this.plans.delete(id); }
  clear() { this.plans.clear(); this.active?.abort(new Error('表结构编辑会话已关闭')); }
  async commit(driver: RelationalDriver, read: (schema: string, table: string) => Promise<RelationalTableStructure>, id: string, writable: () => void, signal?: AbortSignal) {
    const plan = this.plans.get(id);
    if (!plan || plan.expiresAt <= Date.now()) throw new DatabaseInputError('结构预览已失效，请重新生成');
    if (this.active) throw new DatabaseInputError('当前连接正在提交结构变更');
    this.plans.delete(id);
    const controller = new AbortController(); this.active = controller;
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      writable(); request.throwIfAborted();
      const structure = await read(plan.schema, plan.table);
      writable(); request.throwIfAborted();
      if (signature(structure) !== plan.signature) throw new DatabaseInputError('表结构已变化，请重新读取并生成预览');
      return await commitStructureEdit(driver, structure, plan.input, { signal: request });
    } finally { this.active = null; }
  }
}
