import type { RelationalProvider } from '@fouc/shared';
import type { SchemaCreateOptions } from '@fouc/shared/schema-create';
import type { DriverResult, RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';

function records(result: DriverResult): Record<string, unknown>[] {
  if (result.hasMore) throw new DatabaseInputError('创建所需原生目录超过读取上限，无法安全准备。');
  return result.rows.map(row => Object.fromEntries(result.columns.map((key, index) => [key.toLowerCase(), row[index]])));
}
function text(value: unknown): string | null { return typeof value === 'string' && value ? value : null; }

/** DBX charset/default ordering, sourced exclusively from this server, without a fallback catalog. */
export async function schemaCreateOptions(driver: RelationalDriver, provider: RelationalProvider, database: string, check: () => void, signal?: AbortSignal): Promise<SchemaCreateOptions> {
  const read = async (sql: string, limit: number) => {
    check(); signal?.throwIfAborted();
    const result = await driver.read(sql, null, limit, undefined, signal);
    check(); signal?.throwIfAborted();
    return records(result);
  };
  if (provider === 'sqlite') return { provider, database, supported: false, target: null, permission: 'denied', charsets: [], warnings: ['SQLite 当前文件没有可创建的数据库或 Schema 命名空间。'] };
  if (provider === 'postgres') {
    const rows = await read("SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS can_create", 1);
    const allowed = rows[0]?.can_create;
    return { provider, database, supported: true, target: 'schema', permission: allowed === true ? 'allowed' : allowed === false ? 'denied' : 'unknown', charsets: [], warnings: ['仅在当前已连接数据库中创建 Schema；所有者为当前数据库角色，不创建新数据库。'] };
  }
  const charsetRows = await read('SHOW CHARACTER SET', 1000);
  const collationRows = await read('SHOW COLLATION', 2000);
  const charsets = charsetRows.flatMap(row => {
    const name = text(row.charset);
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) return [];
    const defaultCollation = text(row['default collation']);
    const collations = [...new Set(collationRows.filter(item => item.charset === name).map(item => text(item.collation)).filter((item): item is string => Boolean(item && /^[a-zA-Z0-9_]+$/.test(item))))];
    collations.sort((a, b) => a === defaultCollation ? -1 : b === defaultCollation ? 1 : a.localeCompare(b));
    return [{ name, description: text(row.description), defaultCollation, collations }];
  });
  return { provider, database, supported: true, target: 'database', permission: 'unknown', charsets, warnings: ['MySQL CREATE 权限由服务器在执行时验证；数据库列表可能只显示当前角色可见的资源。', 'CREATE DATABASE 隐式提交，不能依靠事务撤销；连接中断时需刷新目录核对结果。', '未选择字符集时继承服务器默认值。不切换当前连接的默认数据库，也不授予额外权限。'] };
}

export async function schemaCreateExists(driver: RelationalDriver, provider: 'mysql' | 'postgres', name: string, signal?: AbortSignal): Promise<boolean> {
  const sql = provider === 'mysql'
    ? 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?'
    : 'SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname = $1';
  const result = await driver.read(sql, null, 1, [name], signal);
  return result.rows.length > 0;
}
