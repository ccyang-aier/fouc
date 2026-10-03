import { compileSqlTemplate, splitSqlExecutionRanges, tokenizeSqlSemantic, type RelationalProvider, type SqlTemplateInput } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import type { DriverResult, RelationalDriver } from './drivers/relational-driver';
import { assertMysqlReadOnlySql } from './mysql-read-only-sql';
import { assertRelationalReadSql } from './relational-sql';
import { mysqlExplainCompatibilityHint } from './sql-explain-compatibility';

export const SQL_EXPLAIN_MAX_ROWS = 4096;
export type SqlExplainFormat = 'json' | 'standard' | 'query-plan';
export type SqlExplainStatement = { sourceSql: string; sql: string; schema: string | null; format: SqlExplainFormat };
export type SqlExplainResult = DriverResult & SqlExplainStatement & { warnings: string[] };
export type SqlExplainInput = SqlTemplateInput & { sql: string; schema: string | null; format?: 'json' | 'standard' };

/** DBX estimated-plan construction, restricted to Fouc's native read policy and installed providers. */
export function buildSqlExplain(provider: RelationalProvider, value: unknown): SqlExplainStatement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('执行计划参数无效');
  const input = value as Record<string, unknown>;
  if (typeof input.sql !== 'string' || !input.sql.trim() || Buffer.byteLength(input.sql) > 1_000_000) throw new DatabaseInputError('执行计划 SQL 不能为空且最多 1 MB');
  if (input.schema !== null && (typeof input.schema !== 'string' || !input.schema.trim() || input.schema.length > 1024 || input.schema.includes('\0'))) throw new DatabaseInputError('执行计划 Schema 无效');
  if (input.analyze !== undefined) throw new DatabaseInputError('当前执行计划仅支持 EXPLAIN，不运行 ANALYZE');
  if (input.format !== undefined && input.format !== 'json' && input.format !== 'standard') throw new DatabaseInputError('执行计划格式无效');
  if (input.parameters !== undefined && (!input.parameters || typeof input.parameters !== 'object' || Array.isArray(input.parameters))) throw new DatabaseInputError('执行计划参数值无效');
  let compiled: string;
  try { compiled = compileSqlTemplate(input.sql, provider, { parameters: input.parameters as SqlTemplateInput['parameters'], declarationSql: input.declarationSql as string | undefined }).sql; }
  catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
  const statements = splitSqlExecutionRanges(compiled, provider);
  if (statements.length !== 1) throw new DatabaseInputError('每次只生成一条查询的执行计划');
  const source = statements[0].sql.trim().replace(/;\s*$/, '');
  const leading = tokenizeSqlSemantic(source, provider).find((token) => token.kind !== 'comment');
  if (leading?.kind !== 'word' || !['select', 'with'].includes(leading.normalized)) throw new DatabaseInputError('执行计划仅支持 SELECT 或 WITH 查询');
  provider === 'mysql' ? assertMysqlReadOnlySql(source) : assertRelationalReadSql(source, provider);
  const format = provider === 'sqlite' ? 'query-plan' : provider === 'mysql' && input.format === 'standard' ? 'standard' : 'json';
  const prefix = provider === 'postgres' ? 'EXPLAIN (FORMAT JSON, ANALYZE FALSE) '
    : provider === 'sqlite' ? 'EXPLAIN QUERY PLAN '
      : format === 'standard' ? 'EXPLAIN FORMAT=TRADITIONAL ' : 'EXPLAIN FORMAT=JSON ';
  return { sourceSql: input.sql, sql: prefix + source, schema: input.schema as string | null, format };
}

/** Caller owns workspace/session resolution; this function sends only the validated plan statement. */
export async function explainSqlPlan(driver: Pick<RelationalDriver, 'read'>, provider: RelationalProvider, value: unknown, signal?: AbortSignal): Promise<SqlExplainResult> {
  const statement = buildSqlExplain(provider, value);
  signal?.throwIfAborted();
  let result: DriverResult;
  const warnings: string[] = [];
  try { result = await driver.read(statement.sql, statement.schema, SQL_EXPLAIN_MAX_ROWS, [], signal); }
  catch (error) {
    signal?.throwIfAborted();
    const hint = provider === 'mysql' ? mysqlExplainCompatibilityHint(error, statement.sql) : undefined;
    if (!hint?.fallbackSql || hint.supportsJson) throw error;
    statement.sql = hint.fallbackSql;
    statement.format = 'standard';
    warnings.push('当前服务器不支持 JSON 执行计划，已使用标准 EXPLAIN 表格。');
    result = await driver.read(statement.sql, statement.schema, SQL_EXPLAIN_MAX_ROWS, [], signal);
  }
  if (result.hasMore) warnings.push(`执行计划超过 ${SQL_EXPLAIN_MAX_ROWS} 行，显示的是已返回部分。`);
  return { ...result, ...statement, warnings };
}
