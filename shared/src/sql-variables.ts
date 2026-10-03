// Adapted from DBX sqlVariables.ts (Apache-2.0); expansion preserves editor coordinates.
import type { RelationalProvider as DatabaseType } from './relational';
import { editMappedSql, sourceSql, type MappedSql, type SqlSourceEdit } from './sql-source-map';

const VARIABLE_NAME_START_RE = /[\p{L}_]/u;
const VARIABLE_NAME_CHAR_RE = /[\p{L}\p{N}_]/u;
export interface SqlVariableExpansionOptions {
  declarationSql?: string;
  databaseType?: DatabaseType;
}

interface DeclarationSpan {
  name: string;
  value: string;
  start: number;
  end: number;
}
/** Only declaration text is captured for history; surrounding queries are never executed as context. */
export function sqlVariableContext(sql: string, databaseType: DatabaseType): string {
  return collectDeclarations(sql, databaseType).map((item) => `@set ${item.name} = ${item.value};`).join('\n');
}
export function stripSqlVariableDeclarations(sql: string, databaseType: DatabaseType): string {
  return editMappedSql(sourceSql(sql), collectDeclarations(sql, databaseType).map((item) => ({ from: item.start, to: item.end, text: '' }))).sql;
}

/**
 * Expand `@set name = value;` declarations within a SQL script.
 *
 * Returns the SQL with declarations removed and matching `${name}`/`@name`
 * references replaced by their declared values. `declarationSql` can provide
 * the document prefix for a separately executed statement.
 */
export function expandSqlVariables(source: MappedSql | string, options: SqlVariableExpansionOptions = {}): MappedSql {
  const mapped = typeof source === "string" ? sourceSql(source) : source;
  const sql = mapped.sql;
  const declarationSql = options.declarationSql ?? sql;
  const declarations = collectDeclarations(declarationSql, options.databaseType);
  if (!declarations.length) return mapped;

  const values = new Map<string, string>();
  for (const declaration of declarations) {
    values.set(declaration.name.toLowerCase(), declaration.value);
  }

  // Only spans inside the execution target are removed. Declarations supplied
  // by the surrounding document are context and must not affect target offsets.
  const targetDeclarations = declarationSql === sql ? declarations : collectDeclarations(sql, options.databaseType);
  const result = editMappedSql(mapped, targetDeclarations.map((declaration) => ({ from: declaration.start, to: declaration.end, text: "" })));
  return editMappedSql(result, replaceReferences(result.sql, values, options.databaseType));
}

function collectDeclarations(sql: string, databaseType?: DatabaseType): DeclarationSpan[] {
  const declarations: DeclarationSpan[] = [];
  let i = 0;
  let dollarQuoteEnd = "";
  let statementStart = true;

  while (i < sql.length) {
    if (dollarQuoteEnd) {
      const end = sql.indexOf(dollarQuoteEnd, i);
      if (end === -1) break;
      i = end + dollarQuoteEnd.length;
      dollarQuoteEnd = "";
      continue;
    }

    const ch = sql[i];
    const next = sql[i + 1];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      statementStart = false;
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      statementStart = false;
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (databaseType === 'mysql' && ch === '#' && next !== '{') { i = skipLine(sql, i + 1); continue; }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        statementStart = false;
        dollarQuoteEnd = marker;
        i += marker.length;
        continue;
      }
    }
    if (ch === "@" && statementStart && matchesWord(sql, i + 1, "set")) {
      const declaration = readDeclaration(sql, i, databaseType);
      if (declaration) {
        declarations.push(declaration);
        i = declaration.end;
        statementStart = true;
        continue;
      }
    }
    if (ch === ";") {
      statementStart = true;
      i += 1;
      continue;
    }
    statementStart = false;
    i += 1;
  }

  return declarations;
}

// Parse `@set name = value` starting at `start` (the `@`). The value runs until
// the terminating `;` or end of input, honouring nested quotes, comments and
// parentheses so that `IN (...)` lists and quoted strings survive intact.
function readDeclaration(sql: string, start: number, databaseType?: DatabaseType): DeclarationSpan | null {
  let i = start + 1 + "set".length;
  i = skipInlineWhitespace(sql, i);

  const name = readVariableName(sql, i);
  if (!name) return null;
  i += name.length;

  i = skipInlineWhitespace(sql, i);
  if (sql[i] !== "=") return null;
  i += 1;
  i = skipInlineWhitespace(sql, i);

  const valueStart = i;
  const valueEnd = readValueEnd(sql, i, databaseType);
  const value = sql.slice(valueStart, valueEnd).trim();
  if (!value) return null;

  // Consume the terminating semicolon so the declaration disappears cleanly.
  let end = valueEnd;
  if (sql[end] === ";") end += 1;

  return { name, value, start, end };
}

