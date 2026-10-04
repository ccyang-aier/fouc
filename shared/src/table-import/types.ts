import type { DatabaseColumnInfo } from '../database';

export const TABLE_IMPORT_LIMITS = { bytes: 5 * 1024 * 1024, rows: 5000, columns: 256, cells: 100_000, previewRows: 50, issues: 100 } as const;
export type TableImportFormat = 'csv' | 'tsv' | 'delimited' | 'json' | 'ndjson' | 'sql';
export type TableImportEncoding = 'auto' | 'utf8' | 'utf16Le' | 'utf16Be' | 'gbk';
export type TableImportCell = { kind: 'text' | 'number' | 'boolean' | 'json'; value: string } | { kind: 'null' } | { kind: 'missing' };
export type TableImportInferredType = 'boolean' | 'integer' | 'decimal' | 'date' | 'timestamp' | 'json' | 'text';
export interface TableImportParseOptions {
  format: TableImportFormat;
  delimiter?: string;
  /** Logical records, one-based. Zero disables headers. Quoted newlines stay in their record. */
  titleRow?: number;
  dataStartRow?: number;
  /** Zero means through the end of the source. */
  lastDataRow?: number;
  trimValues?: boolean;
  emptyStringAsNull?: boolean;
  /** Only an unquoted delimited field with this exact spelling becomes NULL. */
  nullToken?: string;
  jsonShape?: 'auto' | 'objects' | 'arrays';
  /** Source dialect controls identifier case and string escape interpretation. */
  sqlDialect?: 'mysql' | 'postgres' | 'sqlite';
}
export interface TableImportIssue {
  message: string;
  record?: number;
  sourceColumn?: string;
  targetColumn?: string;
  /** Source coordinates are UTF-16 offsets and one-based physical line/column. */
  offset?: number;
  line?: number;
  column?: number;
}
export interface TableImportParsed {
  columns: string[];
  rows: TableImportCell[][];
  rowNumbers: number[];
  inferredTypes: TableImportInferredType[];
  totalRows: number;
  sizeBytes: number;
  errors: TableImportIssue[];
  warnings: string[];
  sourceTarget?: { schema: string | null; table: string; dialect: 'mysql' | 'postgres' | 'sqlite' };
}
export interface TableImportMapping { sourceColumn: string; targetColumn: string }
export interface TableImportInput { schema: string; table: string; text: string; options: TableImportParseOptions; mappings: TableImportMapping[] }
export interface TableImportValidation { valid: boolean; errors: TableImportIssue[]; warnings: string[]; mappedColumns: string[]; requiredColumns: string[] }
export interface TableImportReview {
  parsed: TableImportParsed;
  targetColumns: DatabaseColumnInfo[];
  mappings: TableImportMapping[];
  validation: TableImportValidation;
  /** Full count; parsed.rows and rowNumbers contain at most 50 preview rows. */
  rowsToImport: number;
  mode: 'append';
}
export interface TableImportAppendSummary { rowsImported: number; elapsedMs: number }
export interface TableImportPlan { planId: string; review: TableImportReview }
