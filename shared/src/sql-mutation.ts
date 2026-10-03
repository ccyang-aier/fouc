import { z } from 'zod';
import type { DatabaseCell, DatabaseColumnInfo } from './database';
import type { RelationalProvider } from './relational';

export const sqlMutationInputSchema = z.object({
  schema: z.string().min(1).max(255).refine((value) => !value.includes('\0')),
  sql: z.string().min(1).max(65536),
  maxRows: z.number().int().min(1).max(500).default(200),
}).strict();

export type SqlMutationInput = z.input<typeof sqlMutationInputSchema>;
export type SqlMutationOperation = 'insert' | 'update' | 'delete';
export type SqlMutationCell =
  | { state: 'value'; value: DatabaseCell }
  | { state: 'database'; reason: string };

export interface SqlMutationRowPreview {
  before: DatabaseCell[] | null;
  after: SqlMutationCell[] | null;
}

export interface SqlMutationReview {
  provider: RelationalProvider;
  schema: string;
  table: string;
  operation: SqlMutationOperation;
  originalSql: string;
  writeSql: string;
  previewSql: string;
  countSql: string;
  columns: DatabaseColumnInfo[];
  matchedRows: number;
  changedRows: number | null;
  rows: SqlMutationRowPreview[];
  sampleLimit: number;
  executable: boolean;
  issues: string[];
  limitations: string[];
}

export interface SqlMutationPrepared {
  planId: string | null;
  expiresAt: number | null;
  review: SqlMutationReview;
}

export interface SqlMutationCommitResult {
  outcome: 'committed' | 'conflict' | 'cancelled' | 'rolled-back' | 'unknown';
  affectedRows: number | null;
  matchedRows: number;
  executionTimeMs: number;
  error: string | null;
}
