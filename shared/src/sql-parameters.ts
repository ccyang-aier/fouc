// Adapted from DBX sqlParameters.ts (Apache-2.0); native shared compiler for Fouc.
import type { RelationalProvider as DatabaseType } from './relational';
import { editMappedSql, sourceSql, type MappedSql, type SqlSourceEdit } from './sql-source-map';

export type SqlParameterValueKind = "string" | "number" | "boolean" | "null" | "raw";

export interface SqlParameterInput {
  kind: SqlParameterValueKind;
  value: string;
}

export type SqlParameterSyntax = "positional" | "named" | "shell" | "mybatis" | "at";

export interface SqlParameterDescriptor {
  key: string;
  name: string;
  syntax: SqlParameterSyntax;
  token: string;
  collection?: boolean;
}

export interface SqlBracedParameter extends SqlParameterDescriptor {
  start: number;
  end: number;
}

interface ParameterOccurrence extends SqlParameterDescriptor {
  start: number;
  end: number;
  replacement?: "string-fragment" | "quoted-string" | "mybatis-foreach" | "mybatis-where";
  foreach?: MyBatisForeach;
  where?: MyBatisWhere;
}

interface MyBatisWhere {
  body: string;
}

interface MyBatisForeach {
  item: string;
  index?: string;
  open: string;
  separator: string;
  close: string;
  body: string;
}

export interface SqlParameterOptions {
  databaseType?: DatabaseType;
  // Which placeholder syntaxes are recognized. Undefined enables all of them.
  enabledSyntaxes?: readonly SqlParameterSyntax[];
}

