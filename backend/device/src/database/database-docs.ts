import { buildDatabaseDocsSnapshot, databaseDocsTableKey, validateDatabaseDocsCollectInput, DATABASE_DOCS_MAX_TABLES, type DatabaseDocsSnapshot, type DatabaseDocsWarning } from '@fouc/shared/database-docs';
import type { DatabaseObjectInfo, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import { DatabaseInputError } from './input-error';

export interface NativeDatabaseDocsAdapter {
  provider: RelationalProvider;
  database: string;
  listTables: (schema: string, signal?: AbortSignal) => Promise<DatabaseObjectInfo[]>;
  structure: (schema: string, table: string, signal?: AbortSignal) => Promise<RelationalTableStructure>;
}
export async function collectDatabaseDocs(adapter: NativeDatabaseDocsAdapter, value: unknown, signal?: AbortSignal): Promise<DatabaseDocsSnapshot> {
  let input; try { input = validateDatabaseDocsCollectInput(value); } catch (error) { throw new DatabaseInputError(error instanceof Error ? error.message : String(error)); }
  signal?.throwIfAborted();
  const warnings: DatabaseDocsWarning[] = [], targets: Array<{schema: string; table: string}> = [], keys = new Set<string>();
  const selected = input.tables?.length ? new Set(input.tables.map(table => databaseDocsTableKey(table.schema, table.table))) : null;
  for (const schema of input.schemas) {
    try {
      const objects = await adapter.listTables(schema, signal); signal?.throwIfAborted();
      for (const object of objects) {
        const key = databaseDocsTableKey(schema, object.name); if (selected && !selected.has(key)) continue;
        if (!['table','view','materialized_view'].includes(object.kind)) { warnings.push({ kind:'table-skipped', table:`${schema}.${object.name}`, item:object.kind, message:`原生 ${object.kind} 不作为表 / 视图文档采集` }); continue; }
        if (keys.has(key)) continue; keys.add(key); targets.push({ schema, table: object.name });
      }
    } catch (error) { signal?.throwIfAborted(); warnings.push({ kind:'table-skipped', table:`${schema}.*`, item:null, message:`Schema 目录不可用：${error instanceof Error ? error.message : String(error)}` }); }
  }
  if (targets.length > DATABASE_DOCS_MAX_TABLES) throw new DatabaseInputError('当前数据库文档最多收集 1000 张表 / 视图，请缩小选择范围');
  if (selected) for (const table of input.tables!) if (!keys.has(databaseDocsTableKey(table.schema, table.table))) warnings.push({ kind:'table-skipped', table:`${table.schema}.${table.table}`, item:null, message:'选择的对象未在当前原生目录中确认，未猜测或读取其他对象' });
  let index = 0, bytes = 0, stopped = false; const structures: RelationalTableStructure[] = [];
  const worker = async () => {
    while (!stopped && index < targets.length) {
      signal?.throwIfAborted(); const target = targets[index++];
      let structure: RelationalTableStructure;
      try { structure = await adapter.structure(target.schema, target.table, signal); signal?.throwIfAborted(); if (stopped) return; }
      catch (error) { signal?.throwIfAborted(); warnings.push({ kind:'table-skipped', table:`${target.schema}.${target.table}`, item:null, message:`结构不可用：${error instanceof Error ? error.message : String(error)}` }); continue; }
      if (structure.schema !== target.schema || structure.table !== target.table || structure.provider !== adapter.provider) throw new Error('文档结构适配器返回了范围之外的对象');
      bytes += Buffer.byteLength(JSON.stringify(structure)); if (bytes > 16 * 1024 * 1024) throw new DatabaseInputError('文档原生结构超过当前 16 MiB 快照限制，请缩小选择范围');
      structures.push(structure);
    }
  };
  try { await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker)); } catch (error) { stopped = true; throw error; } signal?.throwIfAborted();
  return buildDatabaseDocsSnapshot({ provider: adapter.provider, database: adapter.database, structures, projectName:input.projectName, warnings });
}
export { DatabaseDocsRepository } from './database-docs-repository';
