import type { DatabaseCell } from '@fouc/shared';
import type { SqlMutationCommitResult } from '@fouc/shared/sql-mutation';
import type { RelationalDriver, RelationalTransaction, SqlParameter } from './drivers/relational-driver';
import type { SqlMutationPlan } from './sql-mutation-preview';
import { mutationPreviewRows } from './sql-mutation-preview';
import { assertMutationEffects, mutationCellSignature, mutationRowSignature, mutationStructureSignature, readMutationStructure } from './sql-mutation-safety';

export class SqlMutationConflictError extends Error {}

export async function commitSqlMutation(
  driver: RelationalDriver,
  plan: SqlMutationPlan,
  writable: () => void,
  signal?: AbortSignal,
): Promise<SqlMutationCommitResult> {
  writable();
  const started = performance.now();
  let callbackComplete = false, affectedRows = 0;
  const { provider, structure, compiled } = plan;
  const target = `${driver.quoteIdentifier(structure.schema)}.${driver.quoteIdentifier(structure.table)}`;
  try {
    signal?.throwIfAborted();
    await driver.transaction(structure.schema, async (transaction) => {
      if (provider === 'postgres') await transaction.query(`LOCK TABLE ${target} IN SHARE ROW EXCLUSIVE MODE`, []);
      if (provider === 'mysql') {
        const isolation = await transaction.query('SELECT @@SESSION.transaction_isolation', []);
        if (!['REPEATABLE-READ', 'SERIALIZABLE'].includes(String(isolation.rows[0]?.[0]).toUpperCase())) throw new Error('MySQL 当前隔离级别无法保证目标范围稳定，请使用 REPEATABLE READ / SERIALIZABLE');
        await transaction.query(`SELECT 1 FROM ${target} WHERE 1=0 FOR UPDATE`, []);
      }
      signal?.throwIfAborted();
      const fresh = await readMutationStructure(driver, provider, structure.schema, structure.table);
      if (mutationStructureSignature(fresh) !== plan.structureSignature) throw new SqlMutationConflictError('表结构已变化，请重新生成预览');
      await assertMutationEffects(driver, fresh, compiled.ast.operation, compiled.ast.operation === 'insert' ? compiled.ast.insertColumns : compiled.ast.assignments.map((item) => item.column), signal);
      writable();
      signal?.throwIfAborted();
      const execute = async () => {
        if (compiled.ast.operation !== 'insert') {
          const current = await transaction.query(compiled.lockSql, []);
          if (current.rows.length !== plan.matchedRows) throw new SqlMutationConflictError('WHERE 目标集合已变化；没有执行写入，请重新预览');
          const rows = mutationPreviewRows(current, fresh, compiled);
          const expected = new Map(plan.rows.map((row) => [rowKey(row.before!, plan), row]));
          for (const row of rows) {
            const original = expected.get(rowKey(row.before!, plan));
            if (!original || mutationRowSignature(row.before!, fresh.columns, provider) !== mutationRowSignature(original.before!, fresh.columns, provider) || !sameAfter(row.after, original.after, plan)) throw new SqlMutationConflictError('旧值或确定性新值已变化；没有执行写入，请重新预览');
          }
        }
        writable();
        signal?.throwIfAborted();
        const result = await transaction.query(compiled.writeSql, []);
        affectedRows = result.affectedRows;
        if (compiled.ast.operation !== 'update' && affectedRows !== plan.matchedRows || compiled.ast.operation === 'update' && (affectedRows < 0 || affectedRows > plan.matchedRows)) throw new SqlMutationConflictError('数据库影响行数与预览不符，事务已请求回滚');
        signal?.throwIfAborted();
        if (compiled.ast.operation === 'update') {
          for (const row of plan.rows) {
            const values: SqlParameter[] = [];
            const where = compiled.keyIndexes.map((index) => {
              values.push(keyParameter(row.before![index], plan, index));
              return `${driver.quoteIdentifier(fresh.columns[index].name)} = ${provider === 'postgres' ? `$${values.length}` : '?'}`;
            }).join(' AND ');
            const after = await transaction.query(`${compiled.afterSql} WHERE ${where} LIMIT 2`, values);
            if (after.rows.length !== 1 || !row.after!.every((cell, index) => cell.state === 'database' || mutationCellSignature(cell.value, fresh.columns[index], provider) === mutationCellSignature(after.rows[0][index], fresh.columns[index], provider))) throw new SqlMutationConflictError('数据库实际新值与审查不符，事务已请求回滚');
            signal?.throwIfAborted();
          }
        }
        writable();
        signal?.throwIfAborted();
        callbackComplete = true;
      };
      if (provider === 'mysql') await withMutationMysqlMode(transaction, execute);
      else await execute();
    });
    return { outcome: 'committed', affectedRows, matchedRows: plan.matchedRows, executionTimeMs: Math.round(performance.now() - started), error: null };
  } catch (reason) {
    const unknown = callbackComplete || transportFailure(reason);
    return {
      outcome: unknown ? 'unknown' : signal?.aborted ? 'cancelled' : reason instanceof SqlMutationConflictError || uniqueConflict(reason) ? 'conflict' : 'rolled-back',
      affectedRows: unknown ? null : 0,
      matchedRows: plan.matchedRows,
      executionTimeMs: Math.round(performance.now() - started),
      error: reason instanceof Error ? reason.message : String(reason),
    };
  }
}

