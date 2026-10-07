import type {
  DatabaseCapabilitySnapshot,
  DatabaseCell,
  DatabaseConnectionInfo,
  DatabaseTablePage,
} from './database';
import type { DatabaseConnectionOptions, DatabaseConnectionOptionsInput } from './connection-options';
import type { ConnectionDirectoryMetadata, ConnectionDirectoryStatus } from './connection-directory';

export type RelationalProvider = 'postgres' | 'mysql' | 'sqlite';
type NetworkConfig = { host: string; port: number; username: string; database: string; connectionOptions: DatabaseConnectionOptions };
export type RelationalConnectionConfig =
  | ({ provider: 'postgres' } & NetworkConfig)
  | ({ provider: 'mysql' } & NetworkConfig)
  | { provider: 'sqlite'; path: string };
export type RelationalSavedConnection = {
  id: string;
  name: string;
  updatedAt: number;
  config: RelationalConnectionConfig;
  directory?: ConnectionDirectoryMetadata;
  status?: ConnectionDirectoryStatus;
};
type NetworkInput = Omit<NetworkConfig, 'connectionOptions'> & { password: string; connectionOptions?: DatabaseConnectionOptionsInput };
export type RelationalConnectInput =
  | ({ provider: 'postgres' } & NetworkInput)
  | ({ provider: 'mysql' } & NetworkInput)
  | { provider: 'sqlite'; path: string };

export interface RelationalSession {
  id: string;
  connectionId: string | null;
  provider: RelationalProvider;
  database: string;
  info: DatabaseConnectionInfo;
  capabilities: DatabaseCapabilitySnapshot;
}

export interface RelationalQueryInput {
  sql: string;
  schema: string | null;
  maxRows?: number;
}

export type RelationalRowChange =
  | { kind: 'insert'; values: Record<string, DatabaseCell> }
  | { kind: 'update'; original: DatabaseCell[]; values: Record<string, DatabaseCell> }
  | { kind: 'delete'; original: DatabaseCell[] };

export interface RelationalSaveInput {
  schema: string;
  table: string;
  changes: RelationalRowChange[];
}

/** A session-bound, single-use server plan; contains no credentials. */
export interface RelationalSavePreview {
  id: string;
  schema: string;
  table: string;
  expiresAt: number;
  statements: { kind: RelationalRowChange['kind']; sql: string; parameters: DatabaseCell[] }[];
}

export interface RelationalSaveResult {
  affectedRows: number;
  executionTimeMs: number;
}

export const RELATIONAL_FILTER_OPERATORS = [
  'equals',
  'not-equals',
  'is-null',
  'is-not-null',
  'is-blank',
  'is-not-blank',
  'like',
  'not-like',
  'begins-with',
  'ends-with',
  'less-than',
  'less-than-or-equal',
  'greater-than',
  'greater-than-or-equal',
  'in',
  'not-in',
  'between',
  'not-between',
] as const;
export type RelationalFilterOperator = (typeof RELATIONAL_FILTER_OPERATORS)[number];
export type RelationalFilter =
  | {
      kind: 'condition';
      column: string;
      operator: RelationalFilterOperator;
      value?: DatabaseCell;
      values?: DatabaseCell[];
      endValue?: DatabaseCell;
    }
  | { kind: 'group'; join: 'and' | 'or'; children: RelationalFilter[] };
export type RelationalSort = { column: string; direction: 'asc' | 'desc'; nulls: 'first' | 'last' };
export interface RelationalTableQuery {
  filter: RelationalFilter | null;
  sort: RelationalSort[];
}
export interface RelationalTablePage extends DatabaseTablePage {
  query: RelationalTableQuery;
  statement: { sql: string; parameters: DatabaseCell[] };
  stableOrder: boolean;
}
export type RelationalTableQueryPreview = Pick<RelationalTablePage, 'statement' | 'query' | 'stableOrder'>;
