import type { DatabaseCell, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import { sqlMutationInputSchema, type SqlMutationInput, type SqlMutationReview, type SqlMutationRowPreview } from '@fouc/shared/sql-mutation';
import type { DriverResult, RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { compileSqlMutation, type CompiledSqlMutation } from './sql-mutation-compile';
import { parseSqlMutation } from './sql-mutation-parser';
import { assertMutationEffects, mutationCellSignature, mutationStructureSignature, readMutationStructure, validateMutationNewValue } from './sql-mutation-safety';

export interface SqlMutationPlan {
  provider: RelationalProvider;
  maxRows: number;
  structure: RelationalTableStructure;
  structureSignature: string;
  compiled: CompiledSqlMutation;
  rows: SqlMutationRowPreview[];
  matchedRows: number;
}

export async function prepareSqlMutation(
  driver: RelationalDriver,
  provider: RelationalProvider,
  value: SqlMutationInput,
  signal?: AbortSignal,
): Promise<{ plan: SqlMutationPlan | null; review: SqlMutationReview }> {
  const parsed = sqlMutationInputSchema.safeParse(value);
  if (!parsed.success) throw new DatabaseInputError('SQL 写操作预览参数无效');
  const input = parsed.data;
  signal?.throwIfAborted();
  const ast = parseSqlMutation(input.sql, provider, input.schema);
  const structure = await readMutationStructure(driver, provider, ast.schema, ast.table);
  const compiled = compileSqlMutation(ast, structure, driver.quoteIdentifier, input.maxRows);
  await assertMutationEffects(driver, structure, ast.operation, ast.operation === 'insert' ? compiled.ast.insertColumns : compiled.ast.assignments.map((item) => item.column), signal);
  signal?.throwIfAborted();
  const result = await driver.read(compiled.previewSql, input.schema, input.maxRows + 1, [], signal);
  signal?.throwIfAborted();
  if (Buffer.byteLength(JSON.stringify(result.rows)) > 4 * 1024 * 1024) throw new DatabaseInputError('预览值超过 4 MiB，请缩小 WHERE 范围');
  const matchedRows = ast.operation === 'insert' ? ast.values.length : Number(result.rows[0]?.[compiled.projection.countIndex] ?? 0);
  if (!Number.isSafeInteger(matchedRows) || matchedRows < 0) throw new DatabaseInputError('数据库范围计数无法准确表示');
  const executable = matchedRows <= input.maxRows && !result.hasMore;
  const rows = mutationPreviewRows(result, structure, compiled);
  if (rows.some((row) => row.before && compiled.keyIndexes.some((index) => row.before![index] === null))) throw new DatabaseInputError('目标范围包含 NULL 主键，无法证明唯一行标识');
  const changedRows = ast.operation === 'update'
    ? rows.filter((row) => row.after!.some((cell, index) => cell.state === 'value' && mutationCellSignature(cell.value, structure.columns[index], provider) !== mutationCellSignature(row.before![index], structure.columns[index], provider))).length
    : matchedRows;
  const review: SqlMutationReview = {
    provider, schema: ast.schema, table: ast.table, operation: ast.operation,
    originalSql: input.sql, writeSql: compiled.writeSql, previewSql: compiled.previewSql, countSql: compiled.countSql,
    columns: structure.columns, matchedRows, changedRows: executable ? changedRows : null,
    rows: rows.slice(0, 50), sampleLimit: 50, executable,
    issues: executable ? [] : [`范围包含 ${matchedRows} 行，超过本次 ${input.maxRows} 行限制；没有生成执行计划`],
    limitations: [
      '预览仅执行确定性 SELECT；WHERE 范围与旧值会在提交事务内重新核对。',
      '仅支持单表、显式 INSERT VALUES 和 UPDATE / DELETE WHERE；不支持函数、子查询、跨表与键更新。',
      '提交持有原生范围或表锁；取消在当前语句结束后检查，提交发出后不能承诺撤销。',
      ...(rows.some((row) => row.after?.some((cell) => cell.state === 'database')) ? ['默认值、自增、生成字段不会在预览求值；界面会明确标记未知，序列和自增消耗不保证回退。'] : []),
      ...(provider === 'mysql' ? ['MySQL 仅支持 InnoDB 且要求 REPEATABLE READ / SERIALIZABLE；执行时使用严格模式，禁止静默截断。'] : []),
    ],
  };
  return {
    review,
    plan: executable ? { provider, maxRows: input.maxRows, structure, structureSignature: mutationStructureSignature(structure), compiled, rows, matchedRows } : null,
  };
}

export function mutationPreviewRows(result: DriverResult, structure: RelationalTableStructure, compiled: CompiledSqlMutation): SqlMutationRowPreview[] {
  const { columns, provider } = structure;
  return result.rows.map((row) => {
    const before = compiled.ast.operation === 'insert' ? null : compiled.projection.oldIndexes.map((index) => row[index]);
    if (compiled.ast.operation === 'delete') return { before, after: null };
    const after: NonNullable<SqlMutationRowPreview['after']> = columns.map((column, index) => {
      if (before && !compiled.generated.has(index)) return { state: 'value', value: before[index] };
      if (before) return { state: 'database', reason: '生成字段或自动更新字段在提交后确定' };
      if (provider === 'sqlite' && column.isPrimaryKey && /^integer$/i.test(column.dataType) && compiled.keyIndexes.length === 1 && structure.properties.withoutRowid !== 'true') return { state: 'database', reason: 'INTEGER PRIMARY KEY 由 SQLite 生成' };
      if (column.columnDefault === null && column.isNullable && !/generated|identity|auto_increment/i.test(column.extra ?? '')) return { state: 'value', value: null };
      return { state: 'database', reason: 'DEFAULT / 自增 / 生成值未在只读预览求值' };
    });
    for (const change of compiled.projection.changes) {
      const column = columns[change.column], typed = row[change.castIndex], raw = row[change.rawIndex];
      validateMutationNewValue(raw, typed, column, provider);
      after[change.column] = (provider === 'mysql' && /auto_increment/i.test(column.extra ?? '') && (typed === null || /^0+$/.test(String(typed)))) || (provider === 'sqlite' && column.isPrimaryKey && /^integer$/i.test(column.dataType) && compiled.keyIndexes.length === 1 && structure.properties.withoutRowid !== 'true' && typed === null)
        ? { state: 'database', reason: provider === 'sqlite' ? 'NULL 的 INTEGER PRIMARY KEY 由 SQLite 生成' : '0 / NULL 的 AUTO_INCREMENT 行标识由数据库模式决定' }
        : { state: 'value', value: typed };
    }
    return { before, after };
  });
}
