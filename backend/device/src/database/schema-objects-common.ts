import type { SchemaObjectDetails, SchemaObjectReference, SchemaRoutineParameter } from '@fouc/shared';
import { catalogText, schemaObjectRow } from './schema-objects-list';
import type { NativeSchemaObjectAdapter } from './schema-objects-types';
import { DatabaseInputError } from './input-error';
export function objectDetails(adapter: NativeSchemaObjectAdapter, row: Record<string, unknown>): SchemaObjectDetails {
  return { provider: adapter.provider, object: schemaObjectRow(row, adapter.provider), definition: { sql: null, body: null, origin: 'unknown', warnings: [] }, properties: {}, parameters: [], returnType: null, references: [], referencesComplete: false, warnings: [] };
}
export function catalogDefinition(value: unknown): string | null {
  const text = catalogText(value); if (text !== null && Buffer.byteLength(text) > 8 * 1024 * 1024) throw new DatabaseInputError('对象定义超过当前 8 MiB 元数据展示限制'); return text;
}
export function catalogProperties(row: Record<string, unknown>, names: string[]): Record<string, string | null> { return Object.fromEntries(names.map(name => [name, catalogText(row[name])])); }
export function routineParameter(row: Record<string, unknown>): SchemaRoutineParameter {
  const position = Number(row.position), mode = catalogText(row.mode);
  return { position, name: catalogText(row.name), mode: mode && ['IN', 'OUT', 'INOUT', 'VARIADIC', 'TABLE'].includes(mode) ? mode as SchemaRoutineParameter['mode'] : null, type: catalogText(row.data_type), hasDefault: row.has_default === null || row.has_default === undefined ? null : row.has_default === true || row.has_default === 1 || row.has_default === 'true', defaultValue: catalogText(row.default_value) };
}
export function catalogReferences(rows: Record<string, unknown>[], relation: SchemaObjectReference['relation'] = 'references'): SchemaObjectReference[] {
  return rows.map(row => ({ schema: catalogText(row.schema), name: String(row.name), kind: ['view', 'materialized-view', 'function', 'procedure', 'trigger', 'sequence', 'table', 'type', 'language'].includes(String(row.kind)) ? row.kind as SchemaObjectReference['kind'] : 'unknown', column: catalogText(row.column_name), catalogId: catalogText(row.catalog_id), relation }));
}
export function objectMissing(): never { throw new DatabaseInputError('对象已被删除、重命名或不再可见，请刷新当前目录'); }
