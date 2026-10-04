import type { DatabaseCell, SqlExecutionSnapshot } from '@fouc/shared';
import { DatastoreCliError } from '../datastore-cli/types';

type Capture = { id: string; connectionId: string; capturedAt: number; expiresAt: number; bytes: number; execution: SqlExecutionSnapshot };
export interface ResultWindow { statement: number; rowOffset: number; rowLimit: number; cellOffset: number; cellLimit: number }
const MAX_BYTES = 8 * 1024 * 1024;
const LIFETIME = 2 * 60_000;

function cellWindow(value: DatabaseCell, offset: number, limit: number): unknown {
  if (typeof value !== 'string' || value.length <= limit && offset === 0) return value;
  // Explicit wrappers preserve the difference between a real object cell and a string excerpt.
  let from = Math.min(offset, value.length);
  let to = Math.min(value.length, from + limit);
  if (from > 0 && /[\uDC00-\uDFFF]/.test(value[from]) && /[\uD800-\uDBFF]/.test(value[from - 1])) from--;
  if (to < value.length && /[\uDC00-\uDFFF]/.test(value[to]) && /[\uD800-\uDBFF]/.test(value[to - 1])) to--;
  return { kind: 'string-window', text: value.slice(from, to), utf16Offset: from, totalUtf16Units: value.length, nextOffset: to < value.length ? to : null };
}

/** Captures are immutable query acknowledgements, never an automatically rerun query. */
export class DatastoreMcpResults {
  private readonly captures = new Map<string, Capture>();
  private bytes = 0;
  private prune(): void {
    for (const [id, capture] of this.captures) if (capture.expiresAt <= Date.now()) { this.captures.delete(id); this.bytes -= capture.bytes; }
  }
  capture(connectionId: string, execution: SqlExecutionSnapshot): string | null {
    this.prune();
    const bytes = Buffer.byteLength(JSON.stringify(execution));
    if (bytes > MAX_BYTES) return null;
    while (this.captures.size >= 16 || this.bytes + bytes > MAX_BYTES) {
      const oldest = this.captures.values().next().value;
      if (!oldest) break;
      this.captures.delete(oldest.id); this.bytes -= oldest.bytes;
    }
    const id = crypto.randomUUID();
    const capturedAt = Date.now();
    this.captures.set(id, { id, connectionId, capturedAt, expiresAt: capturedAt + LIFETIME, bytes, execution: structuredClone(execution) });
    this.bytes += bytes;
    return id;
  }
  read(connectionId: string, id: string, window: ResultWindow) {
    this.prune();
    const capture = this.captures.get(id);
    if (!capture || capture.connectionId !== connectionId) throw new DatastoreCliError('Result capture expired or belongs to another connection', 3, 'result_unavailable');
    return { captureId: capture.id, capturedAt: capture.capturedAt, expiresAt: capture.expiresAt, ...this.window(capture.execution, window) };
  }
  window(execution: SqlExecutionSnapshot, window: ResultWindow) {
    const statement = execution.statements[window.statement];
    if (!statement) throw new DatastoreCliError('Statement index is outside this captured execution', 2, 'invalid_result_window');
    const result = statement.result;
    if (!result) return { executionId: execution.id, status: execution.status, statement: window.statement, statementStatus: statement.status, error: statement.error, result: null };
    if (result.columns.length > 1000) throw new DatastoreCliError('Query has more than 1000 columns; narrow its projection', 2, 'result_too_wide');
    const rowLimit = Math.min(window.rowLimit, Math.max(1, Math.floor(1000 / Math.max(1, result.columns.length))));
    const rows = result.rows.slice(window.rowOffset, window.rowOffset + rowLimit).map(row => row.map(value => cellWindow(value, window.cellOffset, window.cellLimit)));
    const nextRowOffset = window.rowOffset + rows.length < result.rows.length ? window.rowOffset + rows.length : null;
    return { executionId: execution.id, status: execution.status, statement: window.statement, statementCount: execution.statements.length, statementStatus: statement.status, columns: result.columns, columnTypes: result.columnTypes, rows, rowOffset: window.rowOffset, returnedRows: rows.length, capturedRows: result.rows.length, nextRowOffset, nativeTruncated: result.truncated, affectedRows: result.affectedRows, executionTimeMs: result.executionTimeMs, messages: result.messages };
  }
  clearConnection(connectionId: string): void {
    for (const [id, capture] of this.captures) if (capture.connectionId === connectionId) { this.captures.delete(id); this.bytes -= capture.bytes; }
  }
  clear(): void { this.captures.clear(); this.bytes = 0; }
}