function rowKey(row: DatabaseCell[], plan: SqlMutationPlan): string {
  return JSON.stringify(plan.compiled.keyIndexes.map((index) => mutationCellSignature(row[index], plan.structure.columns[index], plan.provider)));
}

function sameAfter(left: SqlMutationPlan['rows'][number]['after'], right: SqlMutationPlan['rows'][number]['after'], plan: SqlMutationPlan): boolean {
  if (!left || !right) return left === right;
  return left.every((cell, index) => cell.state === 'database' ? right[index]?.state === 'database' : right[index]?.state === 'value' && mutationCellSignature(cell.value, plan.structure.columns[index], plan.provider) === mutationCellSignature(right[index].value, plan.structure.columns[index], plan.provider));
}

function keyParameter(value: DatabaseCell, plan: SqlMutationPlan, index: number): SqlParameter {
  if (value === null) throw new SqlMutationConflictError('原生主键包含 NULL，无法准确定位行');
  if (value && typeof value === 'object') {
    if (!Array.isArray(value) && value.type === 'binary' && typeof value.base64 === 'string') return Buffer.from(value.base64, 'base64');
    throw new SqlMutationConflictError('主键类型没有准确的原生参数绑定');
  }
  if (plan.provider === 'sqlite' && /int/i.test(plan.structure.columns[index].dataType) && typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return value;
}

async function withMutationMysqlMode(transaction: RelationalTransaction, run: () => Promise<void>): Promise<void> {
  const result = await transaction.query('SELECT @@SESSION.sql_mode', []);
  const original = String(result.rows[0]?.[0] ?? '');
  if (!/^[A-Z0-9_,]*$/i.test(original)) throw new Error('无法可靠读取 MySQL SQL_MODE');
  const modes = original.split(',').filter((mode) => mode && !['ANSI_QUOTES', 'NO_BACKSLASH_ESCAPES'].includes(mode.toUpperCase()));
  if (!modes.includes('STRICT_ALL_TABLES')) modes.push('STRICT_ALL_TABLES');
  await transaction.query('SET SESSION sql_mode = ?', [modes.join(',')]);
  try { await run(); }
  finally { await transaction.query('SET SESSION sql_mode = ?', [original]); }
}

function transportFailure(reason: unknown): boolean {
  const code = reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : '';
  return /^(?:ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|57P01|57P02|57P03|08)/.test(code) || reason instanceof Error && /connection (?:closed|terminated|lost)|socket hang up/i.test(reason.message);
}

function uniqueConflict(reason: unknown): boolean {
  const code = reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : '';
  return code === '23505' || code === 'ER_DUP_ENTRY' || code === '1062' || reason instanceof Error && /UNIQUE constraint failed/i.test(reason.message);
}
