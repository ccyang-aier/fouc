import type { RedisBlob } from './redis';

export const REDIS_BULK_LIMITS = {
  keys: 100,
  keyBytes: 64 * 1024,
  keyTotalBytes: 256 * 1024,
  snapshotBytes: 1024 * 1024,
  snapshotTotalBytes: 8 * 1024 * 1024,
  planMs: 5 * 60_000,
} as const;

export type RedisBulkOperation =
  | { kind: 'delete' | 'persist' }
  | { kind: 'relative-ttl' | 'absolute-ttl'; milliseconds: string };
export type RedisBulkInput = { database: number; keys: string[]; operation: RedisBulkOperation };
export type RedisBulkKeyReview = {
  key: RedisBlob;
  type: string;
  /** -1 = persistent, -2 = absent; otherwise exact Unix milliseconds. */
  expiresAt: string;
  dumpBytes: number;
  dumpSha256: string;
};
export type RedisBulkPreview = {
  planId: string;
  database: number;
  operation: RedisBulkOperation;
  keys: RedisBulkKeyReview[];
  serverTime: string;
  expiresAt: number;
  dangerous: boolean;
  notes: string[];
};
export type RedisBulkKeyState = 'applied' | 'unchanged' | 'missing' | 'conflict' | 'failed' | 'skipped' | 'unknown';
export type RedisBulkResult = {
  planId: string;
  database: number;
  state: 'complete' | 'conflict' | 'partial' | 'failed' | 'unknown';
  executionTimeMs: number;
  keys: { key: RedisBlob; state: RedisBulkKeyState; expiresAt: string | null; reason: string | null }[];
  applied: number;
  unchanged: number;
  missing: number;
  unknown: number;
};
