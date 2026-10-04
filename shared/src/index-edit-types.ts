import type { RelationalProvider } from './relational';
import type { RelationalIndex, RelationalTableStructure } from './relational-structure';

export const INDEX_EDIT_LIMITS = { keys: 16, include: 16, requestBytes: 32 * 1024, plans: 4, lifetimeMs: 5 * 60_000 } as const;
export interface IndexEditKey { column: string; direction: 'asc' | 'desc'; prefix: number | null }
export type IndexEditInput =
  | { operation: 'create'; schema: string; table: string; name: string; unique: boolean; columns: IndexEditKey[]; include: string[]; nullsNotDistinct: boolean }
  | { operation: 'drop'; schema: string; table: string; name: string };
export interface IndexEditCapabilities {
  descending: boolean;
  prefix: boolean;
  include: boolean;
  nullsNotDistinct: boolean;
}
export interface IndexEditOptions {
  provider: RelationalProvider;
  structure: RelationalTableStructure;
  capabilities: IndexEditCapabilities;
  permission: 'allowed' | 'unknown' | 'denied';
  warnings: string[];
}
export interface IndexEditReview {
  provider: RelationalProvider;
  operation: 'create' | 'drop';
  schema: string;
  table: string;
  index: string;
  sql: string;
  existing: RelationalIndex | null;
  warnings: string[];
  transaction: 'implicit-commit' | 'atomic';
}
export interface IndexEditPrepared { planId: string; expiresAt: number; review: IndexEditReview }
export interface IndexEditCommitResult {
  outcome: 'created' | 'dropped' | 'rejected' | 'unknown';
  schema: string;
  table: string;
  index: string;
  sql: string;
  message: string;
  executionTimeMs: number;
}
