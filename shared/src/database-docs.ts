import type { RelationalProvider } from './relational';
import type { RelationalTableStructure } from './relational-structure';

export interface DatabaseDocsGroup { id: string; name: string; hue: number; note: string | null }
export interface DatabaseDocsTableAnnotation { schema: string; table: string; note: string | null; groupId: string | null; columns: Record<string, string> }
export interface DatabaseDocsAnnotations {
  formatVersion: 1;
  project: { name: string | null; note: string | null };
  groups: DatabaseDocsGroup[];
  tables: DatabaseDocsTableAnnotation[];
}
export interface DatabaseDocsAnnotationState { version: string | null; updatedAt: number | null; persistent: boolean; annotations: DatabaseDocsAnnotations }
export interface DatabaseDocsAnnotationsUpdate { version: string | null; annotations: DatabaseDocsAnnotations }
export interface DatabaseDocsNote { database: string | null; local: string | null; effective: string | null; source: 'database' | 'local' | 'none' }
export interface DatabaseDocsTable { key: string; structure: RelationalTableStructure; note: DatabaseDocsNote; columnNotes: Record<string, DatabaseDocsNote>; groupId: string | null }
export interface DatabaseDocsRelationship {
  id: string; name: string;
  from: { tableKey: string; schema: string; table: string; columns: string[] };
  to: { tableKey: string; schema: string; table: string; columns: string[] };
  resolved: boolean; cardinality: 'one-to-one' | 'many-to-one'; nullable: boolean;
  onUpdate: string; onDelete: string;
}
export interface DatabaseDocsWarning { kind: 'table-skipped' | 'metadata-incomplete' | 'comments-unsupported' | 'unresolved-reference' | 'orphaned-note' | 'dbml-omitted'; table: string | null; item: string | null; message: string }
export interface DatabaseDocsOrphan { schema: string; table: string; column: string | null; reason: 'table-not-in-snapshot' | 'column-not-in-snapshot' }
export interface DatabaseDocsSnapshot {
  formatVersion: 1; provider: RelationalProvider; database: string; generatedAt: string;
  project: { name: string; note: string | null; schemas: string[] };
  tables: DatabaseDocsTable[]; relationships: DatabaseDocsRelationship[]; groups: DatabaseDocsGroup[];
  orphans: DatabaseDocsOrphan[]; warnings: DatabaseDocsWarning[];
}
export interface DatabaseDocsCollectInput { schemas: string[]; tables?: Array<{ schema: string; table: string }>; projectName?: string }
export interface DatabaseDocsExport { text: string; warnings: DatabaseDocsWarning[] }
export const DATABASE_DOCS_MAX_TABLES = 1000;
export const DATABASE_DOCS_MAX_NOTE_BYTES = 64 * 1024;
export const DATABASE_DOCS_MAX_ANNOTATION_BYTES = 2 * 1024 * 1024;
export function databaseDocsTableKey(schema: string, table: string): string { return JSON.stringify([schema, table]); }
export function emptyDatabaseDocsAnnotations(): DatabaseDocsAnnotations { return { formatVersion: 1, project: { name: null, note: null }, groups: [], tables: [] }; }
export * from './database-docs-validation';
export * from './database-docs-model';
export * from './database-docs-edits';
export * from './database-docs-export';
