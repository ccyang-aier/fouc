import { SCHEMA_OBJECT_KINDS, schemaObjectKey, type RelationalProvider, type SchemaObject, type SchemaObjectKind, type SchemaObjectList } from '@fouc/shared';
import { schemaObjectLike, schemaObjectsListInput, quoteSchemaObject } from './schema-objects-input';
import type { NativeSchemaObjectAdapter } from './schema-objects-types';
export function catalogText(value: unknown): string | null { return value === null || value === undefined ? null : value instanceof Date ? value.toISOString() : String(value); }
export function schemaObjectRow(row: Record<string, unknown>, provider: RelationalProvider): SchemaObject {
  const kind = String(row.kind) as SchemaObjectKind, schema = String(row.schema), name = String(row.name), signature = catalogText(row.signature);
  const identity = { schema, name, kind, signature, catalogId: catalogText(row.catalog_id), parentSchema: catalogText(row.parent_schema), parentName: catalogText(row.parent_name) };
  if (!SCHEMA_OBJECT_KINDS[provider].includes(kind)) throw new Error('原生目录返回了无法识别的对象类型');
  return { ...identity, id: schemaObjectKey(identity), displayName: (kind === 'function' || kind === 'procedure') && signature !== null ? `${name}(${signature})` : name, comment: catalogText(row.comment), owner: catalogText(row.owner), createdAt: catalogText(row.created_at), updatedAt: catalogText(row.updated_at) };
}
const POSTGRES_LIST = `SELECT n.nspname AS schema,c.relname AS name,CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized-view' ELSE 'sequence' END AS kind,c.oid::text AS catalog_id,NULL::text AS signature,NULL::text AS parent_schema,NULL::text AS parent_name,pg_catalog.obj_description(c.oid,'pg_class') AS comment,pg_catalog.pg_get_userbyid(c.relowner) AS owner,NULL::text AS created_at,NULL::text AS updated_at FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('v','m','S')
UNION ALL SELECT n.nspname,p.proname,CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END,p.oid::text,pg_catalog.pg_get_function_identity_arguments(p.oid),NULL,NULL,pg_catalog.obj_description(p.oid,'pg_proc'),pg_catalog.pg_get_userbyid(p.proowner),NULL,NULL FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.prokind IN ('f','p')
UNION ALL SELECT n.nspname,t.tgname,'trigger',t.oid::text,NULL,n.nspname,c.relname,pg_catalog.obj_description(t.oid,'pg_trigger'),pg_catalog.pg_get_userbyid(c.relowner),NULL,NULL FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal`;
const MYSQL_LIST = `SELECT v.TABLE_SCHEMA AS 'schema',v.TABLE_NAME AS name,'view' AS kind,NULL AS catalog_id,NULL AS signature,NULL AS parent_schema,NULL AS parent_name,t.TABLE_COMMENT AS comment,v.DEFINER AS owner,NULL AS created_at,NULL AS updated_at FROM information_schema.VIEWS v LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=v.TABLE_SCHEMA AND t.TABLE_NAME=v.TABLE_NAME WHERE v.TABLE_SCHEMA=?
UNION ALL SELECT ROUTINE_SCHEMA,ROUTINE_NAME,LOWER(ROUTINE_TYPE),NULL,NULL,NULL,NULL,ROUTINE_COMMENT,DEFINER,CAST(CREATED AS CHAR),CAST(LAST_ALTERED AS CHAR) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE IN ('FUNCTION','PROCEDURE')
UNION ALL SELECT TRIGGER_SCHEMA,TRIGGER_NAME,'trigger',NULL,NULL,EVENT_OBJECT_SCHEMA,EVENT_OBJECT_TABLE,NULL,DEFINER,CAST(CREATED AS CHAR),NULL FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=?`;

export async function listSchemaObjects(adapter: NativeSchemaObjectAdapter, value: unknown, signal?: AbortSignal): Promise<SchemaObjectList> {
  const input = schemaObjectsListInput(adapter.provider, value), { schema, kinds, search, offset, limit } = input;
  signal?.throwIfAborted();
  if (!kinds.length) return { provider: adapter.provider, schema, objects: [], supportedKinds: [...SCHEMA_OBJECT_KINDS[adapter.provider]], offset, limit, hasMore: false, warnings: [] };
  const kindSql = kinds.map(kind => `'${kind}'`).join(','), parameters: Array<string | number | boolean | null> = [];
  let sql: string;
  if (adapter.provider === 'postgres') {
    parameters.push(schema, schemaObjectLike(search));
    sql = `SELECT * FROM (${POSTGRES_LIST}) objects WHERE kind IN (${kindSql}) AND (name ILIKE $2 ESCAPE '=' OR COALESCE(comment,'') ILIKE $2 ESCAPE '=' OR COALESCE(signature,'') ILIKE $2 ESCAPE '=') ORDER BY kind,name,signature,parent_name,catalog_id LIMIT ${limit + 1} OFFSET ${offset}`;
  } else if (adapter.provider === 'mysql') {
    parameters.push(schema, schema, schema, schemaObjectLike(search), schemaObjectLike(search));
    sql = `SELECT * FROM (${MYSQL_LIST}) objects WHERE kind IN (${kindSql}) AND (name LIKE ? ESCAPE '=' OR COALESCE(comment,'') LIKE ? ESCAPE '=') ORDER BY kind,name,parent_name LIMIT ${limit + 1} OFFSET ${offset}`;
  } else {
    parameters.push(schema, schema, schemaObjectLike(search));
    sql = `SELECT ? AS schema,name,type AS kind,NULL AS catalog_id,NULL AS signature,CASE WHEN type='trigger' THEN ? ELSE NULL END AS parent_schema,CASE WHEN type='trigger' THEN tbl_name ELSE NULL END AS parent_name,NULL AS comment,NULL AS owner,NULL AS created_at,NULL AS updated_at FROM ${quoteSchemaObject('sqlite', schema)}.sqlite_schema WHERE type IN (${kindSql}) AND name NOT LIKE 'sqlite_%' AND name LIKE ? ESCAPE '=' ORDER BY type,name LIMIT ${limit + 1} OFFSET ${offset}`;
  }
  const rows = await adapter.query(sql, parameters, signal); signal?.throwIfAborted();
  return { provider: adapter.provider, schema, objects: rows.slice(0, limit).map(row => schemaObjectRow(row, adapter.provider)), supportedKinds: [...SCHEMA_OBJECT_KINDS[adapter.provider]], offset, limit, hasMore: rows.length > limit, warnings: [] };
}
