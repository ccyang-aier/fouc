/** DBX Redis blob, key and cursor semantics adapted to the Fouc boundary. */
import type { DatabaseConnectionOptions, DatabaseConnectionOptionsInput } from './connection-options';
import type { ConnectionDirectoryMetadata, ConnectionDirectoryStatus } from './connection-directory';
export interface RedisConnectionConfig {
  provider: 'redis';
  host: string;
  port: number;
  username: string;
  database: number;
  connectionOptions: DatabaseConnectionOptions;
}
export type RedisConnectInput = Omit<RedisConnectionConfig, 'connectionOptions'> & { password: string; connectionOptions?: DatabaseConnectionOptionsInput };
export interface RedisSavedConnection {
  id: string;
  name: string;
  config: RedisConnectionConfig;
  updatedAt: number;
  directory?: ConnectionDirectoryMetadata;
  status?: ConnectionDirectoryStatus;
}
export interface RedisSession {
  provider: 'redis';
  id: string;
  database: number;
  connectionId: string | null;
  version: string | null;
  mode: 'standalone';
  readOnly: boolean;
}
export interface RedisBlob {
  rawBase64: string;
  encoding: 'utf8' | 'binary';
  display: string;
}
export interface RedisKeyInfo {
  key: RedisBlob;
  type: string;
  ttl: number;
}
export interface RedisScanPage {
  cursor: string;
  keys: RedisKeyInfo[];
  totalKeys: string;
}
export type RedisValueData =
  | { kind: 'string'; content: RedisBlob; total: string; truncated: boolean }
  | { kind: 'json'; content: string; byteLength: number }
  | { kind: 'list'; items: { index: string; value: RedisBlob }[]; total: string; nextCursor: string | null }
  | { kind: 'set'; items: RedisBlob[]; total: string; nextCursor: string | null }
  | {
      kind: 'hash';
      items: { field: RedisBlob; value: RedisBlob; ttlMs: number | null }[];
      fieldExpiry: { available: boolean; reason: string | null };
      total: string;
      nextCursor: string | null;
    }
  | { kind: 'zset'; items: { member: RedisBlob; score: string }[]; total: string; nextCursor: string | null }
  | {
      kind: 'stream';
      items: { id: string; fields: { field: RedisBlob; value: RedisBlob }[] }[];
      total: string;
      nextCursor: string | null;
    }
  | { kind: 'none' | 'unsupported' };
export interface RedisValuePage extends RedisKeyInfo {
  data: RedisValueData;
  /** Opaque session-local snapshot, never a client-supplied value hash. */
  writeVersion: string | null;
  writeUnavailable: string | null;
}
export interface RedisCommandResult {
  command: string;
  result: unknown;
  executionTimeMs: number;
  historyWarning: string | null;
}
export interface RedisDatabaseInfo {
  database: number;
  keys: string | null;
  expires: string | null;
  averageTtlMs: string | null;
}
export interface RedisDatabaseList {
  databases: RedisDatabaseInfo[];
  configuredCount: number | null;
  nextOffset: number | null;
  warnings: string[];
}
export interface RedisHistoryEntry {
  id: string;
  database: number;
  command: string;
  executedAt: number;
  executionTimeMs: number;
  success: boolean;
  output: string;
  outputTruncated: boolean;
}
export interface RedisHistoryPage { entries: RedisHistoryEntry[]; persistent: boolean; limit: number }
export interface RedisJsonCapability { available: boolean | null; reason: string | null }
