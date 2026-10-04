import type { RelationalProvider } from '@fouc/shared';
import { INDEX_EDIT_LIMITS, parseIndexEditInput, type IndexEditInput, type IndexEditPrepared, type IndexEditCommitResult } from '@fouc/shared/index-edit';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { assertIndexEditNameAvailable, indexEditOptions, indexEditSignature } from './index-edit-metadata';
import { buildIndexEditReview } from './index-edit-sql';

interface HeldPlan { driver: RelationalDriver; provider: RelationalProvider; input: IndexEditInput; signature: string; prepared: IndexEditPrepared }

/** Owned by one workspace-scoped live Entry. Locking/disconnecting revokes every held plan. */
export class IndexEditPlans {
  private readonly plans = new Map<string, HeldPlan>();
  private readonly previews = new Set<AbortController>();
  private active: AbortController | null = null;

  clear(): void {
    this.plans.clear();
    this.active?.abort(new Error('索引管理会话已关闭或重新锁定。'));
    for (const controller of this.previews) controller.abort(new Error('索引审查已撤销。'));
  }
  discard(id: string): void { this.plans.delete(id); }
  options(driver: RelationalDriver, provider: RelationalProvider, schema: string, table: string, readable: () => void, signal?: AbortSignal) {
    return indexEditOptions(driver, provider, schema, table, readable, signal);
  }
  async prepare(driver: RelationalDriver, provider: RelationalProvider, value: unknown, readable: () => void, signal?: AbortSignal): Promise<IndexEditPrepared> {
    readable(); signal?.throwIfAborted();
    let input: IndexEditInput;
    try { input = parseIndexEditInput(provider, value); }
    catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    if (this.active || this.previews.size >= INDEX_EDIT_LIMITS.plans) throw new DatabaseInputError('当前连接忙或并行索引审查达到四项上限。');
    const controller = new AbortController(); this.previews.add(controller);
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const options = await indexEditOptions(driver, provider, input.schema, input.table, readable, request);
      let built: ReturnType<typeof buildIndexEditReview>;
      try { built = buildIndexEditReview(options, input); }
      catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
      await assertIndexEditNameAvailable(driver, provider, input, readable, request);
      const now = Date.now();
      for (const [id, plan] of this.plans) if (plan.prepared.expiresAt <= now) this.plans.delete(id);
      if (this.plans.size >= INDEX_EDIT_LIMITS.plans) throw new DatabaseInputError('未提交的索引审查达到四项上限，请关闭旧预览。');
      const prepared = { planId: crypto.randomUUID(), expiresAt: now + INDEX_EDIT_LIMITS.lifetimeMs, review: built.review };
      this.plans.set(prepared.planId, { driver, provider, input, signature: indexEditSignature(options), prepared });
      return structuredClone(prepared);
    } finally { this.previews.delete(controller); }
  }
  async commit(driver: RelationalDriver, id: string, writable: () => void, signal?: AbortSignal): Promise<IndexEditCommitResult> {
    writable(); signal?.throwIfAborted();
    if (this.active) throw new DatabaseInputError('当前连接正在修改索引。');
    const held = this.plans.get(id); this.plans.delete(id);
    if (!held || held.driver !== driver || held.prepared.expiresAt <= Date.now()) throw new DatabaseInputError('索引审查已失效或连接已变化，请重新准备。');
    const controller = new AbortController(); this.active = controller;
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const started = performance.now();
    let submitted = false, callbackComplete = false;
    const result = (outcome: IndexEditCommitResult['outcome'], message: string): IndexEditCommitResult => ({
      outcome, message, schema: held.input.schema, table: held.input.table, index: held.prepared.review.index,
      sql: held.prepared.review.sql, executionTimeMs: performance.now() - started,
    });
    const fresh = async () => {
      const options = await indexEditOptions(driver, held.provider, held.input.schema, held.input.table, writable, request);
      buildIndexEditReview(options, held.input);
      if (indexEditSignature(options) !== held.signature) throw new DatabaseInputError('表字段、索引、约束或原生能力已变化，请刷新并重新审查。');
      await assertIndexEditNameAvailable(driver, held.provider, held.input, writable, request);
    };
    try {
      await fresh();
      await driver.transaction(held.input.schema, async transaction => {
        writable(); request.throwIfAborted();
        // Hold native schema protection across the final check and DDL. SQLite BEGIN IMMEDIATE
        // already excludes concurrent schema writers. MySQL DDL acquires its own metadata lock.
        if (held.provider === 'postgres') {
          await transaction.query(`LOCK TABLE ${driver.quoteIdentifier(held.input.schema)}.${driver.quoteIdentifier(held.input.table)} IN SHARE MODE`, []);
          await fresh();
        } else if (held.provider === 'sqlite') await fresh();
        writable(); request.throwIfAborted(); submitted = true;
        await transaction.query(held.prepared.review.sql, []);
        writable(); request.throwIfAborted(); callbackComplete = true;
      });
      return result(held.input.operation === 'create' ? 'created' : 'dropped', '原生服务器已确认索引变更。既有数据未修改；结构与行编辑权限已请求刷新。');
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const native = error as Error & { code?: string; sqlState?: string; errcode?: number };
      const code = native.sqlState ?? native.code ?? '';
      const rejection = /^(?:22|23|28|42|3D|3F|53|55)[A-Z0-9]{3}$/.test(code)
        || /^ER_(?:DUP_KEYNAME|DUP_ENTRY|CANT_DROP_FIELD_OR_KEY|DROP_INDEX_FK|FK_INCORRECT_OPTION|DBACCESS_DENIED_ERROR|ACCESS_DENIED_ERROR|SPECIFIC_ACCESS_DENIED_ERROR|BAD_DB_ERROR|NO_SUCH_TABLE|PARSE_ERROR|TOO_LONG_KEY|BLOB_KEY_WITHOUT_LENGTH|WRONG_SUB_KEY|NOT_SUPPORTED_YET)$/.test(native.code ?? '')
        || /^SQLITE_(?:ERROR|CONSTRAINT|READONLY|FULL|BUSY|LOCKED)/.test(code)
        || native.code === 'ERR_SQLITE_ERROR' && [1, 3, 5, 6, 8, 13, 19, 20, 21, 25].includes((native.errcode ?? 0) & 255);
      const unknown = submitted && (callbackComplete || !rejection);
      return result(unknown ? 'unknown' : 'rejected', `${unknown ? '索引提交结果未确认，请刷新真实结构核对，不要直接重复提交。' : '索引变更未完成。'}${error.message}`);
    } finally { this.active = null; }
  }
}