const PARAMETER_NAME_RE = /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*$/u;
const PARAMETER_NAME_START_RE = /[\p{L}_]/u;
const PARAMETER_NAME_CHAR_RE = /[\p{L}\p{N}_]/u;
const MYSQL_ROUTINE_LABEL_STATEMENTS = new Set(["begin", "loop", "while", "repeat"]);
const MYSQL_ROUTINE_LABEL_CONTEXTS = new Set(["begin", "then", "else", "do", "loop", "repeat"]);
const MYSQL_ROUTINE_LABEL_RE = /(?:`(?:``|[^`])+`|[\p{L}_][\p{L}\p{N}_]*)$/u;
const POSTGRES_QUESTION_PARAMETER_PREFIX_KEYWORDS = new Set([
  "all",
  "and",
  "any",
  "as",
  "between",
  "by",
  "case",
  "collate",
  "distinct",
  "else",
  "fetch",
  "filter",
  "first",
  "for",
  "from",
  "group",
  "groups",
  "having",
  "ilike",
  "in",
  "interval",
  "into",
  "is",
  "like",
  "limit",
  "next",
  "not",
  "offset",
  "on",
  "or",
  "order",
  "over",
  "partition",
  "placing",
  "range",
  "returning",
  "rows",
  "select",
  "set",
  "similar",
  "some",
  "then",
  "to",
  "using",
  "values",
  "when",
  "where",
  "window",
  "zone",
]);
const POSTGRES_QUESTION_OPERATOR_TRAILING_KEYWORDS = new Set([
  "and",
  "as",
  "between",
  "else",
  "end",
  "except",
  "fetch",
  "filter",
  "from",
  "group",
  "having",
  "ilike",
  "in",
  "intersect",
  "is",
  "join",
  "like",
  "limit",
  "offset",
  "on",
  "or",
  "order",
  "over",
  "returning",
  "then",
  "union",
  "when",
  "where",
  "window",
]);

export function readSqlBracedParameterAt(sql: string, start: number, options?: SqlParameterOptions): SqlBracedParameter | null {
  const open = sql.slice(start, start + 2);
  const syntax: SqlParameterSyntax | null = open === "${" ? "shell" : open === "#{" ? "mybatis" : null;
  if (!syntax || (options?.enabledSyntaxes && !options.enabledSyntaxes.includes(syntax))) return null;

  const closeBrace = sql.indexOf("}", start + 2);
  if (closeBrace === -1) return null;
  const name = sql.slice(start + 2, closeBrace).trim();
  if (!PARAMETER_NAME_RE.test(name)) return null;

  return { key: name, name, syntax, token: sql.slice(start, closeBrace + 1), start, end: closeBrace + 1 };
}

export function extractSqlParameters(sql: string, options?: SqlParameterOptions): string[] {
  return extractSqlParameterDescriptors(sql, options).map((descriptor) => descriptor.key);
}

export function extractSqlParameterDescriptors(sql: string, options?: SqlParameterOptions, depth = 0): SqlParameterDescriptor[] {
  if (depth > 32) throw new Error('SQL 模板嵌套超过 32 层');
  const names = new Set<string>();
  const descriptors: SqlParameterDescriptor[] = [];
  const appendDescriptor = (descriptor: SqlParameterDescriptor) => {
    if (names.has(descriptor.key)) {
      if (descriptor.collection) {
        const existing = descriptors.find((item) => item.key === descriptor.key);
        if (existing) Object.assign(existing, { token: descriptor.token, collection: true });
      }
      return;
    }
    names.add(descriptor.key);
    if (names.size > 128) throw new Error('每次参数输入最多支持 128 个参数，请分段执行');
    descriptors.push(descriptor);
  };
  for (const occurrence of findSqlParameterOccurrences(sql, options)) {
    if (occurrence.replacement === "mybatis-where" && occurrence.where) {
      for (const nested of extractSqlParameterDescriptors(occurrence.where.body, options, depth + 1)) appendDescriptor(nested);
      continue;
    }
    appendDescriptor({
      key: occurrence.key,
      name: occurrence.name,
      syntax: occurrence.syntax,
      token: occurrence.token,
      ...(occurrence.collection ? { collection: true } : {}),
    });
    if (occurrence.replacement === "mybatis-foreach" && occurrence.foreach) {
      for (const nested of extractSqlParameterDescriptors(occurrence.foreach.body, options, depth + 1)) {
        if (nested.key !== occurrence.foreach.item && nested.key !== occurrence.foreach.index) appendDescriptor(nested);
      }
    }
  }
  return descriptors;
}

export function substituteSqlParameters(sql: string, values: Record<string, SqlParameterInput>, options?: SqlParameterOptions, depth = 0): string {
  return renderSqlParameters(sourceSql(sql), values, options, depth).sql;
}

export function renderSqlParameters(source: MappedSql, values: Record<string, SqlParameterInput>, options?: SqlParameterOptions, depth = 0): MappedSql {
  if (depth > 32) throw new Error('SQL 模板嵌套超过 32 层');
  const sql = source.sql;
  const occurrences = findSqlParameterOccurrences(sql, options);
  if (!occurrences.length) return source;
  const decodeMyBatisEntities = occurrences.some((occurrence) => occurrence.syntax === "mybatis");

  const edits: SqlSourceEdit[] = [];
  for (const occurrence of occurrences) {
    if (occurrence.replacement === "mybatis-where" && occurrence.where) {
      edits.push({ from: occurrence.start, to: occurrence.end, text: renderMyBatisWhere(occurrence.where, values, options, depth) });
      continue;
    }
    const input = values[occurrence.key] ?? { kind: "string", value: "" };
    if (occurrence.replacement === "mybatis-foreach" && occurrence.foreach) {
      edits.push({ from: occurrence.start, to: occurrence.end, text: renderMyBatisForeach(occurrence.foreach, input, values, options, depth) });
      continue;
    }
    // An empty Raw SQL value means that this placeholder is intentionally left
    // unresolved, rather than replaced with an empty string or NULL.
    if (input.kind === "raw" && !input.value.trim()) {

      continue;
    }
    // Embedded placeholders stay inside the surrounding SQL string, so their value
    // must be escaped as text instead of being wrapped in a second SQL literal.
    const text = occurrence.replacement === "string-fragment" ? sqlParameterStringFragment(input, options?.databaseType) : occurrence.replacement === "quoted-string" ? sqlParameterQuotedString(input, options?.databaseType) : sqlParameterLiteral(input, options?.databaseType);
    edits.push({ from: occurrence.start, to: occurrence.end, text });
  }
  const result = editMappedSql(source, edits);
  return decodeMyBatisEntities ? decodeMyBatisXmlComparisonEntities(result, options?.databaseType) : result;
}

const MYBATIS_WHERE_LEADING_CONJUNCTION_RE = /^(?:AND|OR)\s+/i;

function renderMyBatisWhere(where: MyBatisWhere, values: Record<string, SqlParameterInput>, options: SqlParameterOptions | undefined, depth: number): string {
  const body = substituteSqlParameters(where.body, values, options, depth + 1).trim();
  if (!body) return "";
  return `WHERE ${body.replace(MYBATIS_WHERE_LEADING_CONJUNCTION_RE, "")}`;
}

function renderMyBatisForeach(foreach: MyBatisForeach, input: SqlParameterInput, values: Record<string, SqlParameterInput>, options: SqlParameterOptions | undefined, depth: number): string {
  const items = parseSqlParameterList(input.value);
  if (items.length === 0) return `${foreach.open}NULL${foreach.close}`;

  const renderedItems: string[] = [];
  let length = foreach.open.length + foreach.close.length;
  for (const [index, item] of items.entries()) {
    const itemInput: SqlParameterInput = item === null ? { kind: "null", value: "NULL" } : { kind: input.kind, value: String(item) };
    const iterationValues = { ...values, [foreach.item]: itemInput };
    if (foreach.index) iterationValues[foreach.index] = { kind: "number", value: String(index) };
    const text = substituteSqlParameters(foreach.body, iterationValues, options, depth + 1);
    length += text.length + (index ? foreach.separator.length : 0);
    if (length > 1_000_000) throw new Error('展开后的 SQL 超过 1 MB');
    renderedItems.push(text);
  }
  return `${foreach.open}${renderedItems.join(foreach.separator)}${foreach.close}`;
}

function parseSqlParameterList(raw: string): Array<string | number | boolean | null> {
  const value = raw.trim();
  if (!value) return [];

  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) return parsed;
    } catch {
      return [];
    }
    return [];
  }

  return splitCommaSeparatedValues(value).map(unquoteListValue);
}

function splitCommaSeparatedValues(value: string): string[] {
  const items: string[] = [];
  let start = 0;
  let quote = "";

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quote) {
      if (ch === "\\" && quote === '"' && i + 1 < value.length) i += 1;
      else if (ch === quote) {
        if (value[i + 1] === quote) i += 1;
        else quote = "";
      }
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === ",") {
      items.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  items.push(value.slice(start).trim());
  return items;
}

function unquoteListValue(value: string): string {
  if (value.length < 2 || value[0] !== value[value.length - 1] || (value[0] !== "'" && value[0] !== '"')) return value;
  const quote = value[0];
  const inner = value.slice(1, -1);
  if (quote === "'") return inner.replace(/''/g, "'");
  try {
    return JSON.parse(value);
  } catch {
    return inner.replace(/""/g, '"');
  }
}

function decodeMyBatisXmlComparisonEntities(source: MappedSql, databaseType?: DatabaseType): MappedSql {
  const sql = source.sql;
  const edits: SqlSourceEdit[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if ((!databaseType || databaseType === 'mysql') && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        const end = sql.indexOf(marker, i + marker.length);
        i = end === -1 ? sql.length : end + marker.length;
        continue;
      }
    }

    const replacement = sql.startsWith("&lt;", i) ? "<" : sql.startsWith("&gt;", i) ? ">" : "";
    if (replacement) {
      edits.push({ from: i, to: i + 4, text: replacement });
      i += 4;
      continue;
    }
    i += 1;
  }

  return editMappedSql(source, edits);
}

export function sqlParameterLiteral(input: SqlParameterInput, databaseType?: DatabaseType): string {
  if (input.kind === "null") return "NULL";
  const raw = input.value;
  if (input.kind === "raw") return raw.trim() || "NULL";
  if (input.kind === "number") return raw.trim() || "NULL";
  if (input.kind === "boolean") return normalizeBooleanLiteral(raw, databaseType);
  return quoteSqlString(raw, databaseType);
}

function findSqlParameterOccurrences(sql: string, options?: SqlParameterOptions): ParameterOccurrence[] {
  const occurrences: ParameterOccurrence[] = [];
  const databaseType = options?.databaseType;
  const nativeMysqlParameters = collectNativeMysqlParameters(sql, databaseType);

  const enabledSyntaxes = options?.enabledSyntaxes ? new Set(options.enabledSyntaxes) : null;
  const isSyntaxEnabled = (syntax: SqlParameterSyntax) => !enabledSyntaxes || enabledSyntaxes.has(syntax);
  let i = 0;
  let dollarQuoteEnd = "";
  let positionalIndex = 0;
  let parenthesisDepth = 0;
  const postgresBracketStack: Array<{ constructor: boolean; parenthesisDepth: number }> = [];

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

    if (ch === "<" && isSyntaxEnabled("mybatis")) {
      const foreach = readMyBatisForeachAt(sql, i, databaseType);
      if (foreach) {
        occurrences.push({
          key: foreach.collection,
          name: foreach.collection,
          syntax: "mybatis",
          token: "<foreach>",
          collection: true,
          replacement: "mybatis-foreach",
          foreach: foreach.render,
          start: i,
          end: foreach.end,
        });
        i = foreach.end;
        continue;
      }
      const where = readMyBatisWhereAt(sql, i, databaseType);
      if (where) {
        occurrences.push({
          key: "",
          name: "",
          syntax: "mybatis",
          token: "<where>",
          replacement: "mybatis-where",
          where: { body: where.body },
          start: i,
          end: where.end,
        });
        i = where.end;
        continue;
      }
    }

    if (ch === "'" || ch === '"') {
      const quoted = tryReadQuotedBracedPlaceholder(sql, i, ch, isSyntaxEnabled, databaseType);
      if (quoted) {
        occurrences.push(quoted);
        i = quoted.end;
        continue;
      }
      const quotedEnd = skipQuoted(sql, i, ch, databaseType);
      // Double quotes can delimit identifiers, so only ordinary single-quoted
      // values opt into embedded interpolation.
      if (ch === "'" && !hasSqlStringLiteralPrefix(sql, i)) {
        occurrences.push(...collectEmbeddedQuotedBracedPlaceholders(sql, i + 1, quotedEnd, isSyntaxEnabled));
      }
      i = quotedEnd;
      continue;
    }
    if (ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (databaseType === "postgres" && ch === "(") {
      parenthesisDepth += 1;
      i += 1;
      continue;
    }
    if (databaseType === "postgres" && ch === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      i += 1;
      continue;
    }
    if (ch === "[") {
      if (databaseType === "postgres") {
        postgresBracketStack.push({
          constructor: isPostgresArrayConstructorBracket(sql, i, postgresBracketStack[postgresBracketStack.length - 1]?.constructor ?? false),
          parenthesisDepth,
        });
        i += 1;
        continue;
      }
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (databaseType === "postgres" && ch === "]") {
      postgresBracketStack.pop();
      i += 1;
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if (ch === "?" && isSyntaxEnabled("positional")) {
      if (isPostgresQuestionMarkOperator(sql, i, options?.databaseType)) {
        i += 1;
        continue;
      }
      positionalIndex += 1;
      const key = `?${positionalIndex}`;
      occurrences.push({ key, name: key, syntax: "positional", token: "?", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ":" && isSyntaxEnabled("named")) {
      const name = readParameterName(sql, i + 1);
      if (
        name &&
        sql[i - 1] !== ":" &&
        sql[i + 1] !== "=" &&
        !isPostgresSliceSeparator(postgresBracketStack, parenthesisDepth) &&
        !isMysqlRoutineLabelSeparator(sql, i, name, options?.databaseType)
      ) {
        occurrences.push({
          key: name,
          name,
          syntax: "named",
          token: sql.slice(i, i + 1 + name.length),
          start: i,
          end: i + 1 + name.length,
        });
        i += 1 + name.length;
        continue;
      }
    }
    if ((ch === "$" || ch === "#") && next === "{") {
      const parameter = readSqlBracedParameterAt(sql, i, options);
      if (parameter) {
        occurrences.push(parameter);
        i = parameter.end;
        continue;
      }
    }
    if ((!databaseType || databaseType === 'mysql') && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }
    if (ch === "@" && isSyntaxEnabled("at")) {
      const name = readParameterName(sql, i + 1);
      if (name && next !== "@" && sql[i - 1] !== "@" && !nativeMysqlParameters.declared.has(name.toLowerCase())) {
        occurrences.push({
          key: name,
          name,
          syntax: "at",
          token: sql.slice(i, i + 1 + name.length),
          start: i,
          end: i + 1 + name.length,
        });
        i += 1 + name.length;
        continue;
      }
    }
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        dollarQuoteEnd = marker;
        i += marker.length;
        continue;
      }
    }
    i += 1;
  }

  return occurrences;
}

function isMysqlRoutineLabelSeparator(sql: string, colonIndex: number, followingName: string, databaseType?: DatabaseType): boolean {
  if (databaseType !== "mysql" || !MYSQL_ROUTINE_LABEL_STATEMENTS.has(followingName.toLowerCase())) return false;

  const label = sql.slice(0, colonIndex).match(MYSQL_ROUTINE_LABEL_RE);
  if (!label) return false;
  const labelStart = colonIndex - label[0].length;
  const prefix = sql.slice(0, labelStart).trimEnd();
  return prefix.length === 0 || prefix.endsWith(";") || MYSQL_ROUTINE_LABEL_CONTEXTS.has(previousKeyword(sql, labelStart));
}

function readMyBatisForeachAt(sql: string, start: number, databaseType?: DatabaseType): { collection: string; render: MyBatisForeach; end: number } | null {
  if (!/^<foreach(?:\s|>)/i.test(sql.slice(start))) return null;
  const openingEnd = findXmlTagEnd(sql, start);
  if (openingEnd === -1) return null;
  const attributes = parseXmlAttributes(sql.slice(start + "<foreach".length, openingEnd));
  if (!attributes) return null;

  const collection = attributes.get("collection")?.trim() ?? "";
  const item = attributes.get("item")?.trim() ?? "";
  const index = attributes.get("index")?.trim();
  if (!PARAMETER_NAME_RE.test(collection) || !PARAMETER_NAME_RE.test(item) || (index !== undefined && !PARAMETER_NAME_RE.test(index))) return null;

  const close = findMatchingXmlTagClose(sql, openingEnd + 1, "foreach", databaseType);
  if (!close) return null;
  return {
    collection,
    render: {
      item,
      ...(index ? { index } : {}),
      open: attributes.get("open") ?? "",
      separator: attributes.get("separator") ?? "",
      close: attributes.get("close") ?? "",
      body: sql.slice(openingEnd + 1, close.start),
    },
    end: close.end,
  };
}

function readMyBatisWhereAt(sql: string, start: number, databaseType?: DatabaseType): { body: string; end: number } | null {
  if (!/^<where(?:\s|>)/i.test(sql.slice(start))) return null;
  const openingEnd = findXmlTagEnd(sql, start);
  if (openingEnd === -1) return null;

  const close = findMatchingXmlTagClose(sql, openingEnd + 1, "where", databaseType);
  if (!close) return null;
  return { body: sql.slice(openingEnd + 1, close.start), end: close.end };
}

function findXmlTagEnd(source: string, start: number): number {
  let quote = "";
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === ">") return i;
  }
  return -1;
}

function parseXmlAttributes(source: string): Map<string, string> | null {
  const attributes = new Map<string, string>();
  let i = 0;
  while (i < source.length) {
    while (/\s/.test(source[i] ?? "")) i += 1;
    if (i >= source.length) break;

    const nameStart = i;
    while (/[\w:-]/.test(source[i] ?? "")) i += 1;
    if (i === nameStart) return null;
    const name = source.slice(nameStart, i).toLowerCase();
    while (/\s/.test(source[i] ?? "")) i += 1;
    if (source[i] !== "=") return null;
    i += 1;
    while (/\s/.test(source[i] ?? "")) i += 1;
    const quote = source[i];
    if (quote !== "'" && quote !== '"') return null;
    const valueStart = ++i;
    while (i < source.length && source[i] !== quote) i += 1;
    if (i >= source.length) return null;
    attributes.set(name, decodeXmlAttribute(source.slice(valueStart, i)));
    i += 1;
  }
  return attributes;
}

function decodeXmlAttribute(value: string): string {
  return value.replace(/&(?:lt|gt|amp|quot|apos);/g, (entity) => ({ "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&apos;": "'" })[entity] ?? entity);
}

function findMatchingXmlTagClose(sql: string, start: number, tagName: string, databaseType?: DatabaseType): { start: number; end: number } | null {
  let depth = 1;
  let i = start;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if ((!databaseType || databaseType === 'mysql') && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        const end = sql.indexOf(marker, i + marker.length);
        i = end === -1 ? sql.length : end + marker.length;
        continue;
      }
    }
    if (ch === "<") {
      const tag = readXmlTagAt(sql, i, tagName);
      if (tag) {
        depth += tag.closing ? -1 : 1;
        if (depth === 0) return { start: i, end: tag.end };
        i = tag.end;
        continue;
      }
    }
    i += 1;
  }
  return null;
}

function readXmlTagAt(sql: string, start: number, tagName: string): { closing: boolean; end: number } | null {
  const closing = sql[start + 1] === "/";
  const nameStart = start + (closing ? 2 : 1);
  if (sql.slice(nameStart, nameStart + tagName.length).toLowerCase() !== tagName) return null;
  const boundary = sql[nameStart + tagName.length];
  if (boundary !== ">" && !/\s/.test(boundary ?? "")) return null;
  const tagEnd = findXmlTagEnd(sql, start);
  return tagEnd === -1 ? null : { closing, end: tagEnd + 1 };
}

function isPostgresQuestionMarkOperator(sql: string, index: number, databaseType: DatabaseType | undefined): boolean {
  if (databaseType !== "postgres") return false;
  if (sql[index - 1] === "@" || sql[index + 1] === "|" || sql[index + 1] === "&") return true;

  const previousIndex = previousSqlSignificantIndex(sql, index);
  if (previousIndex < 0 || !canEndPostgresExpression(sql, previousIndex)) return false;

  const nextIndex = skipSqlWhitespaceAndComments(sql, index + 1, databaseType);
  if (nextIndex >= sql.length) return false;
  const next = sql[nextIndex];
  if (next === "'" || next === '"' || next === "`" || next === "[" || next === "(" || next === "$" || next === ":" || next === "#" || next === "@" || next === "?" || next === "+" || next === "-") return true;
  if (!PARAMETER_NAME_CHAR_RE.test(next)) return false;

  let end = nextIndex + 1;
  while (end < sql.length && PARAMETER_NAME_CHAR_RE.test(sql[end])) end += 1;
  return !POSTGRES_QUESTION_OPERATOR_TRAILING_KEYWORDS.has(sql.slice(nextIndex, end).toLowerCase());
}

function previousSqlSignificantIndex(sql: string, start: number): number {
  let index = start - 1;
  while (index >= 0) {
    while (index >= 0 && /\s/.test(sql[index])) index -= 1;
    if (index >= 1 && sql[index - 1] === "*" && sql[index] === "/") {
      const commentStart = sql.lastIndexOf("/*", index - 1);
      if (commentStart >= 0) {
        index = commentStart - 1;
        continue;
      }
    }
    return index;
  }
  return -1;
}

function canEndPostgresExpression(sql: string, end: number): boolean {
  const previous = sql[end];
  if (previous === ")" || previous === "]" || previous === "}" || previous === "'" || previous === '"' || previous === "`" || previous === "$") return true;
  if (!PARAMETER_NAME_CHAR_RE.test(previous)) return false;

  let start = end;
  while (start > 0 && PARAMETER_NAME_CHAR_RE.test(sql[start - 1])) start -= 1;
  return !POSTGRES_QUESTION_PARAMETER_PREFIX_KEYWORDS.has(sql.slice(start, end + 1).toLowerCase());
}

function skipSqlWhitespaceAndComments(sql: string, start: number, databaseType?: DatabaseType): number {
  let i = start;
  while (i < sql.length) {
    while (i < sql.length && /\s/.test(sql[i])) i += 1;
    if (sql[i] === "-" && sql[i + 1] === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (sql[i] === "/" && sql[i + 1] === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if ((!databaseType || databaseType === "mysql") && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }
    break;
  }
  return i;
}

function collectNativeMysqlParameters(sql: string, databaseType?: DatabaseType): { declared: Set<string> } {
  const declared = new Set<string>();
  if (databaseType && databaseType !== "mysql") return { declared };
  let i = 0;
  let dollarQuoteEnd = "";

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
    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if (ch === "$") {
      const marker = readDollarQuoteMarker(sql, i);
      if (marker) {
        dollarQuoteEnd = marker;
        i += marker.length;
        continue;
      }
    }
    if ((!databaseType || databaseType === "mysql") && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }

    if (matchesWord(sql, i, "set")) {
      i = collectSetStatementVariables(sql, i + "set".length, declared, databaseType);
      continue;
    }
    if (matchesWord(sql, i, "select")) {
      i = collectSelectAssignmentVariables(sql, i + "select".length, declared, databaseType);
      continue;
    }
    if (matchesWord(sql, i, "get")) {
      const diagnosticsEnd = readGetDiagnosticsEnd(sql, i);
      if (diagnosticsEnd !== null) {
        i = collectSetStatementVariables(sql, diagnosticsEnd, declared, databaseType);
        continue;
      }
    }


    i += 1;
  }

  return { declared };
}

function collectSetStatementVariables(sql: string, start: number, declared: Set<string>, databaseType?: DatabaseType): number {
  let i = start;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === ";") return i + 1;
    if (isLineStatementStart(sql, i) && isSqlStatementKeyword(sql, i)) return i;
    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if ((!databaseType || databaseType === "mysql") && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }
    if (ch === "@") {
      const name = readParameterName(sql, i + 1);
      if (name && next !== "@" && sql[i - 1] !== "@" && isSetAssignmentTarget(sql, i + 1 + name.length)) {
        declared.add(name.toLowerCase());
        i += 1 + name.length;
        continue;
      }
    }
    i += 1;
  }
  return i;
}

