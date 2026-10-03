import type { DatabaseCapabilitySnapshot, DatabaseCell, DatabaseConnectionInfo } from './database';

export type RelationalProvider = 'postgres' | 'mysql' | 'sqlite';
type NetworkConfig = { host: string; port: number; username: string; database: string; ssl: boolean };
export type RelationalConnectionConfig =
  | ({ provider: 'postgres' } & NetworkConfig)
  | ({ provider: 'mysql' } & NetworkConfig)
  | { provider: 'sqlite'; path: string };
export type RelationalSavedConnection = {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: number;
  config: RelationalConnectionConfig;
};
type NetworkInput = Omit<NetworkConfig, 'ssl'> & { password: string; ssl?: boolean };
export type RelationalConnectInput =
  | ({ provider: 'postgres' } & NetworkInput)
  | ({ provider: 'mysql' } & NetworkInput)
  | { provider: 'sqlite'; path: string };

export interface RelationalSession {
  id: string;
  workspaceId: string;
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

/** A workspace/session-bound, single-use server plan; contains no credentials. */
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
