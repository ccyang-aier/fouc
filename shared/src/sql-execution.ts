import type { DatabaseQueryResult } from './database';
import type { RelationalProvider } from './relational';
import { tokenizeSqlSemantic } from './sql-semantic-tokens';

export type SqlExecutionMode = 'current' | 'all';
export type SqlExecutionStatus = 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
export type SqlStatementStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped';
export interface SqlStatementRange { from: number; to: number; sql: string }
export interface SqlExecutionError { message: string; code: string | null; position: number | null; detail: string | null; hint: string | null }
export interface SqlStatementExecution extends SqlStatementRange {
  status: SqlStatementStatus;
  result: DatabaseQueryResult | null;
  error: SqlExecutionError | null;
  startedAt: number | null;
  finishedAt: number | null;
}
export interface SqlExecutionSnapshot {
  id: string;
  status: SqlExecutionStatus;
  database: string;
  schema: string | null;
  statements: SqlStatementExecution[];
  currentIndex: number | null;
  completedCount: number;
  startedAt: number;
  finishedAt: number | null;
  revision: number;
}
export interface SqlExecutionPoll { revision: number; execution: SqlExecutionSnapshot | null }
export function sqlExecutionActive(value: Pick<SqlExecutionSnapshot, 'status'>): boolean {
  return value.status === 'running' || value.status === 'cancelling';
}

/** DBX statement ranges adapted to the three native dialects and UTF-16 offsets. */
export function splitSqlExecutionRanges(sql: string, provider: RelationalProvider): SqlStatementRange[] {
  const tokens = tokenizeSqlSemantic(sql, provider);
  const result: SqlStatementRange[] = [];
  let start = 0;
  let substantive = false;
  const append = (end: number) => {
    if (!substantive) return;
    let from = start, to = end;
    while (from < to && /\s/.test(sql[from])) from++;
    while (to > from && /\s/.test(sql[to - 1])) to--;
    result.push({ from, to, sql: sql.slice(from, to) });
  };
  for (const token of tokens) {
    if (token.kind === 'punctuation' && token.text === ';' && token.depth === 0) {
      append(token.span.start); start = token.span.end; substantive = false;
    } else if (token.kind !== 'comment' || provider === 'mysql' && /^\/\*[!]|^\/\*M!/i.test(token.text)) substantive = true;
  }
  append(sql.length);
  return result;
}

/** Delimiter/end-of-line belongs to the preceding statement; blank gaps do not. */
export function sqlExecutionRangeAtCursor(sql: string, cursor: number, provider: RelationalProvider): SqlStatementRange | null {
  const position = Math.max(0, Math.min(sql.length, cursor));
  const ranges = splitSqlExecutionRanges(sql, provider);
  for (let index = 0; index < ranges.length; index++) {
    const range = ranges[index];
    if (position >= range.from && position <= range.to) return range;
    const next = ranges[index + 1];
    if (position > range.to && (!next || position < next.from) && !/[\r\n]/.test(sql.slice(range.to, position))) return range;
    const lineStart = Math.max(sql.lastIndexOf('\n', position - 1), sql.lastIndexOf('\r', position - 1)) + 1;
    if (position < range.from && range.from >= lineStart && !/[\r\n]/.test(sql.slice(position, range.from))) return range;
  }
  return null;
}

/** A nonempty selection always takes precedence, including a multi-statement selection. */
export function resolveSqlExecutionTarget(sql: string, provider: RelationalProvider, mode: SqlExecutionMode,
  selection: { from: number; to: number; head: number }): SqlStatementRange | null {
  if (selection.to > selection.from && sql.slice(selection.from, selection.to).trim()) {
    return { from: selection.from, to: selection.to, sql: sql.slice(selection.from, selection.to) };
  }
  if (mode === 'current') return sqlExecutionRangeAtCursor(sql, selection.head, provider);
  return splitSqlExecutionRanges(sql, provider).length ? { from: 0, to: sql.length, sql } : null;
}