function collectSelectAssignmentVariables(sql: string, start: number, declared: Set<string>, databaseType?: DatabaseType): number {
  let i = start;
  let depth = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === ";" && depth === 0) return i + 1;
    if (depth === 0 && isLineStatementStart(sql, i) && isSqlStatementKeyword(sql, i)) return i;
    if (databaseType !== "mysql" && matchesWord(sql, i, "from")) return i;
    if (ch === "'" || ch === '"' || ch === "`") {
      i = skipQuoted(sql, i, ch, databaseType);
      continue;
    }
    if (ch === "[") {
      i = skipBracketIdentifier(sql, i, databaseType);
      continue;
    }
    if (ch === "-" && next === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    if ((!databaseType || databaseType === "mysql") && isHashLineComment(sql, i)) {
      i = skipLine(sql, i + 1);
      continue;
    }
    if (databaseType === "mysql" && ch === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (databaseType === "mysql" && ch === ")") {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (databaseType === "mysql" && depth === 0 && matchesWord(sql, i, "into")) {
      const targetEnd = collectMysqlSelectIntoTargets(sql, i + "into".length, declared);
      if (targetEnd !== null) {
        i = targetEnd;
        continue;
      }
    }
    if (ch === "@") {
      const name = readParameterName(sql, i + 1);
      if (name && next !== "@" && sql[i - 1] !== "@" && isSetAssignmentTarget(sql, i + 1 + name.length)) {
        declared.add(name.toLowerCase());
        i += 1 + name.length;
        continue;
      }
    }
    i += 1;
  }
  return i;
}

function collectMysqlSelectIntoTargets(sql: string, start: number, declared: Set<string>): number | null {
  let i = skipSqlWhitespaceAndComments(sql, start);
  let found = false;
  while (i < sql.length && sql[i] === "@" && sql[i + 1] !== "@" && sql[i - 1] !== "@") {
    const name = readParameterName(sql, i + 1);
    if (!name) break;
    declared.add(name.toLowerCase());
    found = true;
    i = skipSqlWhitespaceAndComments(sql, i + 1 + name.length);
    if (sql[i] !== ",") break;
    i = skipSqlWhitespaceAndComments(sql, i + 1);
  }
  return found ? i : null;
}

// MySQL's GET DIAGNOSTICS writes its results into the user variables on the left
// of each assignment (`GET DIAGNOSTICS CONDITION 1 @err = MESSAGE_TEXT`), exactly
// as SET and SELECT ... INTO do. Returns the offset just past the statement's
// leading keywords, or null when `start` is an ordinary `get` identifier.
function readGetDiagnosticsEnd(sql: string, start: number): number | null {
  let keyword = readNextKeyword(sql, start + "get".length);
  if (keyword?.word === "current" || keyword?.word === "stacked") keyword = readNextKeyword(sql, keyword.end);
  return keyword?.word === "diagnostics" ? keyword.end : null;
}

function readNextKeyword(sql: string, start: number, databaseType: DatabaseType = 'mysql'): { word: string; end: number } | null {
  let i = start;
  while (i < sql.length) {
    while (i < sql.length && /\s/.test(sql[i])) i += 1;
    if (sql[i] === "-" && sql[i + 1] === "-") {
      i = skipLine(sql, i + 2);
      continue;
    }
    if (sql[i] === "/" && sql[i + 1] === "*") {
      i = skipBlockComment(sql, i + 2, databaseType);
      continue;
    }
    break;
  }
  if (!PARAMETER_NAME_START_RE.test(sql[i] ?? "")) return null;
  let end = i + 1;
  while (end < sql.length && PARAMETER_NAME_CHAR_RE.test(sql[end])) end += 1;
  return { word: sql.slice(i, end).toLowerCase(), end };
}

function isSetAssignmentTarget(sql: string, start: number): boolean {
  let i = start;
  while (i < sql.length && /\s/.test(sql[i])) i += 1;
  return sql[i] === "=" || (sql[i] === ":" && sql[i + 1] === "=");
}

function isLineStatementStart(sql: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && (sql[i] === " " || sql[i] === "\t" || sql[i] === "\r")) i -= 1;
  return i >= 0 && sql[i] === "\n";
}

