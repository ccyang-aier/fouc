import { createHash } from 'node:crypto';
import type { RelationalProvider } from '@fouc/shared';
import { parseIndexEditInput, type IndexEditOptions, type IndexEditInput } from '@fouc/shared/index-edit';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';

function versionAtLeast(version: string, major: number, minor = 0, patch = 0): boolean {
  const matched = version.match(/(?:PostgreSQL\s+)?(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!matched) return false;
  const values = matched.slice(1).map(value => Number(value ?? 0));
  return values[0] > major || values[0] === major && (values[1] > minor || values[1] === minor && values[2] >= patch);
}

export async function indexEditOptions(driver: RelationalDriver, provider: RelationalProvider, schema: string, table: string, readable: () => void, signal?: AbortSignal): Promise<IndexEditOptions> {
  try { parseIndexEditInput(provider, { operation: 'drop', schema, table, name: '__fouc_validation' }); }
  catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
  const check = () => { readable(); signal?.throwIfAborted(); };
  check();
  const columns = await driver.columns(schema, table);
  check();
  const native = await driver.structure(schema, table, columns);
  check();
  if (native.kind !== 'table') throw new DatabaseInputError('独立索引管理仅支持当前原生数据表。');
  const version = driver.info.productVersion ?? '';
  const mysqlInnoDB = provider === 'mysql' && native.properties.engine?.toLowerCase() === 'innodb' && !/mariadb/i.test(version);
  const capabilities = {
    descending: provider === 'postgres' || provider === 'sqlite' && versionAtLeast(version, 3, 3) || mysqlInnoDB && versionAtLeast(version, 8),
    prefix: provider === 'mysql' && ['innodb', 'myisam'].includes(native.properties.engine?.toLowerCase() ?? ''),
    include: provider === 'postgres' && versionAtLeast(version, 11),
    nullsNotDistinct: provider === 'postgres' && versionAtLeast(version, 15),
  };
  let permission: IndexEditOptions['permission'] = 'unknown';
  if (provider === 'postgres') {
    const result = await driver.read(`SELECT (pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE')
      OR (SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname=current_user))
      AND pg_catalog.has_schema_privilege(current_user, n.oid, 'CREATE') AS allowed
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=$2 AND c.relkind IN ('r','p')`, null, 1, [schema, table], signal);
    check();
    permission = result.rows[0]?.[0] === true ? 'allowed' : 'denied';
  }
  return {
    provider, structure: { ...native, provider, connectionId: '', columns }, capabilities, permission,
    warnings: [
      '仅管理独立普通索引；不提供表达式、过滤条件、专用访问方法或并发建索引。',
      '构建索引会读取既有数据并可能等待锁；不会修改表中数据，唯一索引会约束后续写入。',
      ...(permission === 'unknown' ? ['当前角色的索引管理权限由原生服务器在执行时验证。'] : permission === 'denied' ? ['当前角色没有此表所有权或目标 Schema 的 CREATE 权限。'] : []),
      ...(provider === 'mysql' ? ['MySQL 索引 DDL 隐式提交；前缀文本按字符、二进制按字节，最终键长度由原生引擎检查。'] : []),
    ],
  };
}

export function indexEditSignature(options: IndexEditOptions): string {
  // Catalog arrays are returned in native deterministic order; volatile UI/session identifiers are omitted.
  return createHash('sha256').update(JSON.stringify({
    schema: options.structure.schema, table: options.structure.table, kind: options.structure.kind,
    columns: options.structure.columns, indexes: options.structure.indexes,
    foreignKeys: options.structure.foreignKeys, constraints: options.structure.constraints,
    properties: options.structure.properties, capabilities: options.capabilities,
  })).digest('hex');
}

export async function assertIndexEditNameAvailable(driver: RelationalDriver, provider: RelationalProvider, input: IndexEditInput, readable: () => void, signal?: AbortSignal): Promise<void> {
  if (input.operation !== 'create' || provider === 'mysql') return;
  readable(); signal?.throwIfAborted();
  const sql = provider === 'postgres'
    ? 'SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2'
    : "SELECT name FROM main.sqlite_schema WHERE type IN ('table','view','index') AND name=? COLLATE NOCASE";
  const rows = await driver.read(sql, null, 1, provider === 'sqlite' ? [input.name] : [input.schema, input.name], signal);
  readable(); signal?.throwIfAborted();
  if (rows.rows.length) throw new DatabaseInputError('目标目录中已有同名原生对象，请使用不同的索引名称。');
}
