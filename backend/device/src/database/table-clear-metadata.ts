import { createHash } from 'node:crypto';
import type { RelationalProvider } from '@fouc/shared';
import { TABLE_CLEAR_LIMITS, type TableClearInput, type TableClearReference, type TableClearReview } from '@fouc/shared/table-clear';
import type { DriverResult, RelationalDriver, RelationalTransaction, SqlParameter } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';

function records(result: DriverResult): Record<string, unknown>[] {
  if (result.hasMore) throw new DatabaseInputError('引用目录超过 1000 个字段上限，无法完整审查清空影响。');
  return result.rows.map(row => Object.fromEntries(result.columns.map((name, index) => [name.toLowerCase(), row[index]])));
}
function countValue(result: DriverResult): string {
  const value = result.rows[0]?.[0];
  if (!/^(?:0|[1-9][0-9]*)$/.test(String(value)) || typeof value === 'number' && !Number.isSafeInteger(value)) throw new DatabaseInputError('原生行数没有返回可保真的非负整数。');
  return String(value);
}
function references(rows: Record<string, unknown>[]): TableClearReference[] {
  const groups = new Map<string, TableClearReference>();
  for (const row of rows) {
    const key = JSON.stringify([row.owner_schema, row.owner_table, row.constraint_name]);
    let entry = groups.get(key);
    if (!entry) {
      entry = { schema: String(row.owner_schema), table: String(row.owner_table), constraint: String(row.constraint_name), columns: [], referencedColumns: [], onDelete: String(row.delete_rule) };
      groups.set(key, entry);
    }
    entry.columns.push(String(row.owner_column)); entry.referencedColumns.push(String(row.target_column));
  }
  return [...groups.values()];
}

