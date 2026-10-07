import { buildErDiagram, type ErDiagramLoadResult, type ErDiagramModel, type RelationalProvider, type RelationalTableStructure } from '@fouc/shared';
import type { RelationalDriver } from './drivers/relational-driver';

export interface RelationalDiagramInput { connectionId: string; provider: RelationalProvider; schema: string; tables?: string[]; maxTables?: number; includeViews?: boolean }
export interface RelationalDiagramControl { signal?: AbortSignal; onProgress?: (progress: { loaded: number; total: number; table: string }) => void }
/** Caller owns session authorization; only this approved schema is probed, never FK target schemas. */
export async function loadRelationalDiagram(driver: RelationalDriver, input: RelationalDiagramInput, control: RelationalDiagramControl = {}): Promise<ErDiagramLoadResult> {
  const maxTables = input.maxTables ?? 100;
  if (!Number.isInteger(maxTables) || maxTables < 1 || maxTables > 200 || !input.schema.trim() || !input.connectionId.trim() || input.schema.includes('\0')) throw new Error('关系图读取范围不合法');
  if (!['mysql', 'postgres', 'sqlite'].includes(input.provider)) throw new Error('关系图 Provider 不受支持');
  if (input.tables && (input.tables.length > maxTables || new Set(input.tables).size !== input.tables.length)) throw new Error('表选择重复或超出关系图上限');
  control.signal?.throwIfAborted();
  const catalog = (await driver.tables(input.schema)).filter((table) => table.kind === 'table' || input.includeViews && ['view', 'materialized_view'].includes(table.kind));
  const selected = input.tables ? catalog.filter((table) => input.tables!.includes(table.name)) : catalog.slice(0, maxTables);
  if (input.tables && selected.length !== input.tables.length) throw new Error('选择的表已不存在或不在批准的 Schema 中');
  const structures: RelationalTableStructure[] = [], warnings: { table: string; message: string }[] = []; let next = 0, fieldCount = 0;
  const workers = Array.from({ length: Math.min(3, selected.length) }, async () => {
    while (next < selected.length) {
      control.signal?.throwIfAborted(); const relation = selected[next++];
      let reserved = 0;
      try {
        const columns = await driver.columns(input.schema, relation.name); control.signal?.throwIfAborted();
        if (fieldCount + columns.length > 20000) throw new Error('已达到关系图 20000 字段上限，请缩小对象选择'); fieldCount += columns.length; reserved = columns.length;
        const detail = await driver.structure(input.schema, relation.name, columns); control.signal?.throwIfAborted();
        if (detail.schema !== input.schema || detail.table !== relation.name) throw new Error('返回结构与批准的对象范围不一致');
        structures.push({ ...detail, columns, connectionId: input.connectionId, provider: input.provider }); reserved = 0;
        try { control.onProgress?.({ loaded: structures.length, total: selected.length, table: relation.name }); } catch { /* Progress observers do not own metadata loading. */ }
      } catch (reason) { fieldCount -= reserved; if (control.signal?.aborted) throw reason; warnings.push({ table: relation.name, message: reason instanceof Error ? reason.message : String(reason) }); }
    }
  });
  // Wait for all in-flight probes before returning cancellation or releasing an owned driver.
  const outcomes = await Promise.allSettled(workers); control.signal?.throwIfAborted();
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected'); if (rejected?.status === 'rejected') throw rejected.reason;
  structures.sort((a, b) => a.table.localeCompare(b.table));
  const model: ErDiagramModel = structures.length ? buildErDiagram(structures) : { connectionId: input.connectionId, provider: input.provider, schemas: [input.schema], nodes: [], edges: [], issues: [] };
  for (const warning of warnings) model.issues.push({ message: `${input.schema}.${warning.table} 结构读取失败：${warning.message}` });
  const truncated = !input.tables && selected.length < catalog.length;
  if (truncated) model.issues.push({ message: `目录有 ${catalog.length} 个对象，本次只加载前 ${selected.length} 个；其余对象的外键不会出现在图中` });
  if (input.includeViews) model.issues.push({ message: '视图只展示实际字段与对象元数据；此图不把 SQL 文本匹配猜测当作确定的视图字段血缘' });
  return { model, loadedTables: structures.length, catalogTables: catalog.length, truncated };
}
