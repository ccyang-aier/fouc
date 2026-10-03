import { SCHEMA_OBJECT_KINDS, compareSchemaSearchHits, rankSchemaSearchHit, type DatabaseColumnInfo, type DatabaseObjectInfo, type RelationalProvider, type SchemaObjectList, type SchemaObjectListInput, type SchemaSearchHit, type SchemaSearchKind, type SchemaSearchResult } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { schemaSearchInput } from './schema-search-input';
import { schemaSearchQueue } from './schema-search-concurrency';

/** The session owner supplies these authorized metadata methods; no driver or business DB imports. */
export type NativeSchemaSearchAdapter = {
  /** Constructed by the authorized session owner, never accepted from request input. */
  scopeKey: string;
  provider: RelationalProvider;
  schemas(signal?: AbortSignal): Promise<string[]>;
  tables(schema: string, signal?: AbortSignal): Promise<DatabaseObjectInfo[]>;
  columns(schema: string, table: string, signal?: AbortSignal): Promise<DatabaseColumnInfo[]>;
  schemaObjects(input: SchemaObjectListInput, signal?: AbortSignal): Promise<SchemaObjectList>;
};
export const SCHEMA_SEARCH_LIMITS = { schemas: 32, relations: 2000, columnTables: 120, columns: 20000, catalogObjects: 5000, catalogPage: 1000, concurrency: 3, timeoutMs: 10000 } as const;
const kindOf = (value: DatabaseObjectInfo['kind']): SchemaSearchKind | null => value === 'materialized_view' ? 'materialized-view' : value === 'table' || value === 'view' ? value : null;
const identity = (schema: string, kind: SchemaSearchKind, name: string, parent: string | null = null) => JSON.stringify([schema, kind, parent, name]);

