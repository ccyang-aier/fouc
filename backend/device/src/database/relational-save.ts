import { createHash } from 'node:crypto';
import type {
  DatabaseCell,
  DatabaseColumnInfo,
  RelationalProvider,
  RelationalSaveInput,
  RelationalSavePreview,
} from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import type { RelationalDriver, RelationalTransaction, SqlParameter } from './drivers/relational-driver';

type Statement = {
  sql: string;
  parameters: SqlParameter[];
  lock?: { sql: string; parameters: SqlParameter[]; original: DatabaseCell[] };
};
export type SavePlan = { preview: RelationalSavePreview; statements: Statement[]; columnSignature: string };
export const columnSignature = (columns: DatabaseColumnInfo[]) =>
  createHash('sha256').update(JSON.stringify(columns)).digest('hex');

// DBX data_grid_sql.rs: generated columns, key predicates, exact parameter
// values, required-field checks and single-row guards. Fouc executes bindings
// rather than interpolating SQL literals; keyless tables remain a later step.
export function canonicalCell(value: DatabaseCell): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalCell).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonicalCell(value[key]!))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
function validateCell(value: unknown): asserts value is DatabaseCell {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
  )
    return;
  if (Array.isArray(value)) {
    value.forEach(validateCell);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(validateCell);
    return;
  }
  throw new DatabaseInputError('字段值无效；大整数须使用十进制字符串');
}
function parameter(
  value: DatabaseCell,
  column: DatabaseColumnInfo,
  provider: RelationalProvider,
): SqlParameter {
  if (value === null) return null;
  const json = /\bjsonb?\b/i.test(column.dataType);
  if (json) return JSON.stringify(value);
  if (value && typeof value === 'object') {
    if (
      !Array.isArray(value) &&
      value.type === 'binary' &&
      typeof value.base64 === 'string' &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)
    )
      return Buffer.from(value.base64, 'base64');
    throw new DatabaseInputError(`${column.name} 仅接受标量或二进制值，复杂类型请使用相应编辑器`);
  }
  if (
    provider === 'sqlite' &&
    /INT/i.test(column.dataType) &&
    typeof value === 'string' &&
    /^-?\d+$/.test(value)
  )
    return BigInt(value);
  return value;
}
function validateInput(value: unknown): RelationalSaveInput {
  if (!value || typeof value !== 'object') throw new DatabaseInputError('变更参数无效');
  const input = value as RelationalSaveInput;
  if (
    typeof input.schema !== 'string' ||
    typeof input.table !== 'string' ||
    !Array.isArray(input.changes) ||
    !input.changes.length ||
    input.changes.length > 100 ||
    JSON.stringify(value).length > 1_000_000
  )
    throw new DatabaseInputError('每批须包含 1–100 项变更，且请求不能超过 1 MB');
  return input;
}
export function saveInput(value: unknown): RelationalSaveInput {
  return validateInput(value);
}

