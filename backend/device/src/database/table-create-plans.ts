import { validationIssueFromError } from '@fouc/shared';
import type { RelationalProvider } from '@fouc/shared';
import {
  TABLE_CREATE_LIMITS,
  type TableCreateCommitResult,
  type TableCreatePrepared,
  type TableCreateInput,
} from '@fouc/shared/table-create';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { assertTableCreateTarget, tableCreateOptions } from './table-create-metadata';
import { buildTableCreateReview } from './table-create-sql';
type HeldPlan = {
  driver: RelationalDriver;
  provider: RelationalProvider;
  input: TableCreateInput;
  prepared: TableCreatePrepared;
};
/** Each live Entry owns its bounded, disposable DDL plans; only a token is accepted at commit. */
export class TableCreatePlans {
  private readonly plans = new Map<string, HeldPlan>();
  private readonly previews = new Set<AbortController>();
  private active: AbortController | null = null;
  clear(): void {
    this.plans.clear();
    this.active?.abort(new Error('建表会话已关闭或重新锁定。'));
    for (const controller of this.previews) controller.abort(new Error('建表审查已撤销。'));
  }
  discard(id: string): void {
    this.plans.delete(id);
  }
  options(
    driver: RelationalDriver,
    provider: RelationalProvider,
    database: string,
    readable: () => void,
    signal?: AbortSignal,
  ) {
    return tableCreateOptions(driver, provider, database, readable, signal);
  }
  async prepare(
    driver: RelationalDriver,
    provider: RelationalProvider,
    _database: string,
    value: unknown,
    readable: () => void,
    signal?: AbortSignal,
  ): Promise<TableCreatePrepared> {
    readable();
    signal?.throwIfAborted();
    let built: ReturnType<typeof buildTableCreateReview>;
    try {
      built = buildTableCreateReview(provider, value);
    } catch (reason) {
      throw new DatabaseInputError(
        reason instanceof Error ? reason.message : String(reason),
        validationIssueFromError(reason),
      );
    }
    if (this.active || this.previews.size >= TABLE_CREATE_LIMITS.plans)
      throw new DatabaseInputError('当前连接忙或并行建表审查达到四项上限。');
    const controller = new AbortController();
    this.previews.add(controller);
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      await assertTableCreateTarget(
        driver,
        provider,
        built.input.schema,
        built.input.table,
        readable,
        request,
      );
      const now = Date.now();
      for (const [id, held] of this.plans)
        if (held.prepared.expiresAt <= now) this.plans.delete(id);
      if (this.plans.size >= TABLE_CREATE_LIMITS.plans)
        throw new DatabaseInputError('未提交的建表审查达到四项上限，请关闭旧预览。');
      const prepared = {
        planId: crypto.randomUUID(),
        expiresAt: now + TABLE_CREATE_LIMITS.lifetimeMs,
        review: built.review,
      };
      this.plans.set(prepared.planId, { driver, provider, input: built.input, prepared });
      return structuredClone(prepared);
    } finally {
      this.previews.delete(controller);
    }
  }
  async commit(
    driver: RelationalDriver,
    id: string,
    writable: () => void,
    signal?: AbortSignal,
  ): Promise<TableCreateCommitResult> {
    writable();
    signal?.throwIfAborted();
    if (this.active) throw new DatabaseInputError('当前会话正在建表。');
    const held = this.plans.get(id);
    this.plans.delete(id);
    if (!held || held.driver !== driver || held.prepared.expiresAt <= Date.now())
      throw new DatabaseInputError('建表审查已失效或连接已变化，请重新准备。');
    const controller = new AbortController();
    this.active = controller;
    const request = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const started = performance.now();
    let submitted = false;
    let callbackComplete = false;
    const result = (
      outcome: TableCreateCommitResult['outcome'],
      message: string,
    ): TableCreateCommitResult => ({
      outcome,
      message,
      schema: held.input.schema,
      table: held.input.table,
      sql: held.prepared.review.sql,
      executionTimeMs: performance.now() - started,
    });
    try {
      await assertTableCreateTarget(
        driver,
        held.provider,
        held.input.schema,
        held.input.table,
        writable,
        request,
      );
      await driver.transaction(held.input.schema, async (transaction) => {
        writable();
        request.throwIfAborted();
        submitted = true;
        await transaction.query(held.prepared.review.sql, []);
        writable();
        request.throwIfAborted();
        callbackComplete = true;
      });
      return result('created', '数据库服务器已确认创建空表，目录与结构可以刷新。');
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const source = error as Error & {
        code?: string;
        sqlState?: string;
        errcode?: number;
      };
      const code = source.sqlState ?? source.code ?? '';
      const nativeRejection =
        /^(?:22|23|28|42|3D|3F|53|55)[A-Z0-9]{3}$/.test(code) ||
        /^ER_(?:TABLE_EXISTS_ERROR|DBACCESS_DENIED_ERROR|ACCESS_DENIED_ERROR|SPECIFIC_ACCESS_DENIED_ERROR|BAD_DB_ERROR|WRONG_TABLE_NAME|INVALID_DEFAULT|PARSE_ERROR|TOO_BIG_ROWSIZE|TOO_LONG_KEY|BLOB_KEY_WITHOUT_LENGTH|WRONG_AUTO_KEY)$/.test(
          source.code ?? '',
        ) ||
        /^SQLITE_(?:ERROR|CONSTRAINT|READONLY|FULL|BUSY|LOCKED)/.test(code) ||
        (source.code === 'ERR_SQLITE_ERROR' &&
          [1, 3, 5, 6, 8, 13, 19, 20, 21, 25].includes((source.errcode ?? 0) & 255));
      const unknown = submitted && (callbackComplete || !nativeRejection);
      return result(
        unknown ? 'unknown' : 'rejected',
        unknown
          ? `建表提交结果未确认，请刷新目录核对，避免重复提交。${error.message}`
          : `建表未完成。${error.message}`,
      );
    } finally {
      this.active = null;
    }
  }
}
