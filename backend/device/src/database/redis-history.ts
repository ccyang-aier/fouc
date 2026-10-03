import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { RedisHistoryEntry } from '@fouc/shared';

export const REDIS_HISTORY_LIMIT = 100;
const OUTPUT_BYTES = 16384;
export function redisHistoryEntry(database: number, command: string, start: number, success: boolean, output: unknown): RedisHistoryEntry {
  const text = typeof output === 'string' ? output : JSON.stringify(output) ?? 'null';
  const bytes = Buffer.from(text);
  return {
    id: crypto.randomUUID(), database, command, executedAt: start,
    executionTimeMs: Math.round(Date.now() - start), success,
    output: bytes.subarray(0, OUTPUT_BYTES).toString('utf8'), outputTruncated: bytes.length > OUTPUT_BYTES,
  };
}
/** Only allowlisted, actually attempted commands reach this workspace-local store. */
export class RedisHistoryRepository {
  constructor(private readonly directory: string) {}
  private file(workspaceId: string, connectionId: string): string {
    return path.join(this.directory, createHash('sha256').update(JSON.stringify([workspaceId, connectionId])).digest('hex') + '.json');
  }
  list(workspaceId: string, connectionId: string): RedisHistoryEntry[] {
    const file = this.file(workspaceId, connectionId);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  }
  append(workspaceId: string, connectionId: string, entry: RedisHistoryEntry): void {
    const entries = [...this.list(workspaceId, connectionId), entry].slice(-REDIS_HISTORY_LIMIT);
    const file = this.file(workspaceId, connectionId);
    mkdirSync(this.directory, { recursive: true });
    const temporary = file + '.tmp';
    writeFileSync(temporary, JSON.stringify(entries), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, file);
  }
  clear(workspaceId: string, connectionId: string): void {
    const file = this.file(workspaceId, connectionId);
    if (existsSync(file)) unlinkSync(file);
  }
}
