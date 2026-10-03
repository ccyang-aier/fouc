import type { RelationalTableStructure } from './relational-structure';
import type { RelationalProvider } from './relational';
import { DATABASE_DOCS_MAX_TABLES, databaseDocsTableKey, emptyDatabaseDocsAnnotations, type DatabaseDocsAnnotations, type DatabaseDocsNote, type DatabaseDocsSnapshot, type DatabaseDocsTable, type DatabaseDocsWarning } from './database-docs';

function present(value: string | null | undefined): string | null { return value?.trim() ? value : null; }
function mergedNote(database: string | null | undefined, local: string | null | undefined): DatabaseDocsNote {
  const native = present(database), annotation = present(local); return { database: native, local: annotation, effective: annotation ?? native, source: annotation !== null ? 'local' : native !== null ? 'database' : 'none' };
}
function guaranteedUnique(structure: RelationalTableStructure, columns: string[]): boolean {
  const unique = (key: string[]) => key.length > 0 && key.every(name => columns.includes(name));
  if (unique(structure.columns.filter(column => column.isPrimaryKey).map(column => column.name))) return true;
  if (columns.some(name => structure.columns.some(column => column.name === name && column.isUnique))) return true;
  return structure.indexes.some(index => (index.unique || index.primary) && index.valid !== false && !index.predicate && index.parts.filter(part => part.role === 'key').length > 0 && index.parts.filter(part => part.role === 'key').every(part => part.column !== null && part.expression === null && part.prefixLength === null && columns.includes(part.column)));
}
export function buildDatabaseDocsSnapshot(input: { provider: RelationalProvider; database: string; structures: readonly RelationalTableStructure[]; projectName?: string; generatedAt?: string; warnings?: DatabaseDocsWarning[] }, annotations: DatabaseDocsAnnotations = emptyDatabaseDocsAnnotations()): DatabaseDocsSnapshot {
  if (input.structures.length > DATABASE_DOCS_MAX_TABLES) throw new Error('当前数据库文档最多收集 1000 张表 / 视图');
  const tables: DatabaseDocsTable[] = [], warnings = [...input.warnings ?? []], seen = new Set<string>();
  for (const source of input.structures) {
    const key = databaseDocsTableKey(source.schema, source.table);
    if (seen.has(key)) throw new Error('结构快照包含重复对象'); seen.add(key);
    if (source.provider !== input.provider) throw new Error('结构快照不能混合数据库驱动');
    if (!['table','view','materialized_view'].includes(source.kind)) { warnings.push({ kind: 'table-skipped', table: `${source.schema}.${source.table}`, item: source.kind, message: `原生类型 ${source.kind} 未纳入表文档` }); continue; }
    const structure = structuredClone(source);
    tables.push({ key, structure, note: mergedNote(structure.properties.comment, null), columnNotes: Object.fromEntries(structure.columns.map(column => [column.name, mergedNote(column.comment, null)])), groupId: null });
    for (const message of structure.definition.warnings) warnings.push({ kind: 'metadata-incomplete', table: `${source.schema}.${source.table}`, item: null, message });
  }
  tables.sort((a, b) => a.structure.schema.localeCompare(b.structure.schema) || a.structure.table.localeCompare(b.structure.table));
  const catalog = new Map(tables.map(table => [table.key, table]));
  const relationships: DatabaseDocsSnapshot['relationships'] = [], relationshipIds = new Set<string>();
  for (const source of tables) for (const foreign of source.structure.foreignKeys) {
    const targetSchema = foreign.referencedSchema || source.structure.schema, targetKey = databaseDocsTableKey(targetSchema, foreign.referencedTable), target = catalog.get(targetKey);
    const id = JSON.stringify([source.key, foreign.name, foreign.columns, targetKey, foreign.referencedColumns]);
    if (relationshipIds.has(id)) continue; relationshipIds.add(id);
    const columnsValid = foreign.columns.length > 0 && foreign.columns.length === foreign.referencedColumns.length && foreign.columns.every(name => source.structure.columns.some(column => column.name === name));
    const resolved = columnsValid && !!target && foreign.referencedColumns.every(name => target.structure.columns.some(column => column.name === name));
    relationships.push({ id, name: foreign.name, from: { tableKey: source.key, schema: source.structure.schema, table: source.structure.table, columns: [...foreign.columns] }, to: { tableKey: targetKey, schema: targetSchema, table: foreign.referencedTable, columns: [...foreign.referencedColumns] }, resolved, cardinality: guaranteedUnique(source.structure, foreign.columns) ? 'one-to-one' : 'many-to-one', nullable: foreign.columns.some(name => source.structure.columns.some(column => column.name === name && column.isNullable)), onUpdate: foreign.onUpdate, onDelete: foreign.onDelete });
    if (!resolved) warnings.push({ kind: 'unresolved-reference', table: `${source.structure.schema}.${source.structure.table}`, item: foreign.name, message: `外键目标 ${targetSchema}.${foreign.referencedTable} 或字段未在本次快照中确认；未绑定其他同名对象` });
  }
  if (input.provider === 'sqlite' && !tables.some(table => table.note.database || Object.values(table.columnNotes).some(note => note.database))) warnings.push({ kind: 'comments-unsupported', table: null, item: null, message: 'SQLite 原生目录不提供表 / 字段注释；本地笔记单独存储于当前设备。' });
  return applyDatabaseDocsAnnotations({ formatVersion: 1, provider: input.provider, database: input.database, generatedAt: input.generatedAt ?? new Date().toISOString(), project: { name: input.projectName ?? input.database, note: null, schemas: [...new Set(tables.map(table => table.structure.schema))] }, tables, relationships, groups: [], orphans: [], warnings }, annotations);
}
export function applyDatabaseDocsAnnotations(raw: DatabaseDocsSnapshot, annotations: DatabaseDocsAnnotations): DatabaseDocsSnapshot {
  const snapshot = structuredClone(raw), catalog = new Map(snapshot.tables.map(table => [table.key, table]));
  snapshot.project.name = annotations.project.name ?? raw.project.name; snapshot.project.note = annotations.project.note;
  snapshot.groups = structuredClone(annotations.groups); snapshot.orphans = [];
  snapshot.warnings = snapshot.warnings.filter(warning => warning.kind !== 'orphaned-note');
  for (const table of snapshot.tables) { table.note = mergedNote(table.note.database, null); table.groupId = null; table.columnNotes = Object.fromEntries(table.structure.columns.map(column => [column.name, mergedNote(column.comment, null)])); }
  for (const annotation of annotations.tables) {
    const table = catalog.get(databaseDocsTableKey(annotation.schema, annotation.table));
    if (!table) { snapshot.orphans.push({ schema: annotation.schema, table: annotation.table, column: null, reason: 'table-not-in-snapshot' }); continue; }
    table.note = mergedNote(table.note.database, annotation.note); table.groupId = snapshot.groups.some(group => group.id === annotation.groupId) ? annotation.groupId : null;
    for (const [name, text] of Object.entries(annotation.columns)) {
      if (!table.structure.columns.some(column => column.name === name)) snapshot.orphans.push({ schema: annotation.schema, table: annotation.table, column: name, reason: 'column-not-in-snapshot' });
      else table.columnNotes[name] = mergedNote(table.columnNotes[name]?.database, text);
    }
  }
  if (snapshot.orphans.length) snapshot.warnings.push({ kind: 'orphaned-note', table: null, item: null, message: `${snapshot.orphans.length} 个笔记目标未在本次快照中找到（也可能不在所选范围）；全部笔记仍被保留。` });
  return snapshot;
}
