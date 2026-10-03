import { databaseDocsTableKey, type DatabaseDocsAnnotations, type DatabaseDocsGroup, type DatabaseDocsTableAnnotation } from './database-docs';
export type DatabaseDocsEdit =
  | { kind: 'project'; name: string | null; note: string | null }
  | { kind: 'table-note'; schema: string; table: string; note: string }
  | { kind: 'column-note'; schema: string; table: string; column: string; note: string }
  | { kind: 'table-group'; schema: string; table: string; groupId: string | null }
  | { kind: 'upsert-group'; group: DatabaseDocsGroup }
  | { kind: 'remove-group'; id: string };
/** Exact catalog identities preserve quoted case and dots; blank notes restore the native comment. */
export function editDatabaseDocsAnnotations(source: DatabaseDocsAnnotations, edit: DatabaseDocsEdit): DatabaseDocsAnnotations {
  const file = structuredClone(source);
  if (edit.kind === 'project') { file.project = { name: edit.name, note: edit.note?.trim() ? edit.note : null }; return file; }
  if (edit.kind === 'upsert-group') { const index = file.groups.findIndex(group => group.id === edit.group.id); if (index < 0) file.groups.push(structuredClone(edit.group)); else file.groups[index] = structuredClone(edit.group); return file; }
  if (edit.kind === 'remove-group') { file.groups = file.groups.filter(group => group.id !== edit.id); for (const table of file.tables) if (table.groupId === edit.id) table.groupId = null; return prune(file); }
  const key = databaseDocsTableKey(edit.schema, edit.table); let table = file.tables.find(table => databaseDocsTableKey(table.schema, table.table) === key);
  if (!table) { table = { schema: edit.schema, table: edit.table, note: null, groupId: null, columns: {} }; file.tables.push(table); }
  if (edit.kind === 'table-note') table.note = edit.note.trim() ? edit.note : null;
  else if (edit.kind === 'table-group') table.groupId = edit.groupId;
  else { if (edit.note.trim()) table.columns = { ...table.columns, [edit.column]: edit.note }; else delete table.columns[edit.column]; }
  return prune(file);
}
function prune(file: DatabaseDocsAnnotations): DatabaseDocsAnnotations { file.tables = file.tables.filter((table: DatabaseDocsTableAnnotation) => table.note !== null || table.groupId !== null || Object.keys(table.columns).length > 0); return file; }
