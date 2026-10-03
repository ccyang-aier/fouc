import { createHash } from 'node:crypto';
import type { DatabaseCell, DatabaseColumnInfo, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import { structureColumnFromMetadata, validateStructureExpression } from '@fouc/shared/relational-structure-edit';
import { tableTransferTypeFamily } from '@fouc/shared/table-transfer';
import type { SqlMutationOperation } from '@fouc/shared/sql-mutation';
import { canonicalCell } from './relational-values';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';

export async function readMutationStructure(driver: RelationalDriver, provider: RelationalProvider, schema: string, table: string): Promise<RelationalTableStructure> {
  const columns = await driver.columns(schema, table);
  return { ...await driver.structure(schema, table, columns), columns, provider, connectionId: '' };
}

export const mutationStructureSignature = (structure: RelationalTableStructure): string => createHash('sha256').update(JSON.stringify(structure)).digest('hex');

/** Only native tables with understood effects are admitted; no original DML runs during preflight. */
export async function assertMutationEffects(
  driver: RelationalDriver,
  structure: RelationalTableStructure,
  operation: SqlMutationOperation,
  supplied: string[],
  signal?: AbortSignal,
): Promise<void> {
  const { provider, schema, table } = structure;
  await driver.assertEditable(schema, table);
  if (structure.kind !== 'table' || /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(structure.definition.sql)) throw new DatabaseInputError('仅支持普通原生表，不执行视图或虚拟表写入');
  if (structure.triggers.length || structure.constraints.some((constraint) => ['check', 'exclusion'].includes(constraint.kind))) throw new DatabaseInputError('目标含触发器、CHECK 或排他约束，其额外执行逻辑尚未完整预览');
  for (const column of structure.columns) {
    if (/generated/i.test(column.extra ?? '')) {
      const parsed = structureColumnFromMetadata(structure, column);
      if (!parsed.generated || validateStructureExpression(parsed.generated.expression, provider, structure.columns.map((entry) => entry.name), 'generated')) throw new DatabaseInputError(`生成字段 ${column.name} 的表达式无法证明没有额外副作用`);
    }
    if (operation === 'insert' && !supplied.includes(column.name) && column.columnDefault !== null && !safeNativeDefault(column.columnDefault, provider)) throw new DatabaseInputError(`默认值 ${column.name} 不是可证明的原生常量或内置生成器，请显式提供该字段`);
    if (/on update/i.test(column.extra ?? '') && !/on update CURRENT_TIMESTAMP(?:\(\d+\))?$/i.test(column.extra ?? '')) throw new DatabaseInputError(`字段 ${column.name} 自动更新行为未受支持`);
  }
  signal?.throwIfAborted();
  if (provider === 'mysql') {
    const identity = await driver.read('SELECT CURRENT_USER()', schema, 1, [], signal);
    const user = String(identity.rows[0]?.[0] ?? ''), split = user.lastIndexOf('@');
    if (split < 1 || user.includes("'")) throw new DatabaseInputError('无法证明 MySQL 账号的元数据可见范围');
    const grantee = `'${user.slice(0, split)}'@'${user.slice(split + 1)}'`;
    const visibility = await driver.read(`SELECT
      EXISTS(SELECT 1 FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=? AND PRIVILEGE_TYPE='TRIGGER') OR
      EXISTS(SELECT 1 FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=? AND ? LIKE TABLE_SCHEMA AND PRIVILEGE_TYPE='TRIGGER') OR
      EXISTS(SELECT 1 FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=? AND TABLE_NAME=? AND PRIVILEGE_TYPE='TRIGGER'),
      EXISTS(SELECT 1 FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=? AND PRIVILEGE_TYPE='SELECT')`, schema, 1,
    [grantee, grantee, schema, grantee, schema, table, grantee], signal);
    if (!Number(visibility.rows[0]?.[0])) throw new DatabaseInputError('MySQL 账号不能证明完整触发器元数据可见，不能生成执行计划');
    if (operation !== 'insert' && !Number(visibility.rows[0]?.[1])) throw new DatabaseInputError('MySQL UPDATE / DELETE 当前要求全局 SELECT 元数据可见性，以证明没有隐藏的跨 Schema 引用影响');
    if (operation === 'update') {
      const references = await driver.read(`SELECT REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME=?`, schema, 2000, [schema, table], signal);
      if (references.hasMore || references.rows.some((row) => supplied.includes(String(row[0])))) throw new DatabaseInputError('UPDATE 修改了其他表引用的字段，其级联影响没有完整预览');
    }
  }
  if (provider === 'postgres') {
    const guard = await driver.read(`SELECT c.relkind, c.relrowsecurity, c.relispartition,
      EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite r WHERE r.ev_class=c.oid AND r.rulename <> '_RETURN'),
      EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhparent=c.oid OR i.inhrelid=c.oid)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=$2`, schema, 2, [schema, table], signal);
    const row = guard.rows[0];
    if (guard.rows.length !== 1 || row[0] !== 'r' || row.slice(1).some(Boolean)) throw new DatabaseInputError('PostgreSQL 规则、RLS、分区与继承表的影响范围尚未完整预览');
  }
  if (operation !== 'delete') return;
  const sql = provider === 'postgres'
    ? `SELECT COUNT(*) FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class t ON t.oid=k.confrelid
       JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
       WHERE k.contype='f' AND k.confdeltype IN ('c','n','d') AND n.nspname=$1 AND t.relname=$2`
    : provider === 'mysql'
      ? `SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
         WHERE UNIQUE_CONSTRAINT_SCHEMA=? AND REFERENCED_TABLE_NAME=? AND DELETE_RULE IN ('CASCADE','SET NULL','SET DEFAULT')`
      : `SELECT COUNT(*) FROM main.sqlite_schema m JOIN pragma_foreign_key_list(m.name) f
         WHERE m.type='table' AND f."table"=? AND upper(f.on_delete) IN ('CASCADE','SET NULL','SET DEFAULT')`;
  const count = await driver.read(sql, schema, 1, provider === 'sqlite' ? [table] : [schema, table], signal);
  if (Number(count.rows[0]?.[0] ?? -1) !== 0) throw new DatabaseInputError('DELETE 会级联修改其他表；此预览只审查单表，不能执行该语句');
}

function safeNativeDefault(value: string, provider: RelationalProvider): boolean {
  const normalized = value.trim().replace(/^\((.*)\)$/s, '$1').trim();
  if (/^(?:NULL|TRUE|FALSE|CURRENT_(?:TIMESTAMP|DATE|TIME)(?:\(\d+\))?|now\(\)|[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i.test(normalized)) return true;
  if (provider === 'mysql' && !normalized.includes('(')) return true; // Catalog text defaults are decoded values, not executable SQL.
  if (/^'(?:[^']|'')*'(?:\s*::\s*(?:text|character varying|varchar|bytea|date|timestamp(?: without time zone)?|boolean|integer|bigint|numeric))?$/i.test(normalized)) return true;
  return provider === 'postgres' && /^nextval\('(?:[^']|'')+'::regclass\)$/i.test(normalized);
}

export function validateMutationNewValue(raw: DatabaseCell, typed: DatabaseCell, column: DatabaseColumnInfo, provider: RelationalProvider): void {
  if (typeof raw === 'number' && (!Number.isFinite(raw) || Number.isInteger(raw) && !Number.isSafeInteger(raw))) throw new DatabaseInputError(`字段 ${column.name} 原始表达式已超出安全数字范围`);
  if (raw === null || typed === null) {
    if (raw !== typed || !column.isNullable && !/auto_increment/i.test(column.extra ?? '')) throw new DatabaseInputError(`字段 ${column.name} 新值不允许 NULL 或发生转换失败`);
    return;
  }
  const family = tableTransferTypeFamily(column.dataType, provider);
  if (family === 'integer' || family === 'boolean') {
    const value = typeof raw === 'boolean' ? Number(raw) : raw;
    if (!/^[+-]?\d+$/.test(String(value))) throw new DatabaseInputError(`字段 ${column.name} 新值需要舍入或隐式转换，无法准确预览`);
    const integer = BigInt(String(value)), unsigned = /\bunsigned\b/i.test(column.dataType);
    const bits = provider === 'sqlite' ? 64 : /tinyint/i.test(column.dataType) ? 8 : /smallint|int2/i.test(column.dataType) ? 16 : /mediumint/i.test(column.dataType) ? 24 : /bigint|int8/i.test(column.dataType) ? 64 : 32;
    const maximum = (1n << BigInt(unsigned ? bits : bits - 1)) - 1n, minimum = unsigned ? 0n : -(1n << BigInt(bits - 1));
    if (integer < minimum || integer > maximum || family === 'boolean' && integer !== 0n && integer !== 1n) throw new DatabaseInputError(`字段 ${column.name} 新值超出原生范围`);
  } else if (family === 'float') {
    if (typeof typed !== 'number' || !Number.isFinite(typed) || Number.isInteger(typed) && !Number.isSafeInteger(typed)) throw new DatabaseInputError(`字段 ${column.name} 浮点新值不能保证精度`);
  } else if (family === 'text') {
    if (typeof typed !== 'string' || typeof raw === 'object') throw new DatabaseInputError(`字段 ${column.name} 文本转换未受支持`);
    const length = column.characterMaximumLength;
    if (length !== null && [...String(raw)].length > length) throw new DatabaseInputError(`字段 ${column.name} 新值超过文本长度`);
  } else if (family === 'binary') {
    if (!typed || typeof typed !== 'object' || Array.isArray(typed) || typed.type !== 'binary') throw new DatabaseInputError(`字段 ${column.name} 二进制转换未受支持`);
    if (provider === 'sqlite' && (!raw || typeof raw !== 'object')) throw new DatabaseInputError(`SQLite BLOB 只预览真实二进制值`);
  }
  if (typeof typed === 'number' && (!Number.isFinite(typed) || Number.isInteger(typed) && !Number.isSafeInteger(typed))) throw new DatabaseInputError(`字段 ${column.name} 已超出 JavaScript 安全数字范围`);
}

export function mutationCellSignature(value: DatabaseCell, column: DatabaseColumnInfo, provider: RelationalProvider): string {
  const family = tableTransferTypeFamily(column.dataType, provider);
  if (value !== null && ['integer', 'decimal', 'boolean'].includes(family)) {
    if (typeof value === 'boolean') return value ? 'number:1' : 'number:0';
    const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value));
    if (match && (match[2] || match[3])) {
      let digits = (match[2] + (match[3] ?? '')).replace(/^0+/, '');
      if (!digits) return 'number:0';
      const trailing = /0*$/.exec(digits)![0].length;
      digits = digits.slice(0, digits.length - trailing);
      return `number:${match[1] === '-' ? '-' : ''}${digits}e${Number(match[4] ?? 0) - (match[3]?.length ?? 0) + trailing}`;
    }
  }
  return canonicalCell(value);
}

export function mutationRowSignature(row: DatabaseCell[], columns: DatabaseColumnInfo[], provider: RelationalProvider): string {
  return createHash('sha256').update(JSON.stringify(row.map((value, index) => mutationCellSignature(value, columns[index], provider)))).digest('hex');
}
