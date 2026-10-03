import { tokenizeSqlSemantic, type SchemaObjectDetails, type SchemaObjectIdentity } from '@fouc/shared';
import { quoteSchemaObject } from './schema-objects-input';
import { catalogDefinition, catalogProperties, catalogReferences, objectDetails, objectMissing, routineParameter } from './schema-objects-common';
import { catalogText } from './schema-objects-list';
import type { NativeSchemaObjectAdapter } from './schema-objects-types';

// DBX isolates pg_get_* deparsing from the user's search_path; this SET is local to the statement transaction.
const PATH = `WITH fouc_catalog_path AS (SELECT pg_catalog.set_config('search_path','',true) AS applied)`;
const PATH_JOIN = `CROSS JOIN fouc_catalog_path path_guard`;
const PATH_WHERE = `AND path_guard.applied IS NOT NULL`;
const RELATION_BASE = `n.nspname AS schema,c.relname AS name,CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized-view' ELSE 'sequence' END AS kind,c.oid::text AS catalog_id,NULL::text AS signature,NULL::text AS parent_schema,NULL::text AS parent_name,pg_catalog.obj_description(c.oid,'pg_class') AS comment,pg_catalog.pg_get_userbyid(c.relowner) AS owner,NULL::text AS created_at,NULL::text AS updated_at`;