export function prepareSave(
  input: RelationalSaveInput,
  columns: DatabaseColumnInfo[],
  provider: RelationalProvider,
  quote: RelationalDriver['quoteIdentifier'],
  now = Date.now(),
): SavePlan {
  const target = `${quote(input.schema)}.${quote(input.table)}`;
  const statements: Statement[] = [];
  const previews: RelationalSavePreview['statements'] = [];
  const keys = columns.flatMap((column, index) => (column.isPrimaryKey ? [index] : []));
  const changedKeys = new Set<string>();
  for (const change of input.changes) {
    if (!change || !['insert', 'update', 'delete'].includes(change.kind))
      throw new DatabaseInputError('变更类型无效');
    const bindings: SqlParameter[] = [];
    const display: DatabaseCell[] = [];
    const bind = (value: DatabaseCell, column: DatabaseColumnInfo) => {
      validateCell(value);
      bindings.push(parameter(value, column, provider));
      display.push(value);
      return provider === 'postgres' ? `$${bindings.length}` : '?';
    };
    let lock: Statement['lock'];
    let identifiers: number[] = [];
    if (change.kind !== 'insert') {
      if (!Array.isArray(change.original) || change.original.length !== columns.length)
        throw new DatabaseInputError('原始行与字段结构不匹配，请刷新数据');
      change.original.forEach(validateCell);
      identifiers = keys.length
        ? keys
        : columns
            .flatMap((column, index) => (column.isUnique && change.original[index] !== null ? [index] : []))
            .slice(0, 1);
      if (!identifiers.length) throw new DatabaseInputError('修改和删除需要主键或非空单列唯一键');
      const rowKey = canonicalCell(identifiers.map((index) => change.original[index]!));
      if (changedKeys.has(rowKey)) throw new DatabaseInputError('同一行不能在一批中重复修改或删除');
      changedKeys.add(rowKey);
      const lockParams: SqlParameter[] = [];
      const where = identifiers
        .map((index) => {
          const column = columns[index]!;
          const cell = change.original[index]!;
          if (cell === null) return `${quote(column.name)} IS NULL`;
          lockParams.push(parameter(cell, column, provider));
          return `${quote(column.name)} = ${provider === 'postgres' ? `$${lockParams.length}` : '?'}`;
        })
        .join(' AND ');
      lock = {
        sql: `SELECT * FROM ${target} WHERE ${where} LIMIT 2${provider === 'sqlite' ? '' : ' FOR UPDATE'}`,
        parameters: lockParams,
        original: change.original,
      };
    }
    let sql: string;
    if (change.kind === 'delete') {
      const where = identifiers
        .map((index) => {
          const column = columns[index]!;
          const value = change.original[index]!;
          return value === null
            ? `${quote(column.name)} IS NULL`
            : `${quote(column.name)} = ${bind(value, column)}`;
        })
        .join(' AND ');
      sql = `DELETE FROM ${target} WHERE ${where}`;
    } else {
      if (!change.values || typeof change.values !== 'object' || Array.isArray(change.values))
        throw new DatabaseInputError('字段赋值无效');
      const fields = Object.entries(change.values).map(([name, value]) => {
        const column = columns.find((item) => item.name === name);
        if (!column) throw new DatabaseInputError(`字段 ${name} 不存在`);
        if (/generated|identity/i.test(column.extra ?? ''))
          throw new DatabaseInputError(`字段 ${name} 由数据库生成，不能直接赋值`);
        if (value === null && !column.isNullable) throw new DatabaseInputError(`字段 ${name} 不允许 NULL`);
        return { column, binding: bind(value, column) };
      });
      if (change.kind === 'insert') {
        sql = fields.length
          ? `INSERT INTO ${target} (${fields.map((field) => quote(field.column.name)).join(', ')}) VALUES (${fields.map((field) => field.binding).join(', ')})`
          : provider === 'mysql'
            ? `INSERT INTO ${target} () VALUES ()`
            : `INSERT INTO ${target} DEFAULT VALUES`;
      } else {
        if (!fields.length) throw new DatabaseInputError('没有待修改的字段');
        const where = identifiers
          .map((index) => {
            const column = columns[index]!;
            const cell = change.original[index]!;
            return cell === null
              ? `${quote(column.name)} IS NULL`
              : `${quote(column.name)} = ${bind(cell, column)}`;
          })
          .join(' AND ');
        sql = `UPDATE ${target} SET ${fields.map((field) => `${quote(field.column.name)} = ${field.binding}`).join(', ')} WHERE ${where}`;
      }
    }
    statements.push({ sql, parameters: bindings, lock });
    previews.push({ kind: change.kind, sql, parameters: display });
  }
  return {
    preview: {
      id: crypto.randomUUID(),
      schema: input.schema,
      table: input.table,
      expiresAt: now + 5 * 60_000,
      statements: previews,
    },
    statements,
    columnSignature: columnSignature(columns),
  };
}

export async function executeSave(plan: SavePlan, transaction: RelationalTransaction): Promise<number> {
  let affectedRows = 0;
  for (const statement of plan.statements) {
    if (statement.lock) {
      const current = await transaction.query(statement.lock.sql, statement.lock.parameters);
      if (
        current.rows.length !== 1 ||
        canonicalCell(current.rows[0]!) !== canonicalCell(statement.lock.original)
      )
        throw new DatabaseInputError('数据已被其他操作修改或删除，本批变更已回滚；请刷新后重新编辑');
    }
    const result = await transaction.query(statement.sql, statement.parameters);
    if (result.affectedRows !== 1) throw new DatabaseInputError('变更未命中唯一目标行，本批变更已回滚');
    affectedRows += result.affectedRows;
  }
  return affectedRows;
}
