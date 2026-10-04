import { DatabaseSync, backup } from "node:sqlite";
import { stat, realpath } from "node:fs/promises";
import path from "node:path";

interface WorkerInput {
  source: string;
  destination: string;
  maxBytes: number;
}
export type SqliteBackupWorkerMessage =
  | {
      kind: "progress";
      totalPages: number;
      remainingPages: number;
      pageSize: number;
    }
  | { kind: "ready"; bytes: number; pageSize: number; totalPages: number }
  | { kind: "error"; message: string };

function emit(value: SqliteBackupWorkerMessage): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/** Internal worker: SQLite's backup API reads committed WAL pages within one pinned read transaction. */
export async function runSqliteBackupWorker(): Promise<void> {
  let source: DatabaseSync | undefined;
  let snapshot: DatabaseSync | undefined;
  try {
    let raw = "";
    for await (const chunk of process.stdin) {
      raw += Buffer.from(chunk).toString("utf8");
      if (raw.length > 16_384)
        throw new Error("SQLite 备份请求超过内部协议范围");
    }
    const input = JSON.parse(raw) as WorkerInput;
    if (
      typeof input.source !== "string" ||
      typeof input.destination !== "string" ||
      !path.isAbsolute(input.source) ||
      !path.isAbsolute(input.destination) ||
      !Number.isSafeInteger(input.maxBytes) ||
      input.maxBytes <= 0
    )
      throw new Error("SQLite 备份内部请求无效");
    const canonicalSource = await realpath(input.source);
    const destinationDirectory = await realpath(
      path.dirname(input.destination),
    );
    const canonicalDestination = path.join(
      destinationDirectory,
      path.basename(input.destination),
    );
    if (canonicalSource.toLowerCase() === canonicalDestination.toLowerCase())
      throw new Error("SQLite 快照不能覆盖运行中的源数据库");
    try {
      await stat(input.destination);
      throw new Error("SQLite 快照目标已存在");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (typeof backup !== "function")
      throw new Error("当前设备运行时不支持 SQLite 原生备份 API");
    source = new DatabaseSync(canonicalSource, { readOnly: true });
    source.exec("PRAGMA query_only=ON; PRAGMA busy_timeout=5000; BEGIN");
    source.prepare("SELECT count(*) FROM sqlite_schema").get();
    const pageSize = Number(
      source.prepare("PRAGMA page_size").get()?.page_size,
    );
    const pageCount = Number(
      source.prepare("PRAGMA page_count").get()?.page_count,
    );
    if (
      !Number.isSafeInteger(pageSize) ||
      !Number.isSafeInteger(pageCount) ||
      pageSize <= 0 ||
      pageCount * pageSize > input.maxBytes
    )
      throw new Error("SQLite 完整快照超过本次设备备份字节上限");
    let emittedAt = 0;
    emit({
      kind: "progress",
      totalPages: pageCount,
      remainingPages: pageCount,
      pageSize,
    });
    const totalPages = await backup(source, input.destination, {
      rate: 128,
      progress: ({ totalPages, remainingPages }) => {
        if (totalPages * pageSize > input.maxBytes)
          throw new Error("SQLite 备份超过已确认字节范围");
        const now = Date.now();
        if (now - emittedAt >= 100 || remainingPages === 0) {
          emittedAt = now;
          emit({ kind: "progress", totalPages, remainingPages, pageSize });
        }
      },
    });
    source.exec("ROLLBACK");
    source.close();
    source = undefined;
    snapshot = new DatabaseSync(input.destination, { readOnly: false });
    // A downloadable snapshot is one standalone file, with no companion WAL dependency.
    snapshot.exec(
      "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE",
    );
    const check = snapshot.prepare("PRAGMA quick_check").all();
    if (check.length !== 1 || Object.values(check[0]!)[0] !== "ok")
      throw new Error("SQLite 快照完整性检查未通过");
    snapshot.close();
    snapshot = undefined;
    const bytes = (await stat(input.destination)).size;
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > input.maxBytes)
      throw new Error("SQLite 快照文件大小超出已确认范围");
    emit({ kind: "ready", bytes, pageSize, totalPages });
  } catch (error) {
    emit({
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    snapshot?.close();
    source?.close();
  }
}
