import type { RelationalProvider } from '@fouc/shared';
import { parseSchemaCreateInput, type SchemaCreateInput, type SchemaCreateOptions, type SchemaCreatePrepared, type SchemaCreateCommitResult } from '@fouc/shared/schema-create';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { schemaCreateExists, schemaCreateOptions } from './schema-create-metadata';

type HeldPlan = { driver: RelationalDriver; provider: 'mysql' | 'postgres'; database: string; input: SchemaCreateInput; prepared: SchemaCreatePrepared };
const LIFETIME = 5 * 60_000;

function validateOptions(input: SchemaCreateInput, options: SchemaCreateOptions): void {
  if (!options.supported) throw new DatabaseInputError('此驱动不支持创建资源。');
  if (options.permission === 'denied') throw new DatabaseInputError('当前数据库角色没有 CREATE 权限。');
  if (input.charset) {
    const charset = options.charsets.find(item => item.name === input.charset);
    if (!charset || (input.collation && !charset.collations.includes(input.collation))) throw new DatabaseInputError('字符集或校对规则不在当前服务器的真实目录中，请重新读取选项。');
  }
}
function sqlFor(provider: 'mysql' | 'postgres', input: SchemaCreateInput): string {
  const quoted = provider === 'mysql' ? '`' + input.name.replaceAll('`', '``') + '`' : '"' + input.name.replaceAll('"', '""') + '"';
  return provider === 'mysql'
    ? `CREATE DATABASE ${quoted}${input.charset ? ` CHARACTER SET ${input.charset}` : ''}${input.collation ? ` COLLATE ${input.collation}` : ''};`
    : `CREATE SCHEMA ${quoted};`;
}
function nativeError(reason: unknown): { message: string; definite: boolean } {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  const source = error as Error & { code?: string; sqlState?: string };
  const code = source.sqlState ?? source.code ?? '';
  // SQL statement rejection is authoritative. Transport errors and uncertain COMMIT acknowledgments are not.
  const definite = /^(?:22|23|28|42|3D|3F)[A-Z0-9]{3}$/.test(code) || /^ER_(?:DB_CREATE_EXISTS|DBACCESS_DENIED_ERROR|ACCESS_DENIED_ERROR|SPECIFIC_ACCESS_DENIED_ERROR|WRONG_DB_NAME|UNKNOWN_CHARACTER_SET|UNKNOWN_COLLATION|COLLATION_CHARSET_MISMATCH)$/.test(source.code ?? '');
  const hint = /1044|access denied.*database/i.test(error.message) ? ' 请使用已具有目标 CREATE 权限的数据库角色。' : '';
  return { message: error.message + hint, definite };
}

/** One session-owned live Entry owns these plans. No SQL can be supplied at commit. */
export class SchemaCreatePlans {
  private readonly plans = new Map<string, HeldPlan>();
  private readonly previews = new Set<AbortController>();
  private active: AbortController | null = null;

  clear(): void {
    this.plans.clear();
    this.active?.abort(new Error('创建会话已关闭或重新锁定。'));
    for (const request of this.previews) request.abort(new Error('创建预览已撤销。'));
  }
  discard(id: string): void { this.plans.delete(id); }
  options(driver: RelationalDriver, provider: RelationalProvider, database: string, readable: () => void, signal?: AbortSignal) {
    readable();
    return schemaCreateOptions(driver, provider, database, readable, signal);
  }

  async prepare(driver: RelationalDriver, provider: RelationalProvider, database: string, value: unknown, readable: () => void, signal?: AbortSignal): Promise<SchemaCreatePrepared> {
    readable(); signal?.throwIfAborted();
    let input: SchemaCreateInput;
    try { input = parseSchemaCreateInput(provider, value); }
    catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    if (provider === 'sqlite') throw new DatabaseInputError('SQLite 不支持创建 Schema。');
    if (this.active || this.previews.size >= 4) throw new DatabaseInputError('当前连接忙或已达到四个并行预览上限。');
    const controller = new AbortController();
    this.previews.add(controller);
    const request = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    try {
      const options = await schemaCreateOptions(driver, provider, database, readable, request);
      validateOptions(input, options);
      if (await schemaCreateExists(driver, provider, input.name, request)) throw new DatabaseInputError('此名称已存在，请选择新的资源名称。');
      readable(); request.throwIfAborted();
      const now = Date.now();
      for (const [id, item] of this.plans) if (item.prepared.expiresAt <= now) this.plans.delete(id);
      if (this.plans.size >= 4) throw new DatabaseInputError('未提交的创建预览已达到四项，请关闭旧预览。');
      const prepared: SchemaCreatePrepared = { planId: crypto.randomUUID(), expiresAt: now + LIFETIME, review: { provider, database, name: input.name, target: provider === 'mysql' ? 'database' : 'schema', sql: sqlFor(provider, input), warnings: options.warnings } };
      this.plans.set(prepared.planId, { driver, provider, database, input, prepared });
      return structuredClone(prepared);
    } finally { this.previews.delete(controller); }
  }

  async commit(driver: RelationalDriver, id: string, writable: () => void, signal?: AbortSignal): Promise<SchemaCreateCommitResult> {
    writable(); signal?.throwIfAborted();
    if (this.active) throw new DatabaseInputError('当前连接正在创建资源。');
    const plan = this.plans.get(id);
    this.plans.delete(id);
    if (!plan || plan.driver !== driver || plan.prepared.expiresAt <= Date.now()) throw new DatabaseInputError('创建计划已失效或连接已变化，请重新审查。');
    const controller = new AbortController();
    this.active = controller;
    const request = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    const started = performance.now();
    let submitted = false;
    const result = (outcome: SchemaCreateCommitResult['outcome'], message: string): SchemaCreateCommitResult => ({ outcome, message, target: plan.prepared.review.target, name: plan.input.name, sql: plan.prepared.review.sql, executionTimeMs: performance.now() - started });
    try {
      const options = await schemaCreateOptions(driver, plan.provider, plan.database, writable, request);
      validateOptions(plan.input, options);
      if (await schemaCreateExists(driver, plan.provider, plan.input.name, request)) return result('rejected', '名称在审查后已存在，本计划未执行 CREATE。');
      writable(); request.throwIfAborted();
      await driver.transaction(plan.database, async transaction => {
        writable(); request.throwIfAborted();
        submitted = true;
        await transaction.query(plan.prepared.review.sql, []);
        // PostgreSQL can roll back CREATE SCHEMA if the live owner disappears before COMMIT.
        // MySQL has already implicitly committed DDL; any interruption is reported as uncertain.
        writable(); request.throwIfAborted();
      });
      return result('created', `${plan.input.name} 已由数据库服务器确认创建；目录已可刷新。`);
    } catch (reason) {
      const error = nativeError(reason);
      return result(!submitted || error.definite ? 'rejected' : 'unknown', submitted && !error.definite ? `执行结果未确认，请刷新目录核对，避免重复创建。${error.message}` : `创建未完成。${error.message}`);
    } finally { this.active = null; }
  }
}