export async function searchNativeSchema(adapter: NativeSchemaSearchAdapter, value: unknown, callerSignal?: AbortSignal): Promise<SchemaSearchResult> {
  const input = schemaSearchInput(value), started = Date.now(), timeout = new AbortController(), timer = setTimeout(() => timeout.abort(new DOMException('搜索达到 10 秒读取上限', 'TimeoutError')), SCHEMA_SEARCH_LIMITS.timeoutMs), signal = callerSignal ? AbortSignal.any([callerSignal, timeout.signal]) : timeout.signal, queue = schemaSearchQueue(signal, SCHEMA_SEARCH_LIMITS.concurrency, adapter.scopeKey);
  const result: SchemaSearchResult = { query: input.query, hits: [], totalMatches: 0, limit: input.limit, truncated: false, scope: { schemas: [], schemasTotal: 0, relationsScanned: 0, relationsTotal: 0, columnTablesScanned: 0, columnTablesTotal: 0, columnsScanned: 0, catalogObjectsScanned: 0, complete: true, limits: [] }, issues: [], elapsedMs: 0 };
  const kinds = new Set(input.kinds), matches = new Map<string, SchemaSearchHit>();
  function limit(message: string) { result.scope.complete = false; if (!result.scope.limits.includes(message)) result.scope.limits.push(message); }
  function issue(schema: string | null, table: string | null, operation: 'tables' | 'columns' | 'objects', error: unknown) { if (signal.aborted) return; result.scope.complete = false; result.issues.push({ schema, table, operation, message: (error instanceof Error ? error.message : String(error)).slice(0, 500) }); }
  function candidate(hit: Omit<SchemaSearchHit, 'match'>) { if (!kinds.has(hit.kind)) return; const ranked = rankSchemaSearchHit(input, hit); if (ranked && (!matches.has(hit.id) || ranked.match.score < matches.get(hit.id)!.match.score)) matches.set(hit.id, ranked); }
  try {
    callerSignal?.throwIfAborted();
    const discovered = [...new Set(await queue.run(() => adapter.schemas(signal)))].sort((a, b) => a.localeCompare(b));
    callerSignal?.throwIfAborted(); result.scope.schemasTotal = discovered.length;
    if (input.schemas?.some((schema) => !discovered.includes(schema))) throw new DatabaseInputError('搜索 Schema 不属于当前连接的可见目录，请刷新后重新选择');
    const requested = input.schemas ?? discovered;
    if (requested.length > SCHEMA_SEARCH_LIMITS.schemas) limit(`当前连接包含 ${requested.length} 个可见 Schema，本次扫描前 ${SCHEMA_SEARCH_LIMITS.schemas} 个；可选择具体 Schema 缩小范围。`);
    result.scope.schemas = requested.slice(0, SCHEMA_SEARCH_LIMITS.schemas);
    const catalogKinds = SCHEMA_OBJECT_KINDS[adapter.provider].filter((kind) => kinds.has(kind));
    const needRelations = input.includeColumns && kinds.has('column') || ['table', 'view', 'materialized-view'].some((kind) => kinds.has(kind as SchemaSearchKind));
    const metadata = await Promise.all(result.scope.schemas.map(async (schema) => {
      candidate({ id: identity(schema, 'schema', schema), schema, kind: 'schema', name: schema, label: schema, parentName: null, column: null, dataType: null, comment: null, object: null, relation: null });
      const relations = needRelations ? queue.run(() => adapter.tables(schema, signal)).catch((error: unknown) => { issue(schema, null, 'tables', error); return [] as DatabaseObjectInfo[]; }) : Promise.resolve([] as DatabaseObjectInfo[]);
      const catalog = catalogKinds.length ? queue.run(() => adapter.schemaObjects({ schema, kinds: [...catalogKinds], search: '', offset: 0, limit: SCHEMA_SEARCH_LIMITS.catalogPage }, signal)).catch((error: unknown) => { issue(schema, null, 'objects', error); return null; }) : Promise.resolve(null);
      const [tables, objects] = await Promise.all([relations, catalog]);
      return { schema, tables, objects };
    }));
    callerSignal?.throwIfAborted();
    const relations: DatabaseObjectInfo[] = [];
    for (const item of metadata) {
      result.scope.relationsTotal += item.tables.length;
      const remaining = SCHEMA_SEARCH_LIMITS.relations - relations.length;
      if (item.tables.length > remaining) limit(`关系目录扫描上限为 ${SCHEMA_SEARCH_LIMITS.relations} 个，字段搜索也仅覆盖这些关系。`);
      // Discard unrequested-schema rows rather than trusting malformed adapter responses.
      for (const relation of item.tables.slice(0, Math.max(0, remaining))) {
        if (relation.schema !== item.schema) { issue(item.schema, null, 'tables', new Error('元数据返回了当前请求范围以外的 Schema')); continue; }
        const kind = kindOf(relation.kind); if (!kind) continue;
        relations.push(relation); candidate({ id: identity(item.schema, kind, relation.name), schema: item.schema, kind, name: relation.name, label: relation.name, parentName: null, column: null, dataType: null, comment: relation.comment, object: null, relation });
      }
      if (item.objects) {
        if (item.objects.hasMore) limit(`Schema ${item.schema} 原生对象超过 ${SCHEMA_SEARCH_LIMITS.catalogPage} 项，本次仅扫描第一页。`);
        for (const warning of item.objects.warnings) limit(`${item.schema}：${warning}`);
        const remainingObjects = SCHEMA_SEARCH_LIMITS.catalogObjects - result.scope.catalogObjectsScanned;
        if (item.objects.objects.length > remainingObjects) limit(`原生对象总扫描上限为 ${SCHEMA_SEARCH_LIMITS.catalogObjects} 项。`);
        for (const object of item.objects.objects.slice(0, Math.max(0, remainingObjects))) {
          if (object.schema !== item.schema) { issue(item.schema, null, 'objects', new Error('原生目录返回了当前请求范围以外的 Schema')); continue; }
          result.scope.catalogObjectsScanned++;
          // Prefer catalog identity for views: it carries the OID required for a real details open.
          const id = object.kind === 'view' || object.kind === 'materialized-view' ? identity(item.schema, object.kind, object.name) : object.id;
          const prior = matches.get(id); if (prior) matches.delete(id);
          candidate({ id, schema: item.schema, kind: object.kind, name: object.name, label: object.displayName, parentName: object.parentName, column: null, dataType: null, comment: object.comment ?? prior?.comment ?? null, object, relation: prior?.relation ?? null });
        }
      }
    }
    result.scope.relationsScanned = relations.length;
    if (input.includeColumns && kinds.has('column')) {
      result.scope.columnTablesTotal = relations.length;
      const query = input.caseSensitive ? input.query : input.query.toLowerCase(), fold = (text: string) => input.caseSensitive ? text : text.toLowerCase();
      const prioritized = [...relations].sort((a, b) => {
        const score = (relation: DatabaseObjectInfo) => query.startsWith(`${fold(relation.name)}.`) || query.includes(`${fold(relation.schema ?? '')}.${fold(relation.name)}.`) ? 0 : rankSchemaSearchHit(input, { id: '', schema: relation.schema!, kind: 'table', name: relation.name, label: relation.name, parentName: null, column: null, dataType: null, comment: relation.comment, object: null, relation }) ? 1 : 2;
        return score(a) - score(b) || (a.schema ?? '').localeCompare(b.schema ?? '') || a.name.localeCompare(b.name);
      });
      if (prioritized.length > SCHEMA_SEARCH_LIMITS.columnTables) limit(`字段搜索仅扫描 ${SCHEMA_SEARCH_LIMITS.columnTables} / ${prioritized.length} 个关系（先扫描名称匹配关系）；可选择具体 Schema 缩小范围。`);
      const columns = await Promise.all(prioritized.slice(0, SCHEMA_SEARCH_LIMITS.columnTables).map(async (relation) => {
        try { return { relation, columns: await queue.run(() => adapter.columns(relation.schema!, relation.name, signal)) }; }
        catch (error) { issue(relation.schema, relation.name, 'columns', error); return null; }
      }));
      callerSignal?.throwIfAborted();
      for (const item of columns) if (item) {
        result.scope.columnTablesScanned++;
        const remaining = SCHEMA_SEARCH_LIMITS.columns - result.scope.columnsScanned;
        if (item.columns.length > remaining) limit(`字段总扫描上限为 ${SCHEMA_SEARCH_LIMITS.columns} 项。`);
        for (const column of item.columns.slice(0, Math.max(0, remaining))) { result.scope.columnsScanned++; candidate({ id: identity(item.relation.schema!, 'column', column.name, item.relation.name), schema: item.relation.schema!, kind: 'column', name: column.name, label: column.name, parentName: item.relation.name, column: column.name, dataType: column.dataType, comment: column.comment, object: null, relation: item.relation }); }
      }
    }
    if (timeout.signal.aborted) limit('搜索达到 10 秒读取上限；本次只展示已经完成的元数据范围。');
    result.totalMatches = matches.size; result.hits = [...matches.values()].sort(compareSchemaSearchHits).slice(0, input.limit); result.truncated = matches.size > input.limit || !result.scope.complete; result.elapsedMs = Date.now() - started;
    return result;
  } finally { clearTimeout(timer); queue.dispose(); }
}
