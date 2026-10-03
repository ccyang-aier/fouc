/** DBX Redis blob, key and cursor semantics adapted to the Fouc boundary. */
export interface RedisConnectionConfig {
  provider: 'redis';
  host: string;
  port: number;
  username: string;
  database: number;
  tls: boolean;
}
export type RedisConnectInput = RedisConnectionConfig & { password: string };
export interface RedisSavedConnection {
  id: string;
  workspaceId: string;
  name: string;
  config: RedisConnectionConfig;
  updatedAt: number;
}
export interface RedisSession {
  provider: 'redis';
  id: string;
  workspaceId: string;
  database: number;
  version: string | null;
  mode: 'standalone';
  readOnly: true;
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
  | { kind: 'list'; items: { index: string; value: RedisBlob }[]; total: string; nextCursor: string | null }
  | { kind: 'set'; items: RedisBlob[]; total: string; nextCursor: string | null }
  | {
      kind: 'hash';
      items: { field: RedisBlob; value: RedisBlob }[];
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
}
export interface RedisCommandResult {
  command: string;
  result: unknown;
  executionTimeMs: number;
}
