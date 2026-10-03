import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { DriverResult, SqlParameter } from './drivers/relational-driver';

/** DBX isolates SQLite work; native processes also interrupt a blocked SQLite VM. */
export function readSqliteInProcess(file: string, sql: string, maxRows: number, values: SqlParameter[], signal?: AbortSignal): Promise<DriverResult> {
  signal?.throwIfAborted();
  const packaged = /fouc-backend/i.test(path.basename(process.execPath));
  const args = packaged ? ['--sqlite-query'] : [fileURLToPath(new URL('../entrypoints/sqlite-query.ts', import.meta.url))];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '', errorOutput = '', settled = false;
    const abort = () => { child.kill(); };
    const timeout = setTimeout(() => { errorOutput = 'SQLite 查询超过 30 秒，已停止'; child.kill(); }, 30000);
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { output += chunk; });
    child.stderr.on('data', (chunk: string) => { if (errorOutput.length < 16384) errorOutput += chunk; });
    child.on('error', (error) => { settled = true; cleanup(); reject(error); });
    child.on('close', (code) => {
      cleanup(); if (settled) return;
      if (signal?.aborted) { reject(signal.reason); return; }
      let response: { result?: DriverResult; error?: string };
      try { response = JSON.parse(output); }
      catch { reject(new Error(errorOutput.trim() || 'SQLite 查询进程未返回有效结果')); return; }
      if (code !== 0 || response.error || !response.result) { reject(new Error(response.error || errorOutput || 'SQLite 查询进程未正常结束')); return; }
      resolve(response.result);
    });
    child.stdin.on('error', () => {}); // Cancellation can close stdin before its bounded request is flushed.
    child.stdin.end(JSON.stringify({ file, sql, maxRows, values: values.map((value) => typeof value === 'bigint'
      ? { integer: value.toString() } : value instanceof Uint8Array ? { binary: Buffer.from(value).toString('base64') } : value) }));
    if (signal?.aborted) abort();
  });
}
