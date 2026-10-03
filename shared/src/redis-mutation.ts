import type { RedisBlob } from './redis';

/** All byte arguments use canonical Base64; indexes and stream IDs stay strings. */
export type RedisMutation =
  | { kind: 'create'; key: string; type: 'string'; value: string }
  | { kind: 'create'; key: string; type: 'list' | 'set'; value: string }
  | { kind: 'create'; key: string; type: 'hash'; field: string; value: string }
  | { kind: 'create'; key: string; type: 'zset'; member: string; score: string }
  | { kind: 'create'; key: string; type: 'stream'; entryId: string; fields: RedisStreamField[] }
  | { kind: 'delete'; key: string }
  | { kind: 'rename'; key: string; destination: string }
  | { kind: 'expiry'; key: string; mode: 'persist' }
  | { kind: 'expiry'; key: string; mode: 'relative' | 'absolute'; milliseconds: string }
  | { kind: 'string-set'; key: string; value: string }
  | { kind: 'list-push'; key: string; side: 'left' | 'right'; value: string }
  | { kind: 'list-set'; key: string; index: string; value: string }
  | { kind: 'list-remove'; key: string; index: string }
  | { kind: 'set-add' | 'set-remove'; key: string; member: string }
  | { kind: 'hash-add'; key: string; field: string; value: string }
  | { kind: 'hash-set'; key: string; field: string; destination: string; value: string }
  | { kind: 'hash-remove'; key: string; field: string }
  | { kind: 'zset-add'; key: string; member: string; score: string }
  | { kind: 'zset-set'; key: string; member: string; destination: string; score: string }
  | { kind: 'zset-remove'; key: string; member: string }
  | { kind: 'stream-add'; key: string; entryId: string; fields: RedisStreamField[] }
  | { kind: 'stream-remove'; key: string; entryId: string };

export interface RedisStreamField { field: string; value: string }
export interface RedisMutationPreview {
  id: string;
  expiresAt: number;
  kind: RedisMutation['kind'];
  key: RedisBlob;
  commands: { command: string; arguments: RedisBlob[] }[];
  notes: string[];
}
export interface RedisMutationResult {
  key: RedisBlob;
  deleted: boolean;
  result: string | number;
  executionTimeMs: number;
}