function readValueEnd(sql: string, start: number, databaseType?: DatabaseType): number {
  let i = start;
  let depth = 0;
  let bracketDepth = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      if (databaseType === "postgres") {
        bracketDepth += 1;
        i += 1;
        continue;
      }
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (databaseType === "postgres" && ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    if (ch === "-" && next === "-") return i;
    if (databaseType === 'mysql' && ch === '#' && next !== '{') return i;
    if (ch === "/" && next === "*") return i;
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        const end = sql.indexOf(marker, i + marker.length);
        i = end === -1 ? sql.length : end + marker.length;
        continue;
      }
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if ((ch === ";" || ch === "\n") && depth === 0 && bracketDepth === 0) return i;
    i += 1;
  }
  return sql.length;
}

function replaceReferences(sql: string, values: Map<string, string>, databaseType?: DatabaseType): SqlSourceEdit[] {
  const edits: SqlSourceEdit[] = [];
  let i = 0;
  let dollarQuoteEnd = "";

  while (i < sql.length) {
    if (dollarQuoteEnd) {
      const end = sql.indexOf(dollarQuoteEnd, i);
      const stop = end === -1 ? sql.length : end + dollarQuoteEnd.length;
      i = stop;
      dollarQuoteEnd = "";
      continue;
    }

    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" || ch === '"' || ch === "`") {
      const end = skipQuoted(sql, i, ch, databaseType);
      i = end;
      continue;
    }
    if (ch === "[") {
      const end = skipBracketIdentifier(sql, i, databaseType);
      i = end;
      continue;
    }
    if (ch === "-" && next === "-") {
      const end = skipLine(sql, i + 2);
      i = end;
      continue;
    }
    if (databaseType === 'mysql' && ch === '#' && next !== '{') { i = skipLine(sql, i + 1); continue; }
    if (ch === "/" && next === "*") {
      const end = skipBlockComment(sql, i + 2, databaseType);
      i = end;
      continue;
    }
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        i += marker.length;
        dollarQuoteEnd = marker;
        continue;
      }
      if (next === "{") {
        const name = readVariableName(sql, i + 2);
        const end = i + 2 + name.length;
        if (name && sql[end] === "}") {
          const value = values.get(name.toLowerCase());
          if (value !== undefined) {
            edits.push({ from: i, to: end + 1, text: value });
            i = end + 1;
            continue;
          }
        }
      }
    }
    if (ch === "@" && next !== "@" && sql[i - 1] !== "@") {
      const name = readVariableName(sql, i + 1);
      if (name) {
        const value = values.get(name.toLowerCase());
        if (value !== undefined) {
          edits.push({ from: i, to: i + 1 + name.length, text: value });
          i += 1 + name.length;
          continue;
        }
      }
    }
    i += 1;
  }

  return edits;
}

function matchesWord(sql: string, start: number, word: string): boolean {
  const value = sql.slice(start, start + word.length);
  if (value.toLowerCase() !== word) return false;
  return !VARIABLE_NAME_CHAR_RE.test(sql[start + word.length] ?? "");
}

function readVariableName(sql: string, start: number): string {
  if (!VARIABLE_NAME_START_RE.test(sql[start] ?? "")) return "";
  let i = start + 1;
  while (i < sql.length && VARIABLE_NAME_CHAR_RE.test(sql[i])) i += 1;
  return sql.slice(start, i);
}

function skipInlineWhitespace(sql: string, start: number): number {
  let i = start;
  while (i < sql.length && (sql[i] === " " || sql[i] === "\t" || sql[i] === "\r")) i += 1;
  return i;
}

function skipQuoted(sql: string, start: number, quote: string, databaseType?: DatabaseType): number {
  let i = start + 1;
  const escaped = databaseType === 'mysql' && (quote === "'" || quote === '"') || quote === "'" && /(?:^|[^\p{L}\p{N}_])E$/iu.test(sql.slice(0, start));
  while (i < sql.length) {
    if (sql[i] === "\\" && escaped && i + 1 < sql.length) {
      i += 2;
      continue;
    }
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

function skipBracketIdentifier(sql: string, start: number, databaseType?: DatabaseType): number {
  // PostgreSQL uses square brackets for ARRAY constructors and subscripts, not
  // for delimited identifiers. Leave the opening bracket in the lexical stream.
  if (databaseType === "postgres") return start + 1;

  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === "]") {
      if (sql[i + 1] === "]") {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

function skipLine(sql: string, start: number): number {
  const nextNewline = sql.indexOf("\n", start);
  return nextNewline === -1 ? sql.length : nextNewline + 1;
}

function skipBlockComment(sql: string, start: number, databaseType?: DatabaseType): number {
  let depth = 1, i = start;
  while (i < sql.length) {
    if (databaseType === "postgres" && sql[i] === "/" && sql[i + 1] === "*") { depth++; i += 2; }
    else if (sql[i] === "*" && sql[i + 1] === "/") { i += 2; if (--depth === 0) return i; }
    else i++;
  }
  return sql.length;
}

function readDollarQuoteMarker(sql: string, start: number): string {
  const match = sql.slice(start).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
  return match?.[0] ?? "";
}
