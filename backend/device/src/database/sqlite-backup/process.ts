import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SqliteBackupWorkerMessage } from "./worker";

export interface SqliteSnapshotResult {
  bytes: number;
  pageSize: number;
  totalPages: number;
}

/** Killing the dedicated process actually interrupts native backup and integrity checks. */
export function createSqliteSnapshot(
  source: string,
  destination: string,
  maxBytes: number,
  signal: AbortSignal,
  onProgress: (
    progress: Extract<SqliteBackupWorkerMessage, { kind: "progress" }>,
  ) => void,
): Promise<SqliteSnapshotResult> {
  signal.throwIfAborted();
  const packaged = /fouc-backend/i.test(path.basename(process.execPath));
  const args = packaged
    ? ["--sqlite-backup"]
    : [fileURLToPath(new URL("./worker-entry.ts", import.meta.url))];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "",
      errorOutput = "",
      workerError = "",
      result: SqliteSnapshotResult | null = null;
    let spawnError: Error | null = null;
    const abort = () => {
      child.kill();
    };
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > 16_384) {
        workerError = "SQLite 备份进程返回超过内部协议范围";
        child.kill();
        return;
      }
      let newline = output.indexOf("\n");
      while (newline !== -1) {
        const line = output.slice(0, newline);
        output = output.slice(newline + 1);
        try {
          const message = JSON.parse(line) as SqliteBackupWorkerMessage;
          if (message.kind === "progress") onProgress(message);
          else if (message.kind === "ready")
            result = {
              bytes: message.bytes,
              pageSize: message.pageSize,
              totalPages: message.totalPages,
            };
          else if (message.kind === "error") workerError = message.message;
          else throw new Error("未知响应");
        } catch {
          workerError = "SQLite 备份进程未返回有效结果";
          child.kill();
        }
        newline = output.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk: string) => {
      if (errorOutput.length < 16_384) errorOutput += chunk;
    });
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) reject(signal.reason);
      else if (spawnError || code !== 0 || workerError || !result)
        reject(
          spawnError ??
            new Error(
              workerError || errorOutput.trim() || "SQLite 备份进程未正常结束",
            ),
        );
      else resolve(result);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ source, destination, maxBytes }));
    if (signal.aborted) abort();
  });
}
