import type { DatabaseObjectKind, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import type { DatabaseExportReview, DatabaseExportTableReview } from '@fouc/shared/database-export';
import type { DriverResult, SqlParameter } from './drivers/relational-driver';

export interface NativeDatabaseExportAdapter {
  provider: RelationalProvider;
  database: string;
  /** Must describe the real adapter transaction scope, never a requested promise. */
  consistency: 'independent-reads' | 'repeatable-read';
  listTables(schema: string, signal?: AbortSignal): Promise<Array<{ schema: string; name: string; kind: DatabaseObjectKind; }>>;
  structure(schema: string, table: string, signal?: AbortSignal): Promise<RelationalTableStructure>;
  /** Receives only built-in SELECTs compiled here from validated native metadata. */
  read(sql: string, schema: string | null, maxRows: number, values: SqlParameter[], signal?: AbortSignal): Promise<DriverResult>;
}
export interface PreparedDatabaseExport {
  review: DatabaseExportReview;
  tables: Array<{ review: DatabaseExportTableReview; structure: RelationalTableStructure; }>;
}
export interface DatabaseExportScope { sessionId: string; }
export interface DatabaseExportArtifact { path: string; filename: string; mimeType: string; bytes: number; }
