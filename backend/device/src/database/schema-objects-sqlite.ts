import { tokenizeSqlSemantic, type SchemaObjectDetails, type SchemaObjectIdentity } from '@fouc/shared';
import { quoteSchemaObject } from './schema-objects-input';
import { catalogDefinition, objectDetails, objectMissing } from './schema-objects-common';
import type { NativeSchemaObjectAdapter } from './schema-objects-types';

/** DBX trigger declaration adaptation: inspect the header, never words inside strings or BEGIN body. */
export function sqliteTriggerHeader(sql: string): Record<string, string | null> {
  const tokens = tokenizeSqlSemantic(sql, 'sqlite').filter(token => token.kind !== 'comment'), begin = tokens.findIndex(token => token.kind === 'word' && token.normalized === 'begin' && token.depth === 0);
  const header = begin < 0 ? tokens : tokens.slice(0, begin), words = header.filter(token => token.kind === 'word' && token.depth === 0);
  const on = words.findIndex(token => token.normalized === 'on'), eventWords = on < 0 ? words : words.slice(0, on);
  const timing = eventWords.some(token => token.normalized === 'instead') ? 'INSTEAD OF' : eventWords.some(token => token.normalized === 'before') ? 'BEFORE' : eventWords.some(token => token.normalized === 'after') ? 'AFTER' : null;
  const event = eventWords.find(token => ['insert', 'update', 'delete'].includes(token.normalized))?.normalized.toUpperCase() ?? null;
  const when = header.find(token => token.kind === 'word' && token.normalized === 'when' && token.depth === 0);
  return { timing, event, orientation: 'ROW', condition: when ? sql.slice(when.span.end, begin < 0 ? sql.length : tokens[begin].span.start).trim() : null, enabled: null };
}
export async function sqliteSchemaObject(adapter: NativeSchemaObjectAdapter, input: SchemaObjectIdentity, signal?: AbortSignal): Promise<SchemaObjectDetails> {
  const catalog = `${quoteSchemaObject('sqlite', input.schema)}.sqlite_schema`;
  const rows = await adapter.query(`SELECT ? AS schema,s.name,s.type AS kind,NULL AS catalog_id,NULL AS signature,CASE WHEN s.type='trigger' THEN ? ELSE NULL END AS parent_schema,CASE WHEN s.type='trigger' THEN s.tbl_name ELSE NULL END AS parent_name,NULL AS comment,NULL AS owner,NULL AS created_at,NULL AS updated_at,s.sql AS definition,p.type AS parent_kind FROM ${catalog} s LEFT JOIN ${catalog} p ON p.name=s.tbl_name AND p.type IN ('table','view') WHERE s.name=? AND s.type=? LIMIT 1`, [input.schema, input.schema, input.name, input.kind], signal);
  if (!rows.length) objectMissing();
  const row = rows[0], details = objectDetails(adapter, row), sql = catalogDefinition(row.definition);
  details.definition = { sql, body: null, origin: sql === null ? 'unknown' : 'native', warnings: [] };
  if (sql !== null && input.kind === 'trigger') {
    details.properties = sqliteTriggerHeader(sql);
    const tokens = tokenizeSqlSemantic(sql, 'sqlite'), begin = tokens.find(token => token.kind === 'word' && token.normalized === 'begin' && token.depth === 0);
    details.definition.body = begin ? sql.slice(begin.span.start) : null;
    details.references.push({ schema: input.schema, name: String(row.parent_name), kind: row.parent_kind === 'view' ? 'view' : row.parent_kind === 'table' ? 'table' : 'unknown', column: null, catalogId: null, relation: 'trigger-target' });
  } else if (sql !== null) {
    const as = tokenizeSqlSemantic(sql, 'sqlite').find(token => token.kind === 'word' && token.normalized === 'as' && token.depth === 0);
    details.definition.body = as ? sql.slice(as.span.end).trim() : null;
    details.properties = { owner: null, security: null };
  }
  details.warnings.push('SQLite 目录不记录 SQL 正文中的依赖关系；未推断未知引用。');
  if (sql === null) details.definition.warnings.push('当前目录未提供原始 SQL 定义。');
  return details;
}
