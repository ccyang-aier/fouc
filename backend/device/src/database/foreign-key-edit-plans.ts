import {
  FOREIGN_KEY_EDIT_LIMITS,
  type ForeignKeyEditInput,
  type ForeignKeyEditPrepared,
  type ForeignKeyEditCommitResult,
} from "@fouc/shared/foreign-key-edit";
import type { RelationalProvider } from "@fouc/shared";
import type { RelationalDriver } from "./drivers/relational-driver";
import { DatabaseInputError } from "./input-error";
import {
  foreignKeyOptions,
  foreignKeyTarget,
} from "./foreign-key-edit-metadata";
import { reviewForeignKey } from "./foreign-key-edit-review";

type Held = {
  driver: RelationalDriver;
  provider: RelationalProvider;
  schema: string;
  table: string;
  input: ForeignKeyEditInput;
  signature: string;
  prepared: ForeignKeyEditPrepared;
};

/** Plans belong to one live Entry and can submit exactly one catalog-validated native DDL statement. */
export class ForeignKeyEditPlans {
  private readonly plans = new Map<string, Held>();
  private readonly previews = new Set<AbortController>();
  private active: AbortController | null = null;
  clear(): void {
    this.plans.clear();
    this.active?.abort(new Error("外键写入已锁定或会话已关闭"));
    for (const preview of this.previews)
      preview.abort(new Error("外键审查已撤销"));
  }
  discard(id: string): void {
    this.plans.delete(id);
  }
  options(
    driver: RelationalDriver,
    provider: RelationalProvider,
    schema: string,
    table: string,
    readable: () => void,
    signal?: AbortSignal,
  ) {
    return foreignKeyOptions(driver, provider, schema, table, readable, signal);
  }
  async target(
    driver: RelationalDriver,
    provider: RelationalProvider,
    schema: string,
    table: string,
    readable: () => void,
    signal?: AbortSignal,
  ) {
    return (
      await foreignKeyTarget(driver, provider, schema, table, readable, signal)
    ).target;
  }
  async prepare(
    driver: RelationalDriver,
    provider: RelationalProvider,
    schema: string,
    table: string,
    value: unknown,
    readable: () => void,
    signal?: AbortSignal,
  ): Promise<ForeignKeyEditPrepared> {
    readable();
    signal?.throwIfAborted();
    if (this.active || this.previews.size >= FOREIGN_KEY_EDIT_LIMITS.plans)
      throw new DatabaseInputError("当前连接忙或外键并行审查超过四项");
    const controller = new AbortController();
    this.previews.add(controller);
    const request = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    try {
      const built = await reviewForeignKey(
        driver,
        provider,
        schema,
        table,
        value,
        readable,
        request,
      );
      readable();
      request.throwIfAborted();
      const now = Date.now();
      for (const [id, held] of this.plans)
        if (held.prepared.expiresAt <= now) this.plans.delete(id);
      if (this.plans.size >= FOREIGN_KEY_EDIT_LIMITS.plans)
        throw new DatabaseInputError("未提交的外键审查达到四项，请关闭旧审查");
      const prepared: ForeignKeyEditPrepared = {
        planId: crypto.randomUUID(),
        expiresAt: now + FOREIGN_KEY_EDIT_LIMITS.lifetimeMs,
        review: built.review,
      };
      this.plans.set(prepared.planId, {
        driver,
        provider,
        schema,
        table,
        input: built.review.input,
        signature: built.signature,
        prepared,
      });
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
  ): Promise<ForeignKeyEditCommitResult> {
    writable();
    signal?.throwIfAborted();
    if (this.active) throw new DatabaseInputError("当前连接正在提交外键DDL");
    const held = this.plans.get(id);
    this.plans.delete(id);
    if (
      !held ||
      held.driver !== driver ||
      held.prepared.expiresAt <= Date.now()
    )
      throw new DatabaseInputError("外键审查已失效或连接已变化，请重新准备");
    const controller = new AbortController();
    this.active = controller;
    const request = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    let submitted = false,
      callbackComplete = false;
    const started = performance.now();
    const result = (
      outcome: ForeignKeyEditCommitResult["outcome"],
      message: string,
    ): ForeignKeyEditCommitResult => ({
      outcome,
      message,
      schema: held.schema,
      table: held.table,
      sql: held.prepared.review.sql,
      executionTimeMs: performance.now() - started,
    });
    try {
      const fresh = await reviewForeignKey(
        driver,
        held.provider,
        held.schema,
        held.table,
        held.input,
        writable,
        request,
      );
      if (fresh.signature !== held.signature)
        throw new DatabaseInputError(
          "两表字段、索引或约束已变化，请重新读取目录并审查",
        );
      await driver.transaction(held.schema, async (transaction) => {
        writable();
        request.throwIfAborted();
        submitted = true;
        await transaction.query(held.prepared.review.sql, []);
        writable();
        request.throwIfAborted();
        callbackComplete = true;
      });
      return result(
        "applied",
        `原生数据库已确认${held.input.kind === "create" ? "创建" : "删除"}外键 ${held.input.name}。`,
      );
    } catch (reason) {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      const native = error as Error & { code?: string; sqlState?: string };
      const code = native.sqlState ?? native.code ?? "";
      const rejected =
        /^(?:22|23|28|42|3D|3F|53|55)[A-Z0-9]{3}$/.test(code) ||
        /^ER_(?:CANNOT_ADD_FOREIGN|FK_DUP_NAME|DUP_KEYNAME|CANT_DROP_FIELD_OR_KEY|NO_REFERENCED_ROW_2|ROW_IS_REFERENCED_2|FK_INCOMPATIBLE_COLUMNS|FK_COLUMN_NOT_NULL|FK_NO_INDEX_PARENT|DBACCESS_DENIED_ERROR|ACCESS_DENIED_ERROR|SPECIFIC_ACCESS_DENIED_ERROR|TABLEACCESS_DENIED_ERROR|REFERENCED_TRG_DOES_NOT_EXIST|WRONG_FK_DEF|PARSE_ERROR)$/.test(
          native.code ?? "",
        );
      const unknown = submitted && (callbackComplete || !rejected);
      return result(
        unknown ? "unknown" : "rejected",
        unknown
          ? `外键提交结果未确认，请刷新原生目录核对；不要重复提交。${error.message}`
          : `外键变更未应用。${error.message}`,
      );
    } finally {
      this.active = null;
    }
  }
}