export function splitCatalogExpressions(sql: string): string[] {
  const tokens = tokenizeSqlSemantic(sql, 'postgres'), result: string[] = [];
  let start = 0, brackets = 0;
  for (const token of tokens) {
    if (token.text === '[') brackets++;
    else if (token.text === ']') brackets--;
    else if (token.kind === 'punctuation' && token.text === ',' && token.depth === 0 && brackets === 0) { result.push(sql.slice(start, token.span.start).trim()); start = token.span.end; }
  }
  const last = sql.slice(start).trim(); if (last) result.push(last); return result;
}
async function postgresReferences(adapter: NativeSchemaObjectAdapter, identity: SchemaObjectIdentity, signal?: AbortSignal) {
  const dependency = identity.kind === 'function' || identity.kind === 'procedure'
    ? `d.classid='pg_catalog.pg_proc'::pg_catalog.regclass AND d.objid=$1::oid`
    : `d.classid='pg_catalog.pg_rewrite'::pg_catalog.regclass AND d.objid IN (SELECT oid FROM pg_catalog.pg_rewrite WHERE ev_class=$1::oid)`;
  const rows = await adapter.query(`SELECT DISTINCT n.nspname AS schema,c.relname AS name,CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized-view' WHEN 'S' THEN 'sequence' ELSE 'table' END AS kind,a.attname AS column_name,c.oid::text AS catalog_id FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class c ON d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND c.oid=d.refobjid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.refobjsubid WHERE ${dependency} AND c.oid<>$1::oid
UNION SELECT DISTINCT n.nspname,p.proname,CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END,NULL,p.oid::text FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_proc p ON d.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass AND p.oid=d.refobjid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE ${dependency}
UNION SELECT DISTINCT n.nspname,t.typname,'type',NULL,t.oid::text FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_type t ON d.refclassid='pg_catalog.pg_type'::pg_catalog.regclass AND t.oid=d.refobjid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE ${dependency} ORDER BY schema,name,column_name`, [identity.catalogId], signal);
  return catalogReferences(rows);
}
async function postgresRoutine(adapter: NativeSchemaObjectAdapter, input: SchemaObjectIdentity, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  const rows = await adapter.query(`${PATH} SELECT n.nspname AS schema,p.proname AS name,CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END AS kind,p.oid::text AS catalog_id,pg_catalog.pg_get_function_identity_arguments(p.oid) AS signature,NULL::text AS parent_schema,NULL::text AS parent_name,pg_catalog.obj_description(p.oid,'pg_proc') AS comment,pg_catalog.pg_get_userbyid(p.proowner) AS owner,NULL::text AS created_at,NULL::text AS updated_at,pg_catalog.pg_get_functiondef(p.oid) AS definition,p.prosrc AS body,pg_catalog.pg_get_function_result(p.oid) AS return_type,pg_catalog.pg_get_function_arguments(p.oid) AS arguments,pg_catalog.pg_get_expr(p.proargdefaults,0) AS defaults,language.lanname AS language,CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END AS volatility,CASE p.proparallel WHEN 's' THEN 'SAFE' WHEN 'r' THEN 'RESTRICTED' ELSE 'UNSAFE' END AS parallel,p.prosecdef AS security_definer,p.proisstrict AS strict,p.proleakproof AS leakproof,p.proretset AS returns_set,p.procost::text AS cost,p.prorows::text AS rows,p.proconfig AS settings FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language language ON language.oid=p.prolang ${PATH_JOIN} WHERE n.nspname=$1 AND p.proname=$2 AND p.oid=$3::oid AND p.prokind=$4 ${PATH_WHERE} LIMIT 1`, [input.schema, input.name, input.catalogId, input.kind === 'procedure' ? 'p' : 'f'], signal);
  if (!rows.length) objectMissing(); const row = rows[0], details = objectDetails(adapter, row);
  details.definition = { sql: catalogDefinition(row.definition), body: catalogDefinition(row.body), origin: row.definition == null ? 'unknown' : 'native', warnings: [] };
  details.returnType = input.kind === 'function' ? catalogText(row.return_type) : null;
  details.properties = catalogProperties(row, ['arguments', 'language', 'volatility', 'parallel', 'security_definer', 'strict', 'leakproof', 'returns_set', 'cost', 'rows']);
  details.properties.settings = Array.isArray(row.settings) ? JSON.stringify(row.settings) : catalogText(row.settings);
  const parameters = await adapter.query(`${PATH}, args AS (SELECT arg.position::int AS position,p.proargnames[arg.position] AS name,COALESCE(p.proargmodes[arg.position],'i') AS mode_code,pg_catalog.format_type(arg.type_oid,NULL) AS data_type,p.pronargs,p.pronargdefaults FROM pg_catalog.pg_proc p CROSS JOIN LATERAL unnest(COALESCE(p.proallargtypes,p.proargtypes::oid[])) WITH ORDINALITY AS arg(type_oid,position) ${PATH_JOIN} WHERE p.oid=$1::oid ${PATH_WHERE}), numbered AS (SELECT *,count(*) FILTER (WHERE mode_code IN ('i','b','v')) OVER (ORDER BY position) AS input_position FROM args) SELECT position,name,CASE mode_code WHEN 'i' THEN 'IN' WHEN 'o' THEN 'OUT' WHEN 'b' THEN 'INOUT' WHEN 'v' THEN 'VARIADIC' ELSE 'TABLE' END AS mode,data_type,CASE WHEN mode_code IN ('i','b','v') THEN input_position>pronargs-pronargdefaults ELSE false END AS has_default,CASE WHEN mode_code IN ('i','b','v') THEN input_position-(pronargs-pronargdefaults) ELSE NULL END AS default_position FROM numbered ORDER BY position`, [input.catalogId], signal);
  const defaults = row.defaults == null ? [] : splitCatalogExpressions(String(row.defaults));
  details.parameters = parameters.map(parameter => routineParameter({ ...parameter, default_value: Number(parameter.default_position) > 0 ? defaults[Number(parameter.default_position) - 1] ?? null : null }));
  details.references = await postgresReferences(adapter, input, signal);
  details.warnings.push('引用为 pg_depend 已记录的直接依赖；过程 / 函数正文中的动态 SQL 与未记录的对象引用未知。');
  return details;
}
async function postgresTrigger(adapter: NativeSchemaObjectAdapter, input: SchemaObjectIdentity, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  const rows = await adapter.query(`${PATH} SELECT n.nspname AS schema,t.tgname AS name,'trigger' AS kind,t.oid::text AS catalog_id,NULL::text AS signature,n.nspname AS parent_schema,c.relname AS parent_name,pg_catalog.obj_description(t.oid,'pg_trigger') AS comment,pg_catalog.pg_get_userbyid(c.relowner) AS owner,NULL::text AS created_at,NULL::text AS updated_at,pg_catalog.pg_get_triggerdef(t.oid,true) AS definition,CASE WHEN (t.tgtype & 64)<>0 THEN 'INSTEAD OF' WHEN (t.tgtype & 2)<>0 THEN 'BEFORE' ELSE 'AFTER' END AS timing,concat_ws(', ',CASE WHEN (t.tgtype & 4)<>0 THEN 'INSERT' END,CASE WHEN (t.tgtype & 8)<>0 THEN 'DELETE' END,CASE WHEN (t.tgtype & 16)<>0 THEN 'UPDATE' END,CASE WHEN (t.tgtype & 32)<>0 THEN 'TRUNCATE' END) AS events,CASE WHEN (t.tgtype & 1)<>0 THEN 'ROW' ELSE 'STATEMENT' END AS orientation,CASE t.tgenabled WHEN 'D' THEN 'DISABLED' WHEN 'R' THEN 'REPLICA' WHEN 'A' THEN 'ALWAYS' ELSE 'ORIGIN' END AS enabled,t.tgdeferrable AS deferrable,t.tginitdeferred AS initially_deferred,pg_catalog.pg_get_expr(t.tgqual,t.tgrelid) AS condition,p.proname AS function_name,pn.nspname AS function_schema,p.oid::text AS function_oid,c.oid::text AS parent_oid,c.relkind AS parent_kind FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace ${PATH_JOIN} WHERE n.nspname=$1 AND t.tgname=$2 AND t.oid=$3::oid AND NOT t.tgisinternal ${PATH_WHERE} LIMIT 1`, [input.schema, input.name, input.catalogId], signal);
  if (!rows.length) objectMissing(); const row = rows[0], details = objectDetails(adapter, row);
  details.definition = { sql: catalogDefinition(row.definition), body: null, origin: 'native', warnings: [] };
  details.properties = catalogProperties(row, ['timing', 'events', 'orientation', 'enabled', 'deferrable', 'initially_deferred', 'condition']);
  details.references = [{ schema: input.schema, name: String(row.parent_name), kind: row.parent_kind === 'v' ? 'view' : 'table', column: null, catalogId: String(row.parent_oid), relation: 'trigger-target' }, { schema: String(row.function_schema), name: String(row.function_name), kind: 'function', column: null, catalogId: String(row.function_oid), relation: 'trigger-function' }];
  details.referencesComplete = true; details.warnings.push('引用展示触发器直接绑定的关系与执行函数，不包含执行函数正文的传递依赖。');
  return details;
}
async function postgresRelation(adapter: NativeSchemaObjectAdapter, input: SchemaObjectIdentity, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  const rows = await adapter.query(`${PATH} SELECT ${RELATION_BASE},CASE WHEN c.relkind IN ('v','m') THEN pg_catalog.pg_get_viewdef(c.oid,false) END AS body,c.reloptions AS options,c.relispopulated AS populated,tablespace.spcname AS tablespace,CASE WHEN c.relkind='m' THEN pg_catalog.pg_relation_size(c.oid)::text END AS size_bytes,s.seqstart::text AS start_value,s.seqincrement::text AS increment,s.seqmin::text AS minimum,s.seqmax::text AS maximum,s.seqcache::text AS cache,s.seqcycle AS cycle,pg_catalog.format_type(s.seqtypid,NULL) AS data_type,sv.last_value::text AS last_value FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_sequence s ON s.seqrelid=c.oid LEFT JOIN pg_catalog.pg_sequences sv ON sv.schemaname=n.nspname AND sv.sequencename=c.relname LEFT JOIN pg_catalog.pg_tablespace tablespace ON tablespace.oid=c.reltablespace ${PATH_JOIN} WHERE n.nspname=$1 AND c.relname=$2 AND c.oid=$3::oid AND c.relkind=$4 ${PATH_WHERE} LIMIT 1`, [input.schema, input.name, input.catalogId, input.kind === 'view' ? 'v' : input.kind === 'materialized-view' ? 'm' : 'S'], signal);
  if (!rows.length) objectMissing(); const row = rows[0], details = objectDetails(adapter, row), qualified = `${quoteSchemaObject('postgres', input.schema)}.${quoteSchemaObject('postgres', input.name)}`;
  if (input.kind === 'sequence') {
    details.properties = catalogProperties(row, ['data_type', 'start_value', 'increment', 'minimum', 'maximum', 'cache', 'cycle', 'last_value']);
    details.references = catalogReferences(await adapter.query(`SELECT n.nspname AS schema,c.relname AS name,'table' AS kind,a.attname AS column_name,c.oid::text AS catalog_id,d.deptype AS dependency_type FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class c ON c.oid=d.refobjid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_catalog.pg_class'::pg_catalog.regclass AND d.objid=$1::oid AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.deptype IN ('a','i') ORDER BY n.nspname,c.relname,a.attnum`, [input.catalogId], signal), 'owned-by');
    const fields = ['start_value', 'increment', 'minimum', 'maximum', 'cache'];
    if (fields.every(field => /^-?\d+$/.test(String(row[field] ?? ''))) && ['smallint', 'integer', 'bigint'].includes(String(row.data_type)) && typeof row.cycle === 'boolean') {
      details.definition.sql = `CREATE SEQUENCE ${qualified}\n  AS ${row.data_type}\n  INCREMENT BY ${row.increment}\n  MINVALUE ${row.minimum}\n  MAXVALUE ${row.maximum}\n  START WITH ${row.start_value}\n  CACHE ${row.cache}\n  ${row.cycle ? 'CYCLE' : 'NO CYCLE'};`;
      if (details.object.owner) details.definition.sql += `\nALTER SEQUENCE ${qualified} OWNER TO ${quoteSchemaObject('postgres', details.object.owner)};`;
      details.definition.origin = 'reconstructed';
    }
    details.referencesComplete = true;
    details.definition.warnings.push('序列 DDL 按 pg_sequence 参数重建；当前计数与 identity 列的内部关联不写入 CREATE 定义。');
    if (row.last_value == null) details.warnings.push('last_value 未初始化或当前主体无读取权限；未调用 nextval / currval。');
  } else {
    details.definition.body = catalogDefinition(row.body);
    const columns = await adapter.query(`SELECT attname AS name FROM pg_catalog.pg_attribute WHERE attrelid=$1::oid AND attnum>0 AND NOT attisdropped ORDER BY attnum`, [input.catalogId], signal);
    const columnSql = columns.length ? ` (${columns.map(column => quoteSchemaObject('postgres', String(column.name))).join(', ')})` : '';
    const options = Array.isArray(row.options) ? row.options.map(String) : [];
    details.properties = { options: options.length ? JSON.stringify(options) : null, populated: input.kind === 'materialized-view' ? catalogText(row.populated) : null, tablespace: catalogText(row.tablespace), size_bytes: catalogText(row.size_bytes) };
    if (details.definition.body !== null) {
      const storage = options.length ? `\nWITH (${options.join(', ')})` : '', tablespace = input.kind === 'materialized-view' && row.tablespace ? `\nTABLESPACE ${quoteSchemaObject('postgres', String(row.tablespace))}` : '';
      details.definition.sql = `CREATE ${input.kind === 'materialized-view' ? 'MATERIALIZED VIEW' : 'OR REPLACE VIEW'} ${qualified}${columnSql}${storage}${tablespace}\nAS\n${details.definition.body.replace(/;\s*$/, '')}${input.kind === 'materialized-view' ? row.populated ? '\nWITH DATA' : '\nWITH NO DATA' : ''};`;
      details.definition.origin = 'reconstructed';
      details.definition.warnings.push('CREATE 语句由原生 pg_get_viewdef 正文、目录列名与选项组合；未包含对象授权与独立索引。');
    }
    details.references = await postgresReferences(adapter, input, signal); details.referencesComplete = true;
  }
  return details;
}
export async function postgresSchemaObject(adapter: NativeSchemaObjectAdapter, input: SchemaObjectIdentity, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  if (input.kind === 'function' || input.kind === 'procedure') return postgresRoutine(adapter, input, signal);
  if (input.kind === 'trigger') return postgresTrigger(adapter, input, signal);
  return postgresRelation(adapter, input, signal);
}
