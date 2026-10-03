import type { RelationalProvider } from './relational';

export const SQL_HISTORY_LIMIT = 1000;
export const SQL_FILE_MAX_BYTES = 64 * 1024 * 1024;
export interface SqlHistoryTarget {
  connectionId: string;
  connectionName: string;
  provider: RelationalProvider;
  database: string;
  schema: string | null;
}
export interface SqlHistoryEntry extends SqlHistoryTarget {
  id: string;
  sql: string;
  executedAt: number;
  executionTimeMs: number;
  success: boolean;
  error: string | null;
  rowCount: number;
  truncated: boolean;
}
export interface SqlHistorySearch {
  search: string;
  connectionIds: string[];
  databases: { connectionId: string; database: string }[];
  schema: string | null;
  success: boolean | null;
  startedAt: number | null;
  endedAt: number | null;
  cursor: { executedAt: number; id: string } | null;
  limit: number;
}
export type SqlHistorySummary = Omit<SqlHistoryEntry, 'sql' | 'error'> & { sqlPreview: string; sqlBytes: number; error: string | null };
export interface SqlHistoryPage { entries: SqlHistorySummary[]; total: number; nextCursor: SqlHistorySearch['cursor']; persistent: boolean; limit: number }
export interface SavedSqlFolder {
  id: string; connectionId: string; parentFolderId: string | null; name: string; orderIndex: number; createdAt: number; updatedAt: number;
}
export interface SavedSqlFile {
  id: string; connectionId: string; folderId: string | null; name: string; database: string; schema: string | null;
  orderIndex: number; openCount: number; openedAt: number | null; createdAt: number; updatedAt: number; version: string; sqlBytes: number;
}
export interface SavedSqlDocument extends SavedSqlFile { sql: string }
export interface SavedSqlLibrary { folders: SavedSqlFolder[]; files: SavedSqlFile[] }

/** DBX file name normalization and recent/frequent ranking, independent of UI. */
export function sqlFileName(name: string): string { const trimmed = name.trim(); return /\.sql$/i.test(trimmed) ? trimmed : `${trimmed}.sql`; }
export function sqlFolderPath(folders: readonly SavedSqlFolder[], id: string): string {
  const parts: string[] = [], visited = new Set<string>(); let current = folders.find((folder) => folder.id === id);
  while (current && !visited.has(current.id)) { visited.add(current.id); parts.unshift(current.name); current = folders.find((folder) => folder.id === current!.parentFolderId); }
  return parts.join(' / ');
}
export function savedSqlScore(file: SavedSqlFile, now = Date.now()): number {
  const window = 30 * 24 * 60 * 60 * 1000;
  const age = file.openedAt === null ? window : Math.max(0, now - file.openedAt);
  return Math.max(0, file.openCount) * 1000 + (file.openedAt === null ? 0 : Math.max(0, 1 - age / window) * 999);
}
