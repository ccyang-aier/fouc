import { z } from "zod";

export const SQLITE_BACKUP_LIMITS = {
  bytes: 256 * 1024 * 1024,
  deviceBytes: 512 * 1024 * 1024,
  browserBytes: 64 * 1024 * 1024,
  jobs: 4,
  sessionJobs: 2,
  timeoutMs: 120_000,
  retentionMs: 10 * 60_000,
} as const;

/** A browser filename, never a device destination path. */
export const sqliteBackupInputSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine(
        (value) =>
          !/[<>:"/\\|?*\u0000-\u001f]/.test(value) && !/[. ]$/.test(value),
        "文件名包含无效字符",
      )
      .refine(
        (value) =>
          !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value),
        "文件名是系统保留名称",
      )
      .refine(
        (value) => /\.(?:db|sqlite|sqlite3)$/i.test(value),
        "文件名须以 .db、.sqlite 或 .sqlite3 结尾",
      ),
  })
  .strict();

export type SqliteBackupInput = z.infer<typeof sqliteBackupInputSchema>;
export type SqliteBackupStatus =
  | "running"
  | "cancelling"
  | "cancelled"
  | "ready"
  | "failed";
export interface SqliteBackupScope {
  sessionId: string;
}
export interface SqliteBackupJob {
  id: string;
  revision: number;
  status: SqliteBackupStatus;
  filename: string;
  source: string;
  startedAt: number;
  finishedAt: number | null;
  expiresAt: number;
  totalPages: number | null;
  remainingPages: number | null;
  pageSize: number | null;
  bytes: number | null;
  integrity: "verified" | null;
  error: string | null;
}
