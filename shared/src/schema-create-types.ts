import type { RelationalProvider } from './relational';

export interface SchemaCreateInput {
  name: string;
  charset?: string | null;
  collation?: string | null;
}

export interface SchemaCreateCharset {
  name: string;
  description: string | null;
  defaultCollation: string | null;
  collations: string[];
}

export interface SchemaCreateOptions {
  provider: RelationalProvider;
  database: string;
  supported: boolean;
  target: 'database' | 'schema' | null;
  permission: 'allowed' | 'denied' | 'unknown';
  charsets: SchemaCreateCharset[];
  warnings: string[];
}

export interface SchemaCreateReview {
  provider: 'mysql' | 'postgres';
  target: 'database' | 'schema';
  database: string;
  name: string;
  sql: string;
  warnings: string[];
}

export interface SchemaCreatePrepared {
  planId: string;
  expiresAt: number;
  review: SchemaCreateReview;
}

export interface SchemaCreateCommitResult {
  outcome: 'created' | 'rejected' | 'unknown';
  target: 'database' | 'schema';
  name: string;
  sql: string;
  executionTimeMs: number;
  message: string;
}