function isSqlStatementKeyword(sql: string, start: number): boolean {
  return ["select", "with", "insert", "update", "delete", "merge", "exec", "execute", "set", "if", "while", "begin", "create", "alter", "drop", "truncate"].some((keyword) => matchesWord(sql, start, keyword));
}

function matchesWord(sql: string, start: number, word: string): boolean {
  const value = sql.slice(start, start + word.length);
  if (value.toLowerCase() !== word) return false;
  return !PARAMETER_NAME_CHAR_RE.test(sql[start - 1] ?? "") && !PARAMETER_NAME_CHAR_RE.test(sql[start + word.length] ?? "");
}

function readParameterName(sql: string, start: number): string {
  if (!PARAMETER_NAME_START_RE.test(sql[start] ?? "")) return "";
  let i = start + 1;
  while (i < sql.length && PARAMETER_NAME_CHAR_RE.test(sql[i])) i += 1;
  return sql.slice(start, i);
}

/** Match only unprefixed quote + exact `${name}`/`#{name}` + same quote. Leaves skipQuoted unchanged. */
function tryReadQuotedBracedPlaceholder(sql: string, start: number, quote: "'" | '"', isSyntaxEnabled: (syntax: SqlParameterSyntax) => boolean, databaseType?: DatabaseType): ParameterOccurrence | null {
  if (sql[start] !== quote) return null;
  // Reject E'...', U&'...', B'...', X'...', N'...' — replacing the quoted span would leave the
  // prefix attached to a typed literal (e.g. E'${path}' → E'C:\new', B'${flag}' → BTRUE).
  if (hasSqlStringLiteralPrefix(sql, start)) return null;

  const open = sql.slice(start + 1, start + 3);
  let syntax: SqlParameterSyntax | null = null;
  if (open === "${") syntax = "shell";
  else if (open === "#{") syntax = "mybatis";
  else return null;
  if (!isSyntaxEnabled(syntax)) return null;

  const nameStart = start + 3;
  const closeBrace = sql.indexOf("}", nameStart);
  if (closeBrace === -1 || sql[closeBrace + 1] !== quote) return null;

  const name = sql.slice(nameStart, closeBrace).trim();
  if (!PARAMETER_NAME_RE.test(name)) return null;

  const end = closeBrace + 2;
  // The closing quote must be a real string terminator under the same rules as skipQuoted
  // (doubled quotes / backslash escapes). Otherwise '${value}''suffix' would match '${value}'.
  if (skipQuoted(sql, start, quote, databaseType) !== end) return null;

  return {
    key: name,
    name,
    syntax,
    token: sql.slice(start, end),
    ...(quote === "\'" ? { replacement: "quoted-string" as const } : {}),
    start,
    end,
  };
}

