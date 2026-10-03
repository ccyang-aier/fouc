import type { RelationalTableStructure } from '@fouc/shared';
import { structureColumnFromMetadata, structureColumnSchema, structureEditInputSchema, validateStructureDataType, validateStructureExpression, validateStructureIdentifier, type StructureColumn, type StructureEditInput, type StructureIndex } from '@fouc/shared/relational-structure-edit';

export interface StructureColumnDraft { id: string; originalName: string | null; value: StructureColumn; dropped: boolean }
export interface StructureIndexDraft { id: string; originalName: string | null; value: StructureIndex; dropped: boolean; protected: boolean }
export interface StructureEditorDraft { columns: StructureColumnDraft[]; indexes: StructureIndexDraft[]; primaryKey: string[] }
export function createStructureEditorDraft(structure: RelationalTableStructure): StructureEditorDraft {
  return {
    columns: structure.columns.map((column, index) => ({ id: `column-${index}`, originalName: column.name, value: structureColumnFromMetadata(structure, column), dropped: false })),
    indexes: structure.indexes.filter((index) => !index.primary).map((index, position) => ({ id: `index-${position}`, originalName: index.name, dropped: false, protected: index.constraintBacked,
      value: { name: index.name, unique: index.unique, method: supportedMethod(index.method), parts: index.parts.filter((part) => part.role === 'key' && part.column).map((part) => ({ column: part.column!, descending: part.descending ?? false, ...(part.prefixLength ? { prefixLength: part.prefixLength } : {}) })), include: index.parts.filter((part) => part.role === 'include' && part.column).map((part) => part.column!), predicate: index.predicate ?? '', comment: index.comment ?? '' },
    })),
    primaryKey: structure.constraints.find((constraint) => constraint.kind === 'primary')?.columns ?? structure.indexes.find((index) => index.primary)?.parts.flatMap((part) => part.column ? [part.column] : []) ?? structure.columns.filter((column) => column.isPrimaryKey).map((column) => column.name),
  };
}
function supportedMethod(method: string): StructureIndex['method'] {
  const value = method.toLowerCase(); return ['btree', 'hash', 'gin', 'gist', 'spgist', 'brin', 'fulltext', 'spatial'].includes(value) ? value as StructureIndex['method'] : 'btree';
}
export function newStructureColumn(provider: RelationalTableStructure['provider']): StructureColumn {
  return { name: '', dataType: provider === 'sqlite' ? 'TEXT' : 'VARCHAR(255)', nullable: true, default: { kind: 'none' }, comment: '', generated: null, identity: null };
}
export function newStructureIndex(): StructureIndex { return { name: '', unique: false, method: 'btree', parts: [], include: [], predicate: '', comment: '' }; }
export function structureDraftInput(structure: RelationalTableStructure, draft: StructureEditorDraft): StructureEditInput {
  const original = createStructureEditorDraft(structure), operations: StructureEditInput['operations'] = [];
  for (const column of draft.columns) {
    if (column.dropped) { if (column.originalName) operations.push({ id: column.id, kind: 'drop-column', name: column.originalName }); continue; }
    if (!column.originalName) { operations.push({ id: column.id, kind: 'add-column', column: column.value }); continue; }
    const before = original.columns.find((entry) => entry.originalName === column.originalName)!.value;
    const patch: Partial<StructureColumn> = {};
    for (const key of Object.keys(before) as (keyof StructureColumn)[]) if (JSON.stringify(before[key]) !== JSON.stringify(column.value[key])) Object.assign(patch, { [key]: column.value[key] });
    if (Object.keys(patch).length) operations.push({ id: column.id, kind: 'update-column', originalName: column.originalName, patch });
  }
  for (const index of draft.indexes) {
    if (index.originalName) { if (index.dropped) operations.push({ id: index.id, kind: 'drop-index', name: index.originalName }); }
    else if (!index.dropped) operations.push({ id: index.id, kind: 'add-index', index: index.value });
  }
  if (JSON.stringify(original.primaryKey) !== JSON.stringify(draft.primaryKey)) operations.push({ id: 'primary-key', kind: 'set-primary-key', columns: draft.primaryKey });
  return { operations };
}
export function validateStructureDraft(structure: RelationalTableStructure, draft: StructureEditorDraft): string[] {
  const input = structureDraftInput(structure, draft);
  if (!input.operations.length) return [];
  const errors: string[] = [], parsed = structureEditInputSchema.safeParse(input);
  if (!parsed.success) errors.push(...parsed.error.issues.map((issue) => issue.message));
  const names = draft.columns.filter((column) => !column.dropped).map((column) => column.value.name);
  const keys = structure.provider === 'postgres' ? names : names.map((name) => name.toLowerCase());
  if (new Set(keys).size !== keys.length) errors.push('字段名称重复');
  for (const op of input.operations) {
    if (op.kind !== 'add-column' && op.kind !== 'update-column') continue;
    const column = op.kind === 'add-column' ? op.column : draft.columns.find((entry) => entry.originalName === op.originalName)!.value;
    const invalid = structureColumnSchema.safeParse(column); if (!invalid.success) errors.push(...invalid.error.issues.map((issue) => `${column.name || '新字段'}：${issue.message}`));
    const type = op.kind === 'add-column' || op.patch.dataType !== undefined ? validateStructureDataType(column.dataType, structure.provider, structure.properties.strict === '1' || structure.properties.strict === 'true') : null;
    const name = validateStructureIdentifier(column.name, structure.provider); if (name) errors.push(`${column.name || '新字段'}：${name}`); if (type) errors.push(`${column.name || '新字段'}：${type}`);
    if (column.default.kind === 'expression' && (op.kind === 'add-column' || op.patch.default !== undefined)) { const error = validateStructureExpression(column.default.value, structure.provider, [], 'default'); if (error) errors.push(`${column.name}：${error}`); }
    if (column.generated && (op.kind === 'add-column' || op.patch.generated !== undefined)) { const error = validateStructureExpression(column.generated.expression, structure.provider, names.filter((name) => name !== column.name), 'generated'); if (error) errors.push(`${column.name}：${error}`); }
  }
  return [...new Set(errors)];
}
