import type { RelationalProvider } from './relational';
export type SchemaObjectKind = 'view' | 'materialized-view' | 'trigger' | 'function' | 'procedure' | 'sequence';
export interface SchemaObjectIdentity {
  schema: string; name: string; kind: SchemaObjectKind; catalogId: string | null;
  signature: string | null; parentSchema: string | null; parentName: string | null;
}
export interface SchemaObject extends SchemaObjectIdentity {
  id: string; displayName: string; comment: string | null; owner: string | null;
  createdAt: string | null; updatedAt: string | null;
}
export interface SchemaObjectListInput { schema: string; kinds?: SchemaObjectKind[]; search?: string; offset?: number; limit?: number }
export interface SchemaObjectList {
  provider: RelationalProvider; schema: string; objects: SchemaObject[]; supportedKinds: SchemaObjectKind[];
  offset: number; limit: number; hasMore: boolean; warnings: string[];
}
export interface SchemaObjectReference {
  schema: string | null; name: string; kind: SchemaObjectKind | 'table' | 'type' | 'language' | 'unknown';
  column: string | null; catalogId: string | null; relation: 'references' | 'owned-by' | 'trigger-target' | 'trigger-function';
}
export interface SchemaRoutineParameter {
  position: number; name: string | null; mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC' | 'TABLE' | null;
  type: string | null; hasDefault: boolean | null; defaultValue: string | null;
}
export interface SchemaObjectDetails {
  provider: RelationalProvider; object: SchemaObject;
  definition: { sql: string | null; body: string | null; origin: 'native' | 'reconstructed' | 'unknown'; warnings: string[] };
  properties: Record<string, string | null>; parameters: SchemaRoutineParameter[]; returnType: string | null;
  references: SchemaObjectReference[]; referencesComplete: boolean; warnings: string[];
}
export const SCHEMA_OBJECT_KINDS: Record<RelationalProvider, readonly SchemaObjectKind[]> = {
  postgres: ['view', 'materialized-view', 'function', 'procedure', 'trigger', 'sequence'],
  mysql: ['view', 'function', 'procedure', 'trigger'], sqlite: ['view', 'trigger'],
};
export const SCHEMA_OBJECT_LABELS: Record<SchemaObjectKind, string> = { view: '视图', 'materialized-view': '物化视图', function: '函数', procedure: '过程', trigger: '触发器', sequence: '序列' };
export function schemaObjectKey(object: SchemaObjectIdentity): string {
  if (object.catalogId !== null) return JSON.stringify([object.schema, object.kind, object.catalogId]);
  return JSON.stringify([object.schema, object.kind, object.catalogId, object.name, object.signature, object.parentSchema, object.parentName]);
}