function collectEmbeddedQuotedBracedPlaceholders(sql: string, contentStart: number, quotedEnd: number, isSyntaxEnabled: (syntax: SqlParameterSyntax) => boolean): ParameterOccurrence[] {
  const occurrences: ParameterOccurrence[] = [];
  const contentEnd = sql[quotedEnd - 1] === "'" ? quotedEnd - 1 : quotedEnd;
  let i = contentStart;

  while (i < contentEnd) {
    const ch = sql[i];
    const next = sql[i + 1];
    let syntax: SqlParameterSyntax | null = null;
    if (ch === "$" && next === "{") syntax = "shell";
    else if (ch === "#" && next === "{") syntax = "mybatis";
    if (!syntax || !isSyntaxEnabled(syntax)) {
      i += 1;
      continue;
    }

    const closeBrace = sql.indexOf("}", i + 2);
    if (closeBrace === -1 || closeBrace >= contentEnd) {
      i += 1;
      continue;
    }
    const name = sql.slice(i + 2, closeBrace).trim();
    if (!PARAMETER_NAME_RE.test(name)) {
      i += 1;
      continue;
    }

    occurrences.push({
      key: name,
      name,
      syntax,
      token: sql.slice(i, closeBrace + 1),
      start: i,
      end: closeBrace + 1,
      replacement: "string-fragment",
    });
    i = closeBrace + 1;
  }

  return occurrences;
}