/** Fixed native probes only; clients never supply SQL, a WHERE clause or a CASCADE option. */
export async function tableClearReview(driver: RelationalDriver, provider: RelationalProvider, input: TableClearInput, check: () => void, signal?: AbortSignal, transaction?: RelationalTransaction): Promise<TableClearReview> {
  const { schema, table } = input;
  const guard = () => { check(); signal?.throwIfAborted(); };
  const read = async (sql: string, values: SqlParameter[] = [], limit: number = TABLE_CLEAR_LIMITS.references) => {
    guard();
    const bounded = `${sql} LIMIT ${limit + 1}`;
    const result = transaction ? await transaction.query(bounded, values) : await driver.read(bounded, schema, limit, values, signal);
    if (result.rows.length > limit) throw new DatabaseInputError('原生审查目录超过当前读取上限，不能完整审查。');
    guard(); return result;
  };
  guard();
  const columns = await driver.columns(schema, table); guard();
  const native = await driver.structure(schema, table, columns); guard();
  if (native.kind !== 'table' || /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(native.definition.sql)) throw new DatabaseInputError('清空维护仅支持普通原生数据表，不支持视图、虚拟表或外部表。');
  const structure = { ...native, columns, provider, connectionId: '' };
  const qualified = driver.quoteIdentifier(schema) + '.' + driver.quoteIdentifier(table);
  const blockedReasons: string[] = [], warnings: string[] = [
    '这会清空整张表，与当前筛选、分页和已加载行无关；表结构保留。',
    '审查行数是当时当前角色可见的 COUNT，不是一致性快照；外部写入可能改变最终被清空的行数。',
    '不禁用外键，不生成 CASCADE，不清空引用表；原生服务器仍会检查执行时的约束和权限。',
  ];
  let permission: TableClearReview['permission'] = 'unknown';
  let permissionDetail = '文件系统与 SQLite 写事务权限由提交时的原生服务器检查。';
  let incoming: TableClearReference[] = [];
  let referenceCoverage = 'SQLite main 普通表的原生 FK 目录，最多 1000 张表。';
  if (provider === 'postgres') {
    const target = await read(`SELECT c.relkind, c.relrowsecurity, c.relispartition,
      pg_catalog.has_table_privilege(c.oid,'SELECT') AS can_select,
      pg_catalog.has_table_privilege(c.oid,'TRUNCATE') AS can_clear,
      EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhparent=c.oid OR i.inhrelid=c.oid) AS inherited
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=$2`, [schema, table], 1);
    const row = records(target)[0];
    if (!row || row.relkind !== 'r' || row.relispartition || row.inherited) blockedReasons.push('当前仅清空独立普通表；分区、继承或外部表需要另行审查。');
    permission = row?.can_clear === true && row.can_select === true ? 'allowed' : 'denied';
    permissionDetail = '原生 has_table_privilege 同时检查当前角色 SELECT 与 TRUNCATE。';
    if (row?.relrowsecurity) warnings.push('目标启用 RLS：COUNT 只显示当前角色可见行，TRUNCATE 会清空整表并绕过行级策略。');
    incoming = references(records(await read(`SELECT ns.nspname AS owner_schema, owner.relname AS owner_table,
      c.conname AS constraint_name, a.attname AS owner_column, b.attname AS target_column,
      CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END AS delete_rule
      FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class target ON target.oid=c.confrelid
      JOIN pg_catalog.pg_namespace nt ON nt.oid=target.relnamespace
      JOIN pg_catalog.pg_class owner ON owner.oid=c.conrelid JOIN pg_catalog.pg_namespace ns ON ns.oid=owner.relnamespace
      JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY AS k(owner_key,target_key,position) ON true
      JOIN pg_catalog.pg_attribute a ON a.attrelid=owner.oid AND a.attnum=k.owner_key
      JOIN pg_catalog.pg_attribute b ON b.attrelid=target.oid AND b.attnum=k.target_key
      WHERE c.contype='f' AND nt.nspname=$1 AND target.relname=$2
      ORDER BY ns.nspname,owner.relname,c.conname,k.position`, [schema, table])));
    referenceCoverage = '当前数据库 pg_constraint 的目标表引用，最多 1000 个 FK 字段；跨 Schema 引用包含在内。';
    warnings.push('PostgreSQL 使用事务 TRUNCATE ONLY … CONTINUE IDENTITY RESTRICT，不重置 identity；TRUNCATE 触发器可能执行额外逻辑。');
  } else if (provider === 'mysql') {
    const identity = await read('SELECT CURRENT_USER()', [], 1);
    const account = String(identity.rows[0]?.[0] ?? ''), split = account.lastIndexOf('@');
    if (split <= 0) throw new DatabaseInputError('无法读取当前 MySQL 原生账号。');
    const grantee = `'${account.slice(0, split).replaceAll("'", "''")}'@'${account.slice(split + 1).replaceAll("'", "''")}'`;
    const grants = records(await read(`SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=?
      UNION SELECT PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=? AND ? LIKE TABLE_SCHEMA
      UNION SELECT PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=? AND TABLE_SCHEMA=? AND TABLE_NAME=?`, [grantee, grantee, schema, grantee, schema, table], 100));
    const names = new Set(grants.map(row => String(row.privilege_type)));
    permission = names.has('DROP') && names.has('SELECT') ? 'allowed' : 'unknown';
    permissionDetail = permission === 'allowed' ? '原生当前账号可见授权包含 DROP 与 SELECT。' : '当前账号可见授权未直接证明 DROP 与 SELECT；角色授权及最终权限由服务器验证。';
    incoming = references(records(await read(`SELECT k.TABLE_SCHEMA AS owner_schema,k.TABLE_NAME AS owner_table,
      k.CONSTRAINT_NAME AS constraint_name,k.COLUMN_NAME AS owner_column,k.REFERENCED_COLUMN_NAME AS target_column,r.DELETE_RULE AS delete_rule
      FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME
      WHERE k.REFERENCED_TABLE_SCHEMA=? AND k.REFERENCED_TABLE_NAME=?
      ORDER BY k.TABLE_SCHEMA,k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION`, [schema, table])));
    referenceCoverage = '当前 MySQL 账号可见的 information_schema 引用；隐藏引用仍由原生 TRUNCATE 检查并拒绝，不宣称目录完整。';
    warnings.push('MySQL TRUNCATE 隐式提交，不能事务回滚；不触发 DELETE 触发器。取消只能阻止尚未提交的语句，提交后需等待服务器结果。');
  } else {
    if (schema !== 'main') throw new DatabaseInputError('SQLite 清空仅支持当前文件 main。');
    const tables = countValue(await read("SELECT COUNT(*) FROM main.sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], 1));
    if (BigInt(tables) > BigInt(TABLE_CLEAR_LIMITS.references)) throw new DatabaseInputError('SQLite 表目录超过 1000 张表，不能完整审查引用；请使用专门的数据库维护流程。');
    incoming = references(records(await read(`SELECT 'main' AS owner_schema,m.name AS owner_table,
      'fk_' || f.id AS constraint_name,f."from" AS owner_column,
      COALESCE(f."to",(SELECT p.name FROM pragma_table_xinfo(?) p WHERE p.pk=f.seq+1),'(未解析主键)') AS target_column,f.on_delete AS delete_rule
      FROM main.sqlite_schema m JOIN pragma_foreign_key_list(m.name) f
      WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' AND f."table"=? COLLATE NOCASE
      ORDER BY m.name,f.id,f.seq`, [table, table])));
    warnings.push('SQLite 使用原生 DELETE 事务，保留 sqlite_sequence；DELETE 触发器会逐行执行，可能修改其他表，必须明确审查。');
  }
  if (permission === 'denied') blockedReasons.push('当前角色没有该表清空所需的 SELECT / TRUNCATE 权限。');
  if (incoming.length) blockedReasons.push('目标被原生外键引用。本能力不禁用约束或级联清空；请先审查并处理引用表。');
  const triggers = structure.triggers.filter(trigger => provider === 'sqlite' && trigger.events.includes('DELETE') || provider === 'postgres' && trigger.events.includes('TRUNCATE') && trigger.enabled !== 'D');
  if (triggers.length && !input.acknowledgeTriggers) blockedReasons.push('目标清空会触发原生触发器；需明确确认其额外影响后重新审查。');
  const reset = provider === 'mysql' && columns.some(column => /auto_increment/i.test(column.extra ?? ''));
  if (reset && !input.acknowledgeIdentityReset) blockedReasons.push('MySQL TRUNCATE 必然重置 AUTO_INCREMENT；默认保留策略阻止执行，需明确接受重置后重新审查。');
  if (reset) warnings.push('当前 MySQL 表含 AUTO_INCREMENT，TRUNCATE 会重置其计数器；无法在同一个 TRUNCATE 中保留。');
  const visibleRowCount = countValue(await read(`SELECT COUNT(*) FROM ${qualified}`, [], 1));
  return { provider, schema, table, confirmationName: `${schema}.${table}`, structure, incomingReferences: incoming, triggers,
    permission, permissionDetail, referenceCoverage, blockedReasons, warnings, visibleRowCount, countedAt: Date.now(),
    sql: provider === 'sqlite' ? `DELETE FROM ${qualified};` : provider === 'postgres' ? `TRUNCATE TABLE ONLY ${qualified} CONTINUE IDENTITY RESTRICT;` : `TRUNCATE TABLE ${qualified};`,
    operation: provider === 'sqlite' ? 'delete' : 'truncate', transaction: provider === 'mysql' ? 'implicit-commit' : 'atomic',
    identity: reset ? 'reset' : provider === 'mysql' ? 'not-applicable' : 'preserved' };
}

export function tableClearSignature(review: TableClearReview): string {
  return createHash('sha256').update(JSON.stringify({ structure: review.structure, incoming: review.incomingReferences, permission: review.permission, triggers: review.triggers, sql: review.sql })).digest('hex');
}
