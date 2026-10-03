import type { RedisBlob } from './redis';

export interface RedisInfoSection {
  name: string;
  entries: { key: string; value: string }[];
}
export interface RedisInfoSnapshot {
  sections: RedisInfoSection[];
  fetchedAt: number;
  executionTimeMs: number;
}
export interface RedisSlowlogEntry {
  id: string;
  timestampSeconds: string;
  durationMicros: string;
  arguments: RedisBlob[];
  clientAddress: RedisBlob | null;
  clientName: RedisBlob | null;
  /** Newer Redis versions report the original count before server truncation. */
  originalArgumentCount: string | null;
}
export interface RedisSlowlogPage {
  entries: RedisSlowlogEntry[];
  requestedCount: number;
  returnedByServer: number;
  omittedEntries: number;
  totalEntries: string | null;
  thresholdMicros: string | null;
  maxEntries: string | null;
  warnings: string[];
  fetchedAt: number;
  executionTimeMs: number;
}
