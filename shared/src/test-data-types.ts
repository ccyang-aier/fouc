import type { TableImportInput, TableImportParsed } from './table-import';

export const TEST_DATA_LIMITS = {
  rows: 5000,
  bytes: 5 * 1024 * 1024,
  cells: 100_000,
  sampleRows: 20,
  attempts: 100,
} as const;

export type TestDataGenerator =
  | { kind: 'constant'; value: string }
  | { kind: 'sequence'; start: string; step: string }
  | { kind: 'integer'; min: string; max: string }
  | { kind: 'decimal'; min: string; max: string; scale: number }
  | { kind: 'date'; start: string; end: string }
  | { kind: 'datetime'; start: string; end: string }
  | { kind: 'time'; start: string; end: string }
  | { kind: 'uuid' }
  | { kind: 'name' }
  | { kind: 'email'; domain: string }
  | { kind: 'text'; length: number }
  | { kind: 'enum'; values: string[] };

export interface TestDataColumnConfig {
  column: string;
  enabled: boolean;
  /** Also applied to nullable fields; native single-column uniqueness cannot be disabled. */
  unique: boolean;
  nullPercent: number;
  generator: TestDataGenerator;
}

export interface TestDataConfig {
  seed: string;
  rowCount: number;
  columns: TestDataColumnConfig[];
}

export interface TestDataIssue {
  column?: string;
  message: string;
}

export interface TestDataValidation {
  valid: boolean;
  errors: TestDataIssue[];
  warnings: string[];
}

export interface TestDataPreview {
  parsed: TableImportParsed;
  warnings: string[];
  sampleRows: number;
  targetRows: number;
}

export interface TestDataImport {
  input: TableImportInput;
  warnings: string[];
  rows: number;
  bytes: number;
}

export interface TestDataControl {
  signal?: AbortSignal;
  onProgress?: (rows: number, total: number) => void;
}
