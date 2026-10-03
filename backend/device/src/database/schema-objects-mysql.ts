import type { SchemaObjectDetails, SchemaObjectIdentity } from '@fouc/shared';
import { quoteSchemaObject } from './schema-objects-input';
import { catalogDefinition, catalogProperties, catalogReferences, objectDetails, objectMissing, routineParameter } from './schema-objects-common';
import { catalogText } from './schema-objects-list';
import type { NativeSchemaObjectAdapter } from './schema-objects-types';

function mysqlSourceColumn(row: Record<string, unknown>, kind: SchemaObjectIdentity['kind']): string | null {
  const expected = kind === 'trigger' ? 'sql original statement' : `create ${kind}`;
  const key = Object.keys(row).find(key => key.toLowerCase() === expected);
  return key === undefined ? null : catalogDefinition(row[key]);
}
export async function mysqlSchemaObject(adapter: NativeSchemaObjectAdapter, input: SchemaObjectIdentity, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  let sql: string;
  const values: Array<string | number | boolean | null> = [input.schema, input.name];
  if (input.kind === 'view') sql = `SELECT v.TABLE_SCHEMA AS 'schema',v.TABLE_NAME AS name,'view' AS kind,NULL AS catalog_id,NULL AS signature,NULL AS parent_schema,NULL AS parent_name,t.TABLE_COMMENT AS comment,v.DEFINER AS owner,NULL AS created_at,NULL AS updated_at,v.VIEW_DEFINITION AS body,v.CHECK_OPTION AS check_option,v.IS_UPDATABLE AS is_updatable,v.SECURITY_TYPE AS security_type,v.CHARACTER_SET_CLIENT AS character_set_client,v.COLLATION_CONNECTION AS collation_connection FROM information_schema.VIEWS v LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=v.TABLE_SCHEMA AND t.TABLE_NAME=v.TABLE_NAME WHERE v.TABLE_SCHEMA=? AND v.TABLE_NAME=? LIMIT 1`;
  else if (input.kind === 'trigger') sql = `SELECT TRIGGER_SCHEMA AS 'schema',TRIGGER_NAME AS name,'trigger' AS kind,NULL AS catalog_id,NULL AS signature,EVENT_OBJECT_SCHEMA AS parent_schema,EVENT_OBJECT_TABLE AS parent_name,NULL AS comment,DEFINER AS owner,CAST(CREATED AS CHAR) AS created_at,NULL AS updated_at,ACTION_STATEMENT AS body,EVENT_MANIPULATION AS event,ACTION_TIMING AS timing,ACTION_ORIENTATION AS orientation,ACTION_CONDITION AS 'condition',CAST(ACTION_ORDER AS CHAR) AS action_order,SQL_MODE AS sql_mode,CHARACTER_SET_CLIENT AS character_set_client,COLLATION_CONNECTION AS collation_connection,DATABASE_COLLATION AS database_collation FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? AND TRIGGER_NAME=? LIMIT 1`;
  else { values.push(input.kind.toUpperCase()); sql = `SELECT ROUTINE_SCHEMA AS 'schema',ROUTINE_NAME AS name,LOWER(ROUTINE_TYPE) AS kind,NULL AS catalog_id,NULL AS signature,NULL AS parent_schema,NULL AS parent_name,ROUTINE_COMMENT AS comment,DEFINER AS owner,CAST(CREATED AS CHAR) AS created_at,CAST(LAST_ALTERED AS CHAR) AS updated_at,ROUTINE_DEFINITION AS body,DTD_IDENTIFIER AS return_type,ROUTINE_BODY AS language,IS_DETERMINISTIC AS is_deterministic,SQL_DATA_ACCESS AS sql_data_access,SECURITY_TYPE AS security_type,SQL_MODE AS sql_mode,CHARACTER_SET_CLIENT AS character_set_client,COLLATION_CONNECTION AS collation_connection,DATABASE_COLLATION AS database_collation,SPECIFIC_NAME AS specific_name FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_NAME=? AND ROUTINE_TYPE=? LIMIT 1`; }
  const rows = await adapter.query(sql, values, signal); if (!rows.length) objectMissing();
  const row = rows[0], details = objectDetails(adapter, row);
  details.definition.body = catalogDefinition(row.body);
  details.properties = catalogProperties(row, input.kind === 'view' ? ['check_option', 'is_updatable', 'security_type', 'character_set_client', 'collation_connection'] : input.kind === 'trigger' ? ['event', 'timing', 'orientation', 'condition', 'action_order', 'sql_mode', 'character_set_client', 'collation_connection', 'database_collation'] : ['language', 'is_deterministic', 'sql_data_access', 'security_type', 'sql_mode', 'character_set_client', 'collation_connection', 'database_collation']);
  try {
    const sources = await adapter.query(`SHOW CREATE ${input.kind.toUpperCase()} ${quoteSchemaObject('mysql', input.schema)}.${quoteSchemaObject('mysql', input.name)}`, [], signal);
    details.definition.sql = sources.length ? mysqlSourceColumn(sources[0], input.kind) : null;
    details.definition.origin = details.definition.sql === null ? 'unknown' : 'native';
    if (sources.length) for (const key of ['sql_mode', 'character_set_client', 'collation_connection', 'Database Collation']) {
      if (key in sources[0]) details.properties[key.toLowerCase().replaceAll(' ', '_')] = catalogText(sources[0][key]);
    }
  } catch (error) { signal?.throwIfAborted(); details.definition.warnings.push(`SHOW CREATE 不可用：${error instanceof Error ? error.message : String(error)}`); }
  if (!details.definition.sql) details.definition.warnings.push('完整原生 DDL 未获授权或目录未提供；保留可读取的正文与属性。');
  if (input.kind === 'function' || input.kind === 'procedure') {
    const parameters = await adapter.query(`SELECT ORDINAL_POSITION AS position,PARAMETER_NAME AS name,PARAMETER_MODE AS mode,DTD_IDENTIFIER AS data_type,NULL AS has_default,NULL AS default_value FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA=? AND SPECIFIC_NAME=? ORDER BY ORDINAL_POSITION`, [input.schema, String(row.specific_name)], signal);
    details.parameters = parameters.filter(parameter => Number(parameter.position) > 0).map(routineParameter);
    details.returnType = input.kind === 'function' ? catalogText(parameters.find(parameter => Number(parameter.position) === 0)?.data_type ?? row.return_type) : null;
  }
  if (input.kind === 'trigger') details.references = [{ schema: details.object.parentSchema, name: details.object.parentName!, kind: 'table', column: null, catalogId: null, relation: 'trigger-target' }];
  if (input.kind === 'view') {
    try {
      details.references = catalogReferences(await adapter.query(`SELECT u.TABLE_SCHEMA AS 'schema',u.TABLE_NAME AS name,CASE WHEN t.TABLE_TYPE='VIEW' THEN 'view' WHEN t.TABLE_TYPE IN ('BASE TABLE','SYSTEM VIEW') THEN 'table' ELSE 'unknown' END AS kind,NULL AS column_name,NULL AS catalog_id FROM information_schema.VIEW_TABLE_USAGE u LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=u.TABLE_SCHEMA AND t.TABLE_NAME=u.TABLE_NAME WHERE u.VIEW_SCHEMA=? AND u.VIEW_NAME=? ORDER BY u.TABLE_SCHEMA,u.TABLE_NAME`, [input.schema, input.name], signal));
      const routines = await adapter.query(`SELECT SPECIFIC_SCHEMA AS 'schema',SPECIFIC_NAME AS name,'function' AS kind,NULL AS column_name,NULL AS catalog_id FROM information_schema.VIEW_ROUTINE_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY SPECIFIC_SCHEMA,SPECIFIC_NAME`, [input.schema, input.name], signal);
      details.references.push(...catalogReferences(routines));
    } catch (error) { signal?.throwIfAborted(); details.warnings.push(`视图引用目录不可用：${error instanceof Error ? error.message : String(error)}`); }
  }
  details.warnings.push('引用仅包含当前授权范围内可读的原生目录记录；SQL 正文中的动态引用与函数调用依赖未知。');
  return details;
}
