import type { DatabaseCapabilitySnapshot, DatabaseConnectionInfo } from './database';

export type RelationalProvider = 'postgres' | 'sqlite';
export type RelationalConnectionConfig =
  | { provider: 'postgres'; host: string; port: number; username: string; database: string; ssl: boolean }
  | { provider: 'sqlite'; path: string };
export type RelationalSavedConnection = {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: number;
  config: RelationalConnectionConfig;
};
export type RelationalConnectInput =
  | {
      provider: 'postgres';
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
      ssl?: boolean;
    }
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
