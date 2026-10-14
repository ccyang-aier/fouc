import { tokenIsIdentifier, tokenizeSqlSemantic, type RelationalProvider } from '@fouc/shared';

export interface SqlErrorLocation {
  line: number;
  column: number;
}
export interface SqlErrorRange {
  from: number;
  to: number;
}

function toZeroBased(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed - 1 : null;
}

/** DBX native server message locations; absence of a location never fabricates an error span. */
export function parseSqlErrorLocation(message: string): SqlErrorLocation | null {
  const match =
    /\bline\s*:?\s*(\d+)\s*[,:\s]\s*column\s*:?\s*(\d+)\b/i.exec(message) ??
    /\bline\s+(\d+)\b[\s\S]{0,80}?\bcol(?:umn)?\s+(\d+)\b/i.exec(message);
  if (match) {
    const line = toZeroBased(match[1]),
      column = toZeroBased(match[2]);
    if (line !== null && column !== null) return { line, column };
  }
  const lines = message.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const lineMatch = /^LINE\s+(\d+):/i.exec(lines[index]);
    if (!lineMatch) continue;
    const caret = lines[index + 1]?.indexOf('^') ?? -1;
    const line = toZeroBased(lineMatch[1]);
    const prefix = lines[index].indexOf(':') + 2;
    if (line !== null && caret >= prefix) return { line, column: caret - prefix };
  }
  const line = toZeroBased(/\bline\s+(\d+)\b/i.exec(message)?.[1]);
  return line === null ? null : { line, column: 0 };
}

/** Preserve CRLF bytes and UTF-16 offsets, which both CodeMirror and the native source map use. */
export function lineColumnToOffset(sql: string, location: SqlErrorLocation): number | null {
  if (
    !Number.isSafeInteger(location.line) ||
    !Number.isSafeInteger(location.column) ||
    location.line < 0 ||
    location.column < 0
  )
    return null;
  let lineStart = 0;
  for (let line = 0; line < location.line; line++) {
    const newline = sql.indexOf('\n', lineStart);
    if (newline < 0) return null;
    lineStart = newline + 1;
  }
  const newline = sql.indexOf('\n', lineStart);
  let end = newline < 0 ? sql.length : newline;
  if (sql[end - 1] === '\r') end--;
  return Math.min(lineStart + location.column, end);
}

export function sqlErrorDecorationRange(
  sql: string,
  message: string,
  provider: RelationalProvider,
): SqlErrorRange | null {
  const location = parseSqlErrorLocation(message);
  if (!location) return null;
  const from = lineColumnToOffset(sql, location);
  if (from === null || from >= sql.length) return null;
  const token = tokenizeSqlSemantic(sql, provider).find(
    (candidate) => candidate.span.start <= from && from < candidate.span.end,
  );
  return token && tokenIsIdentifier(token)
    ? { from: token.span.start, to: token.span.end }
    : { from, to: Math.min(sql.length, from + (sql.codePointAt(from)! > 0xffff ? 2 : 1)) };
}

export function sqlErrorSqlMatchesEditor(editorSql: string, executedSql: string): boolean {
  // A statement from another document, or an earlier edit, cannot decorate this one.
  return editorSql === executedSql;
}
