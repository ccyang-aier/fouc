import type { RelationalProvider } from './relational';

export const TABLE_CREATE_LIMITS = { columns: 64, requestBytes: 128 * 1024, defaultCharacters: 8192, plans: 4, lifetimeMs: 5 * 60_000 } as const;
export type TableCreateDefault = { kind: 'none' } | { kind: 'null' } | { kind: 'literal'; value: string } | { kind: 'function'; value: string };
export type TableCreateIdentity = 'none' | 'auto' | 'by-default' | 'always';
export interface TableCreateColumn {
  id: string;
  name: string;
  type: string;
  length: number | null;
  precision: number | null;
  scale: number | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  identity: TableCreateIdentity;
  default: TableCreateDefault;
}
export interface TableCreateInput { schema: string; table: string; columns: TableCreateColumn[] }
export interface TableCreateType {
  name: string;
  family: 'integer' | 'decimal' | 'float' | 'boolean' | 'text' | 'binary' | 'date' | 'time' | 'datetime' | 'json' | 'uuid';
  parameter: 'none' | 'length' | 'decimal';
  /** Parameter maxima are provider-specific; the server performs the same validation. */
  maximumLength?: number;
}
export interface TableCreateOptions {
  provider: RelationalProvider;
  database: string;
  schemas: string[];
  types: readonly TableCreateType[];
  warnings: string[];
}
export interface TableCreateReview {
  provider: RelationalProvider;
  schema: string;
  table: string;
  sql: string;
  columns: TableCreateColumn[];
  warnings: string[];
  transaction: 'implicit-commit' | 'atomic';
}
export interface TableCreatePrepared { planId: string; expiresAt: number; review: TableCreateReview }
export interface TableCreateCommitResult {
  outcome: 'created' | 'rejected' | 'unknown';
  schema: string;
  table: string;
  sql: string;
  message: string;
  executionTimeMs: number;
}
