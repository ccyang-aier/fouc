import type { RelationalProvider } from '@fouc/shared';
import { TABLE_CLEAR_LIMITS, parseTableClearInput, parseTableClearConfirmation, type TableClearInput, type TableClearPrepared, type TableClearCommitResult } from '@fouc/shared/table-clear';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { tableClearReview, tableClearSignature } from './table-clear-metadata';
import { tableClearPostgresFingerprint } from './table-clear-postgres';

interface HeldPlan { driver: RelationalDriver; provider: RelationalProvider; input: TableClearInput; signature: string; postgresFingerprint: string | null; prepared: TableClearPrepared }

/** One live Entry owns every plan; workspace/session authority remains with the session manager. */
export class TableClearPlans {
  private readonly plans = new Map<string, HeldPlan>();
  private readonly previews = new Set<AbortController>();
  private active: AbortController | null = null;

  clear(): void {
    this.plans.clear();
    this.active?.abort(new Error('表清空会话已关闭或重新锁定。'));
    for (const controller of this.previews) controller.abort(new Error('表清空审查已撤销。'));
  }
  discard(id: string): void { this.plans.delete(id); }
  async prepare(driver: RelationalDriver, provider: RelationalProvider, value: unknown, readable: () => void, signal?: AbortSignal): Promise<TableClearPrepared> {
    readable(); signal?.throwIfAborted();
    let input: TableClearInput;
    try { input = parseTableClearInput(value); }
    catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    if (this.active || this.previews.size >= TABLE_CLEAR_LIMITS.plans) throw new DatabaseInputError('当前连接忙或并行清空审查达到四项上限。');
    const controller = new AbortController(); this.previews.add(controller);
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const review = await tableClearReview(driver, provider, input, readable, request);
      const postgresFingerprint = provider === 'postgres' ? await tableClearPostgresFingerprint((sql, values) => driver.read(sql, input.schema, 1, values, request), input) : null;
      readable(); request.throwIfAborted();
      const now = Date.now();
      for (const [id, held] of this.plans) if (held.prepared.expiresAt <= now) this.plans.delete(id);
      if (this.plans.size >= TABLE_CLEAR_LIMITS.plans) throw new DatabaseInputError('未提交清空计划达到四项上限，请关闭旧审查。');
      const prepared = { planId: crypto.randomUUID(), expiresAt: now + TABLE_CLEAR_LIMITS.lifetimeMs, review };
      this.plans.set(prepared.planId, { driver, provider, input, signature: tableClearSignature(review), postgresFingerprint, prepared });
      return structuredClone(prepared);
    } finally { this.previews.delete(controller); }
  }

  async commit(driver: RelationalDriver, id: string, value: unknown, writable: () => void, signal?: AbortSignal): Promise<TableClearCommitResult> {
    writable(); signal?.throwIfAborted();
    if (this.active) throw new DatabaseInputError('当前连接正在清空表。');
    const held = this.plans.get(id); this.plans.delete(id);
    if (!held || held.driver !== driver || held.prepared.expiresAt <= Date.now()) throw new DatabaseInputError('清空审查已失效或连接已变化，请重新准备。');
    try {
      const confirm = parseTableClearConfirmation(value);
      if (confirm.tableName !== held.prepared.review.confirmationName) throw new Error('危险确认必须与完整 Schema.表名逐字一致。');
    } catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    const controller = new AbortController(); this.active = controller;
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const started = performance.now();
    let submitted = false, ddlAcknowledged = false, callbackComplete = false;
    let affectedRows: string | null = null;
    const result = (outcome: TableClearCommitResult['outcome'], message: string): TableClearCommitResult => ({ outcome, message, schema: held.input.schema, table: held.input.table, sql: held.prepared.review.sql, affectedRows, executionTimeMs: performance.now() - started });
    const verify = (review: TableClearPrepared['review']) => {
      if (review.blockedReasons.length) throw new DatabaseInputError(review.blockedReasons.join(' '));
      if (tableClearSignature(review) !== held.signature) throw new DatabaseInputError('目标结构、引用、触发器或权限已变化，请重新审查。');
      if (review.visibleRowCount !== held.prepared.review.visibleRowCount) throw new DatabaseInputError('当前可见行数已变化，请重新计数并审查；此计划不是数据快照。');
      if (held.prepared.expiresAt <= Date.now()) throw new DatabaseInputError('清空审查已过期，请重新准备。');
    };
    try {
      verify(await tableClearReview(driver, held.provider, held.input, writable, request));
      await driver.transaction(held.input.schema, async transaction => {
        writable(); request.throwIfAborted();
        if (held.provider === 'postgres') {
          await transaction.query(`LOCK TABLE ONLY ${driver.quoteIdentifier(held.input.schema)}.${driver.quoteIdentifier(held.input.table)} IN ACCESS EXCLUSIVE MODE`, []);
          writable(); request.throwIfAborted();
          const fingerprint = await tableClearPostgresFingerprint((sql, values) => transaction.query(sql, values), held.input);
          if (fingerprint !== held.postgresFingerprint) throw new DatabaseInputError('PostgreSQL 锁内原生结构、权限、引用或触发器已变化，请重新审查。');
          const count = await transaction.query(`SELECT COUNT(*) FROM ${driver.quoteIdentifier(held.input.schema)}.${driver.quoteIdentifier(held.input.table)}`, []);
          if (String(count.rows[0]?.[0]) !== held.prepared.review.visibleRowCount) throw new DatabaseInputError('PostgreSQL 锁内行数已变化，请重新审查。');
        }
        // SQLite BEGIN IMMEDIATE excludes schema writers while the final native read uses its transaction.
        // Pg uses the fixed locked catalog probe above; external collectors could deadlock on this lock.
        if (held.provider === 'sqlite') verify(await tableClearReview(driver, held.provider, held.input, writable, request, transaction));
        writable(); request.throwIfAborted(); submitted = true;
        const cleared = await transaction.query(held.prepared.review.sql, []);
        ddlAcknowledged = true;
        if (held.provider === 'mysql') { callbackComplete = true; return; }
        if (held.provider === 'sqlite' && Number.isSafeInteger(cleared.affectedRows)) affectedRows = String(cleared.affectedRows);
        writable(); request.throwIfAborted();
        const qualified = driver.quoteIdentifier(held.input.schema) + '.' + driver.quoteIdentifier(held.input.table);
        const after = await transaction.query(`SELECT COUNT(*) FROM ${qualified}`, []);
        if (String(after.rows[0]?.[0]) !== '0') throw new DatabaseInputError('清空后原生触发器仍留下数据，事务已停止并请求回滚；请审查触发器。');
        writable(); request.throwIfAborted(); callbackComplete = true;
      });
      return result('cleared', held.provider === 'mysql'
        ? 'MySQL 已确认 TRUNCATE，DDL 已隐式提交且不能回滚；之后的外部写入可能使表再次非空。'
        : '原生事务已确认清空并提交，表结构与 identity / sequence 保留；之后的外部写入可能使表再次非空。');
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      if (held.provider === 'mysql' && ddlAcknowledged) return result('cleared', `MySQL 已确认 TRUNCATE 并隐式提交，后续连接收尾失败不撤销清空。${error.message}`);
      const native = error as Error & { code?: string; sqlState?: string; errcode?: number };
      const code = native.sqlState ?? native.code ?? '';
      const rejected = reason instanceof DatabaseInputError || request.aborted || /^(?:22|23|28|42|3D|3F|53|55)[A-Z0-9]{3}$/.test(code)
        || /^ER_(?:TRUNCATE_ILLEGAL_FK|ROW_IS_REFERENCED_2|DBACCESS_DENIED_ERROR|ACCESS_DENIED_ERROR|SPECIFIC_ACCESS_DENIED_ERROR|NO_SUCH_TABLE|PARSE_ERROR|LOCK_WAIT_TIMEOUT|LOCK_DEADLOCK|CHECK_NOT_IMPLEMENTED)$/.test(code)
        || /^SQLITE_(?:ERROR|CONSTRAINT|READONLY|FULL|BUSY|LOCKED)/.test(code) || code === 'ERR_SQLITE_ERROR';
      const unknown = submitted && (callbackComplete || !rejected || held.provider === 'mysql' && request.aborted);
      affectedRows = null;
      return result(unknown ? 'unknown' : 'rejected', `${unknown ? '清空提交结果未确认，请刷新原生行数核对，不要自动重试。' : '表清空未提交；原生事务已停止或语句被拒绝。'}${error.message}`);
    } finally { this.active = null; }
  }
}
