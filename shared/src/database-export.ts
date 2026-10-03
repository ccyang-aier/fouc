import type { DatabaseCell, DatabaseObjectKind } from './database';
import type { RelationalProvider } from './relational';

export type DatabaseExportFormat = 'sql' | 'csv' | 'ndjson' | 'json';
export interface DatabaseExportTableTarget { schema: string; table: string; }
export interface DatabaseExportInput {
  schemas: string[];
  tables: DatabaseExportTableTarget[];
  format: DatabaseExportFormat;
  includeStructure: boolean;
  includeData: boolean;
  rowLimit: number | null;
  packaging: 'file' | 'zip';
  partMiB: number | null;
  pageSize: number;
}
export interface DatabaseExportColumn {
  name: string;
  nativeType: string;
  wireEncoding: 'native' | 'native-text' | 'binary-base64' | 'geometry-wkb';
  generated: boolean;
}
export interface DatabaseExportTableReview extends DatabaseExportTableTarget {
  key: string;
  kind: DatabaseObjectKind;
  columns: DatabaseExportColumn[];
  pagination: 'keyset' | 'offset';
  orderColumns: string[];
  ddlOrigin: 'native' | 'reconstructed';
  dataIncluded: boolean;
  structureIncluded: boolean;
  warnings: string[];
}
export interface DatabaseExportReview {
  provider: RelationalProvider;
  database: string;
  input: DatabaseExportInput;
  tables: DatabaseExportTableReview[];
  consistency: 'independent-reads' | 'repeatable-read';
  warnings: string[];
  maxBytes: number;
}
export interface DatabaseExportTableSummary extends DatabaseExportTableTarget {
  rows: number;
  limited: boolean;
  pagination: 'keyset' | 'offset';
  entries: string[];
}
export interface DatabaseExportSummary {
  provider: RelationalProvider;
  database: string;
  generatedAt: string;
  format: DatabaseExportFormat;
  consistency: DatabaseExportReview['consistency'];
  rowLimit: number | null;
  tables: DatabaseExportTableSummary[];
  rows: number;
  bytes: number;
  warnings: string[];
}
export interface DatabaseExportProgress {
  id: string;
  status: 'preparing' | 'running' | 'finalizing' | 'completed' | 'cancelled' | 'failed';
  table: DatabaseExportTableTarget | null;
  completedTables: number;
  totalTables: number | null;
  rows: number;
  bytes: number;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  review: DatabaseExportReview | null;
  summary: DatabaseExportSummary | null;
  artifact: { filename: string; mimeType: string; bytes: number; } | null;
}
export interface DatabaseExportRow { values: DatabaseCell[]; types: string[]; }
export const DATABASE_EXPORT_MAX_BYTES = 1024 * 1024 * 1024;
export const DATABASE_EXPORT_MAX_STORED_BYTES = 2 * DATABASE_EXPORT_MAX_BYTES;
export const DATABASE_EXPORT_MAX_WORKSPACE_BYTES = DATABASE_EXPORT_MAX_BYTES;
export const DATABASE_EXPORT_MAX_TABLES = 1000;
export const DEFAULT_DATABASE_EXPORT_INPUT: DatabaseExportInput = { schemas: [], tables: [], format: 'sql', includeStructure: true, includeData: true, rowLimit: null, packaging: 'zip', partMiB: 64, pageSize: 500 };
export * from './database-export-input';
export * from './database-export-values';
export { textPieces } from './database-export-text';
