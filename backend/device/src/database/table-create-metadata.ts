import type { RelationalProvider } from '@fouc/shared';
import { tableCreateIdentifierError, tableCreateTypes, type TableCreateOptions } from '@fouc/shared/table-create';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';

export async function tableCreateOptions(driver: RelationalDriver, provider: RelationalProvider, database: string, readable: () => void, signal?: AbortSignal): Promise<TableCreateOptions> {
  readable(); signal?.throwIfAborted();
  const schemas = (await driver.schemas()).filter(schema => !tableCreateIdentifierError(provider, schema, 'schema'));
  readable(); signal?.throwIfAborted();
  return { provider, database, schemas, types: tableCreateTypes[provider], warnings: [provider === 'mysql' ? '目标数据库列表受当前角色可见范围限制；CREATE 权限由原生服务器验证。' : provider === 'postgres' ? '只在当前连接的数据库内创建表；目标 Schema 须已存在且当前角色具有 CREATE 权限。' : '只在当前 SQLite 文件的 main 中创建表，不创建或附加其他文件。'] };
}

export async function assertTableCreateTarget(driver: RelationalDriver, provider: RelationalProvider, schema: string, table: string, readable: () => void, signal?: AbortSignal): Promise<void> {
  readable(); signal?.throwIfAborted();
  const schemas = await driver.schemas();
  readable(); signal?.throwIfAborted();
  if (!schemas.includes(schema)) throw new DatabaseInputError('目标目录不存在或当前角色不可见，请刷新目录后重新审查。');
  if (provider === 'postgres') {
    const permission = await driver.read("SELECT has_schema_privilege(current_user, $1, 'CREATE') AS allowed", null, 1, [schema], signal);
    readable(); signal?.throwIfAborted();
    if (permission.rows[0]?.[0] !== true) throw new DatabaseInputError('当前角色没有目标 Schema 的 CREATE 权限。');
  }
  const sql = provider === 'mysql'
    ? 'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?'
    : provider === 'postgres'
      ? 'SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2 UNION ALL SELECT t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typname=$2'
      : "SELECT name FROM main.sqlite_schema WHERE type IN ('table','view','index') AND name=? COLLATE NOCASE";
  const values = provider === 'sqlite' ? [table] : [schema, table];
  const exists = await driver.read(sql, null, 1, values, signal);
  readable(); signal?.throwIfAborted();
  if (exists.rows.length) throw new DatabaseInputError('目标目录中已有同名对象，未执行建表。');
}