/** True when `quoteStart` opens a prefixed literal such as E'...', U&'...', or MySQL _charset'...'. */
function hasSqlStringLiteralPrefix(sql: string, quoteStart: number): boolean {
  if (quoteStart <= 0) return false;

  if (quoteStart >= 2 && sql[quoteStart - 1] === "&" && (sql[quoteStart - 2] === "U" || sql[quoteStart - 2] === "u") && !PARAMETER_NAME_CHAR_RE.test(sql[quoteStart - 3] ?? "")) {
    return true;
  }

  // SQL dialects attach word-like introducers directly to the quote. Reject the
  // whole category so typed replacement cannot leave invalid prefixes such as
  // `_utf8mb4TRUE`, and so future introducers do not require another allowlist.
  return PARAMETER_NAME_CHAR_RE.test(sql[quoteStart - 1]);
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
  // for delimited identifiers. Leave the opening bracket in the lexical stream
  // so quoted array elements cannot corrupt the following SQL state.
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

function isHashLineComment(sql: string, start: number): boolean {
  if (sql[start] !== "#" || sql[start + 1] === "{") return false;
  return true;
}

function isPostgresArrayConstructorBracket(sql: string, start: number, parentIsConstructor: boolean): boolean {
  if (previousKeyword(sql, start) === "array") return true;
  if (!parentIsConstructor) return false;

  let previous = start - 1;
  while (previous >= 0 && /\s/.test(sql[previous])) previous -= 1;
  return sql[previous] === "[" || sql[previous] === ",";
}

function isPostgresSliceSeparator(stack: Array<{ constructor: boolean; parenthesisDepth: number }>, parenthesisDepth: number): boolean {
  const context = stack[stack.length - 1];
  return !!context && !context.constructor && context.parenthesisDepth === parenthesisDepth;
}

function previousKeyword(sql: string, start: number): string {
  let end = start - 1;
  while (end >= 0 && /\s/.test(sql[end])) end -= 1;
  let begin = end;
  while (begin >= 0 && PARAMETER_NAME_CHAR_RE.test(sql[begin])) begin -= 1;
  begin += 1;
  if (begin > end || !PARAMETER_NAME_START_RE.test(sql[begin] ?? "")) return "";
  return sql.slice(begin, end + 1).toLowerCase();
}

function readDollarQuoteMarker(sql: string, start: number): string {
  const match = sql.slice(start).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
  return match?.[0] ?? "";
}

function quoteSqlString(value: string, databaseType?: DatabaseType): string {
  return `'${escapeSqlString(value, databaseType)}'`;
}

function escapeSqlString(value: string, databaseType?: DatabaseType): string {
  return (databaseType === 'mysql' ? value.replace(/\\/g, '\\\\') : value).replace(/'/g, "''");
}

function sqlParameterStringFragment(input: SqlParameterInput, databaseType?: DatabaseType): string {
  return escapeSqlString(input.value, databaseType);
}

function sqlParameterQuotedString(input: SqlParameterInput, databaseType?: DatabaseType): string {
  if (input.kind === "null" || ((input.kind === "number" || input.kind === "raw") && !input.value.trim())) return "NULL";
  return quoteSqlString(input.value, databaseType);
}

function normalizeBooleanLiteral(value: string, databaseType?: DatabaseType): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "yes" || normalized === "y" || normalized === "1") return "TRUE";
  if (normalized === "false" || normalized === "f" || normalized === "no" || normalized === "n" || normalized === "0") return "FALSE";
  return quoteSqlString(value, databaseType);
}
