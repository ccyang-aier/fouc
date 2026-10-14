import { createUiMessages } from '../../i18n/ui-message';
import { type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './formatter.messages';
import {
  DEFAULT_SQL_FORMATTER_SETTINGS,
  normalizeSqlFormatterSettings,
  sqlFormatterOptions,
  tokenizeSqlSemantic,
  type SqlFormatterSettings,
} from '@fouc/shared';
import { formatSqlLayout } from './layout';
import { looksLikeXml } from './structured';
const connectorUiMessages = createUiMessages(connectorMessages);
export type SqlFormatDialect = 'mysql' | 'postgres' | 'sqlite' | 'generic';
export const MAX_SQL_FORMAT_CHARS = 1000000;
interface EmptyLineProtection {
  sql: string;
  markers: string[];
}
/**
 * Replaces blank source lines with unique line comments while the third-party
 * formatter runs. sql-formatter intentionally normalizes whitespace, whereas
 * the optional DBX setting needs to retain visual paragraph boundaries such as
 * the blank line between a heading comment and a query. Line comments are
 * valid at every SQL code boundary and are restored only after all DBX layout
 * post-processing is complete.
 */
function protectEmptyLines(sql: string, dialect: SqlFormatDialect): EmptyLineProtection {
  let namespace = 0;
  while (sql.includes(`__DBX_PRESERVE_EMPTY_LINE_${namespace}_`)) namespace += 1;
  const markers: string[] = [];
  const lineBreakPattern = /\r\n|\r|\n/g;
  let output = '';
  let lineStart = 0;
  let match: RegExpExecArray | null;
  const protectedSpans = tokenizeSqlSemantic(sql, dialect === 'generic' ? 'postgres' : dialect)
    .filter(
      (token) =>
        token.kind === 'string' || token.kind === 'quoted_identifier' || token.kind === 'comment',
    )
    .map((token) => token.span);
  let spanIndex = 0;
  const isProtected = (position: number) => {
    while (spanIndex < protectedSpans.length && protectedSpans[spanIndex].end <= position)
      spanIndex++;
    return spanIndex < protectedSpans.length && protectedSpans[spanIndex].start <= position;
  };
  while ((match = lineBreakPattern.exec(sql))) {
    const line = sql.slice(lineStart, match.index);
    if (line.trim().length === 0 && !isProtected(lineStart)) {
      const marker = `-- __DBX_PRESERVE_EMPTY_LINE_${namespace}_${markers.length}__`;
      markers.push(marker);
      output += marker;
    } else {
      output += line;
    }
    output += match[0];
    lineStart = lineBreakPattern.lastIndex;
  }
  // A final non-terminated blank line is still a user-authored empty line.
  // Do not manufacture one after a trailing line break, though: that would
  // turn the normal EOF sentinel into an additional preserved blank line.
  const finalLine = sql.slice(lineStart);
  if (finalLine.length > 0 && finalLine.trim().length === 0 && !isProtected(lineStart)) {
    const marker = `-- __DBX_PRESERVE_EMPTY_LINE_${namespace}_${markers.length}__`;
    markers.push(marker);
    output += marker;
  } else {
    output += finalLine;
  }
  return { sql: markers.length > 0 ? output : sql, markers };
}
function restoreProtectedEmptyLines(sql: string, markers: readonly string[]): string {
  if (markers.length === 0) return sql;
  const markerSet = new Set(markers);
  const lines = sql.split(/\r\n|\r|\n/);
  for (let index = 0; index < lines.length;) {
    if (!markerSet.has(lines[index].trim())) {
      index += 1;
      continue;
    }
    let runEnd = index;
    while (runEnd < lines.length && markerSet.has(lines[runEnd].trim())) runEnd += 1;
    const markerCount = runEnd - index;
    // sql-formatter adds `linesBetweenQueries` blank lines before a marker
    // group placed between statements. Those lines did not exist in the
    // source—the marker group itself represents the source blank lines—so
    // remove at most one generated line per original blank line. This keeps
    // the larger of the user-authored spacing and the formatter's configured
    // query spacing instead of adding the two counts together.
    let removed = 0;
    while (removed < markerCount && index > 0 && lines[index - 1].trim().length === 0) {
      lines.splice(index - 1, 1);
      index -= 1;
      runEnd -= 1;
      removed += 1;
    }
    for (let markerIndex = index; markerIndex < runEnd; markerIndex += 1) {
      lines[markerIndex] = '';
    }
    index = runEnd;
  }
  return lines.join('\n');
}
export async function formatSqlText(
  sql: string,
  dialect: SqlFormatDialect = 'generic',
  settings: Partial<SqlFormatterSettings> = DEFAULT_SQL_FORMATTER_SETTINGS,
): Promise<string> {
  if (!sql.trim()) return sql;
  if (sql.length > MAX_SQL_FORMAT_CHARS)
    throw connectorUiMessages.error('sqlIsTooLargeToFormatMaximumMbOfCharacters');
  if (looksLikeXml(sql)) throw connectorUiMessages.error('useStructuredTextFormattingForXml');
  const { format } = await import('sql-formatter');
  const normalizedSettings = normalizeSqlFormatterSettings(settings);
  const options = sqlFormatterOptions(normalizedSettings);
  const language = dialect === 'postgres' ? 'postgresql' : dialect === 'generic' ? 'sql' : dialect;
  const emptyLineProtection = normalizedSettings.preserveEmptyLines
    ? protectEmptyLines(sql, dialect)
    : null;
  const input = emptyLineProtection?.sql ?? sql;
  const formatterOptions =
    language === 'postgresql'
      ? {
          ...options,
          paramTypes: {
            ...options.paramTypes,
            custom: [...options.paramTypes.custom, { regex: '\x60(?:\x60\x60|[^\x60])*\x60' }],
          },
        }
      : options;
  const laidOut =
    normalizedSettings.indentStyle === 'standard'
      ? await formatSqlLayout({
          sql: input,
          language,
          cfg: formatterOptions,
          options: {
            lineWidth: normalizedSettings.expressionWidth,
            indentWidth: normalizedSettings.tabWidth,
            useTabs: normalizedSettings.useTabs,
            linesBetweenQueries: normalizedSettings.linesBetweenQueries,
            fromClauseSourceOnSameLine: normalizedSettings.fromClauseLayout === 'sameLine',
            keywordCase: normalizedSettings.keywordCase,
            logicalOperatorNewline: normalizedSettings.logicalOperatorNewline,
          },
        })
      : null;
  let formatted: string;
  if (laidOut !== null) formatted = laidOut;
  else {
    try {
      formatted = format(input, { language, ...formatterOptions });
    } catch (error) {
      if (language === 'postgresql') throw error;
      try {
        formatted = format(input, { language: 'postgresql', ...options });
      } catch {
        throw error;
      }
    }
  }
  formatted = restoreQuotedSource(
    input,
    formatted,
    dialect,
    normalizedSettings.identifierCase === 'preserve',
  );
  formatted = applySqlFormatterLayout(formatted, normalizedSettings, dialect);
  if (dialect === 'postgres') formatted = preservePostgresLiteralConcatenation(sql, formatted);
  return emptyLineProtection
    ? restoreProtectedEmptyLines(formatted, emptyLineProtection.markers)
    : formatted;
}
/** Layout may indent continued blocks; quoted contents must remain byte-for-byte. */
function restoreQuotedSource(
  source: string,
  formatted: string,
  dialect: SqlFormatDialect,
  preserveIdentifiers: boolean,
): string {
  const provider = dialect === 'generic' ? 'postgres' : dialect;
  const keep = (token: ReturnType<typeof tokenizeSqlSemantic>[number]) =>
    token.kind === 'string' ||
    token.kind === 'comment' ||
    (preserveIdentifiers && token.kind === 'quoted_identifier');
  const originals = tokenizeSqlSemantic(source, provider).filter(keep);
  const outputs = tokenizeSqlSemantic(formatted, provider).filter(keep);
  if (
    originals.length !== outputs.length ||
    originals.some((token, index) => token.kind !== outputs[index].kind)
  ) {
    throw connectorUiMessages.error(
      'theFormatterCannotPreserveQuotedContentCompletelyKeepTheOriginal',
    );
  }
  for (let index = outputs.length - 1; index >= 0; index--) {
    const original = originals[index],
      output = outputs[index];
    if (original.text !== output.text)
      formatted =
        formatted.slice(0, output.span.start) + original.text + formatted.slice(output.span.end);
  }
  return formatted;
}
/** PostgreSQL concatenates adjacent string literals only across a newline. */
function preservePostgresLiteralConcatenation(source: string, formatted: string): string {
  const sourceTokens = tokenizeSqlSemantic(source, 'postgres');
  const formattedStrings = tokenizeSqlSemantic(formatted, 'postgres').filter(
    (token) => token.kind === 'string',
  );
  const replacements: {
    from: number;
    to: number;
  }[] = [];
  let stringIndex = -1;
  for (let index = 0; index < sourceTokens.length; index++) {
    const token = sourceTokens[index];
    if (token.kind !== 'string') continue;
    stringIndex++;
    const next = sourceTokens[index + 1];
    if (token.quote !== "'" || next?.kind !== 'string' || next.quote !== "'") continue;
    const sourceGap = source.slice(token.span.end, next.span.start);
    if (!/^[\t \r\n]+$/.test(sourceGap) || !/[\r\n]/.test(sourceGap)) continue;
    const left = formattedStrings[stringIndex],
      right = formattedStrings[stringIndex + 1];
    if (!left || !right || left.text !== token.text || right.text !== next.text) continue;
    const formattedGap = formatted.slice(left.span.end, right.span.start);
    if (/^[\t ]+$/.test(formattedGap))
      replacements.push({ from: left.span.end, to: right.span.start });
  }
  for (let index = replacements.length - 1; index >= 0; index--) {
    const { from, to } = replacements[index];
    formatted = formatted.slice(0, from) + '\n' + formatted.slice(to);
  }
  return formatted;
}
function maskStringAndCommentSpans(
  sql: string,
  dialect: SqlFormatDialect,
): {
  masked: string;
  spans: string[];
} {
  const len = sql.length;
  const spans: string[] = [];
  const placeholder = (index: number) => `\x00${index}\x00`;
  let out = '';
  let i = 0;
  const isIdentifierPart = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_$]/.test(c);
  const supportsNestedBlockComments = dialect === 'postgres';
  const isMysqlDashComment = (c: string | undefined) =>
    c === undefined || c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127;
  const dollarQuoteTagAt = (position: number): string | null => {
    if (sql[position] !== '$' || isIdentifierPart(sql[position - 1])) return null;
    if (sql[position + 1] === '$') return '$$';
    if (!/[A-Za-z_]/.test(sql[position + 1] ?? '')) return null;
    let end = position + 2;
    while (/[A-Za-z0-9_]/.test(sql[end] ?? '')) end++;
    return sql[end] === '$' ? sql.slice(position, end + 1) : null;
  };
  // Captures a full span starting at `start` (already consumed into `i`) and
  // emits a placeholder. `end` is the index just past the span terminator.
  const emit = (start: number, end: number) => {
    spans.push(sql.slice(start, end));
    out += placeholder(spans.length - 1);
  };
  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];
    // 块注释 /* ... */（含嵌套）
    if (ch === '/' && next === '*') {
      const start = i;
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (supportsNestedBlockComments && sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      // 未闭合的块注释：原样保留剩余文本（不遮罩），避免破坏用户输入。
      if (depth > 0) {
        out += sql.slice(start);
        i = len;
      } else {
        emit(start, i);
      }
      continue;
    }
    // 行注释 -- ... / # ...（不跨行，但遮罩可防御未来变更）
    const startsDashComment =
      ch === '-' && next === '-' && (dialect !== 'mysql' || isMysqlDashComment(sql[i + 2]));
    if (startsDashComment || (dialect === 'mysql' && ch === '#' && next !== '{')) {
      const start = i;
      i += startsDashComment ? 2 : 1;
      while (i < len && sql[i] !== '\n' && sql[i] !== '\r') i++;
      emit(start, i);
      continue;
    }
    // PostgreSQL dollar-quoted 字符串
    if (dialect === 'postgres' && ch === '$') {
      const tag = dollarQuoteTagAt(i);
      if (tag) {
        const start = i;
        i += tag.length;
        const end = sql.indexOf(tag, i);
        if (end < 0) {
          out += sql.slice(start);
          i = len;
        } else {
          emit(start, end + tag.length);
          i = end + tag.length;
        }
        continue;
      }
    }
    // 单引号字符串（'' 转义；MySQL/PG E'...' 反斜杠转义）
    if (ch === "'") {
      const start = i;
      i++;
      const postgresEscapeString =
        dialect === 'postgres' &&
        (sql[i - 2] === 'E' || sql[i - 2] === 'e') &&
        !isIdentifierPart(sql[i - 3]);
      while (i < len) {
        const c = sql[i];
        if ((dialect === 'mysql' || postgresEscapeString) && c === '\\' && i + 1 < len) {
          i += 2;
          continue;
        }
        if (c === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      emit(start, i);
      continue;
    }
    // 双引号标识符（"" 转义）
    if (ch === '"') {
      const start = i;
      i++;
      while (i < len) {
        if (dialect === 'mysql' && sql[i] === '\\' && i + 1 < len) {
          i += 2;
          continue;
        }
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      emit(start, i);
      continue;
    }
    // 反引号标识符（MySQL）
    if (ch === '`') {
      const start = i;
      i++;
      while (i < len && sql[i] !== '`') i++;
      if (i < len) i++;
      emit(start, i);
      continue;
    }
    // SQLite 方括号标识符 [...]
    if (dialect === 'sqlite' && ch === '[') {
      const start = i;
      i++;
      while (i < len) {
        if (sql[i] === ']') {
          i++;
          break;
        }
        i++;
      }
      emit(start, i);
      continue;
    }
    out += ch;
    i++;
  }
  return { masked: out, spans };
}
function restoreSpans(masked: string, spans: string[]): string {
  return masked.replace(/\x00(\d+)\x00/g, (_, index) => spans[Number(index)] ?? '');
}
function keepLogicalOperatorsOnSameLine(
  sql: string,
  dialect: SqlFormatDialect = 'generic',
): string {
  // 先遮罩块注释/字符串/引号标识符，避免正则命中注释或字面量内部的 AND/OR/XOR
  // （块注释内部跨行的 AND/OR 会被误折叠成空格，破坏用户多行注释格式）。
  const { masked, spans } = maskStringAndCommentSpans(sql, dialect);
  const collapsed = masked
    .replace(/\n[ \t]*(AND|OR|XOR)\b/gi, (match, operator: string, offset: number) => {
      const previousLine = masked.slice(masked.lastIndexOf('\n', offset - 1) + 1, offset);
      const comments = [...previousLine.matchAll(/\x00(\d+)\x00/g)];
      if (comments.some((entry) => /^--|^#(?!\{)/.test(spans[Number(entry[1])]))) return match;
      return ` ${operator}`;
    })
    .replace(/\b(AND|OR|XOR)[ \t]*\n[ \t]*/gi, '$1 ');
  return restoreSpans(collapsed, spans);
}
function normalizeLikeOperatorCase(
  sql: string,
  settings: SqlFormatterSettings,
  dialect: SqlFormatDialect,
): string {
  if ((dialect !== 'mysql' && dialect !== 'sqlite') || settings.keywordCase === 'preserve')
    return sql;
  // sql-formatter classifies LIKE as a reserved function in these dialects,
  // so an operator follows functionCase instead of keywordCase. Only adjust
  // operator-shaped occurrences; keep LIKE(...) functions and qualified
  // identifiers under their existing function/identifier case settings.
  const { masked, spans } = maskStringAndCommentSpans(sql, dialect);
  const keyword = settings.keywordCase === 'upper' ? 'LIKE' : 'like';
  const normalized = masked.replace(
    /(^|[^.\w$:@{#])LIKE\b(?!\s*\()/gi,
    (_match, prefix: string) => `${prefix}${keyword}`,
  );
  return restoreSpans(normalized, spans);
}
function keepFromClauseAndFirstSourceOnSameLine(sql: string, dialect: SqlFormatDialect): string {
  const { masked, spans } = maskStringAndCommentSpans(sql, dialect);
  const lines = masked.split('\n');
  for (let index = 0; index < lines.length - 1; index += 1) {
    const clauseMatch = lines[index].match(/^(\s*)FROM\s*$/i);
    if (!clauseMatch) continue;
    const sourceLine = lines[index + 1];
    const sourceMatch = sourceLine.match(/^(\s+)(\S.*)$/);
    if (!sourceMatch) continue;
    const source = sourceMatch[2];
    // Keep derived tables and leading comments multiline; merging these would
    // make nested SQL and comment boundaries substantially harder to read.
    const spanMatch = source.match(/^\x00(\d+)\x00/);
    const firstSpan = spanMatch ? spans[Number(spanMatch[1])] : '';
    if (source.startsWith('(') || /^\/\*|^--|^#(?!\{)|^'/.test(firstSpan)) continue;
    const clauseIndent = clauseMatch[1];
    const sourceIndent = sourceMatch[1];
    const separator = sourceIndent.startsWith(clauseIndent)
      ? sourceIndent.slice(clauseIndent.length)
      : ' ';
    lines[index] = `${lines[index]}${separator || ' '}${source}`;
    lines.splice(index + 1, 1);
    index -= 1;
  }
  return restoreSpans(lines.join('\n'), spans);
}
/**
 * The text-level passes applied to whatever the formatter produced, whether the
 * default style's layout printer or sql-formatter itself.
 *
 * The two settings-driven passes fix shapes the printer already gets right on
 * its own — it keeps a `FROM` source on the keyword's line and joins operators
 * for `none` — so they are no-ops on its output. They stay because a statement
 * the printer declines falls back to sql-formatter's layout for the whole input,
 * which does break those shapes; see `formatSqlText`. {@link
 * normalizeLikeOperatorCase} is unrelated to either: it corrects a dialect quirk
 * in both paths.
 */
function applySqlFormatterLayout(
  sql: string,
  settings: SqlFormatterSettings,
  dialect: SqlFormatDialect,
): string {
  let formatted = normalizeLikeOperatorCase(sql, settings, dialect);
  if (settings.logicalOperatorNewline === 'none')
    formatted = keepLogicalOperatorsOnSameLine(formatted, dialect);
  if (settings.fromClauseLayout === 'sameLine')
    formatted = keepFromClauseAndFirstSourceOnSameLine(formatted, dialect);
  return formatted;
}
/**
 * sql-formatter throws two distinct shapes when it can't parse the input:
 * - Grammar-level (nearley parser): `Parse error at token: ... ` with `.offset`/`.token`
 *   set on the error, e.g. valid tokens in an unexpected position (mid-edit SQL).
 * - Lexer-level (TokenizerEngine): a plain `Parse error: Unexpected "..." at line ...`
 *   when a character sequence doesn't match any token rule at all — e.g. full-width
 *   punctuation (`≠`, `（`, `）`) that MySQL accepts in identifiers/expressions but
 *   sql-formatter's tokenizer doesn't recognize.
 * Both mean "sql-formatter can't handle this text", so both should fall back to the
 * original SQL instead of surfacing a failure.
 */
function isSqlFormatterParseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.startsWith('Parse error: Unexpected ')) return true;
  if (!error.message.startsWith('Parse error at token:')) return false;
  const candidate = error as Error & {
    offset?: unknown;
    token?: unknown;
  };
  return typeof candidate.offset === 'number' && candidate.token !== undefined;
}
export async function formatSqlForEditing(
  sql: string,
  dialect: SqlFormatDialect = 'generic',
  settings: Partial<SqlFormatterSettings> = DEFAULT_SQL_FORMATTER_SETTINGS,
): Promise<string> {
  try {
    return await formatSqlText(sql, dialect, settings);
  } catch (error) {
    if (isSqlFormatterParseError(error)) return sql;
    throw error;
  }
}
/**
 * 压缩 SQL 时使用的方言。不同方言对引号、注释、转义的处理不同：
 * - `mysql`：保留 MySQL 可执行注释与 optimizer hint；单引号字符串支持反斜杠转义
 * - `postgres`：支持 dollar-quoted 字符串
 * - `sqlite`：支持方括号标识符
 * - `generic` / 其它：仅处理标准单/双引号与块/行注释
 */
export type SqlCompressDialect = SqlFormatDialect;
/**
 * 将 SQL 压缩成一行可执行文本：折叠所有空白（含换行）为单个空格，
 * 移除普通行注释（-- ...）与普通块注释（/* ... *\/），
 * 同时按方言完整保留字符串字面量、引号标识符、可执行注释与 optimizer hint。
 *
 * 方言感知说明：
 * - MySQL：可执行注释作为可执行代码原样保留（仅折叠内部空白）；
 *   optimizer hint 原样保留；单引号字符串内反斜杠转义保留
 * - PostgreSQL：dollar-quoted 字符串原样保留（含标签形式）
 * - SQLite：方括号标识符原样保留（首个右括号结束标识符）
 * - 所有方言：单引号字符串、双引号标识符、反引号标识符均保留
 */
export function compressSqlText(
  sql: string,
  dialect: SqlCompressDialect = 'generic',
  locale?: Locale,
): string {
  if (!sql.trim()) return sql;
  if (sql.length > MAX_SQL_FORMAT_CHARS)
    throw connectorUiMessages.error('sqlIsTooLargeToMinifyMaximumMbOfCharacters');
  const len = sql.length;
  let out = '';
  let i = 0;
  const isWhitespace = (c: string) =>
    c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v';
  const isIdentifierPart = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_$]/.test(c);
  const isMysqlDashComment = (c: string | undefined) =>
    c === undefined || c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127;
  const supportsNestedBlockComments = dialect === 'postgres';
  const dollarQuoteTagAt = (position: number): string | null => {
    if (sql[position] !== '$' || isIdentifierPart(sql[position - 1])) return null;
    if (sql[position + 1] === '$') return '$$';
    if (!/[A-Za-z_]/.test(sql[position + 1] ?? '')) return null;
    let end = position + 2;
    while (/[A-Za-z0-9_]/.test(sql[end] ?? '')) end++;
    return sql[end] === '$' ? sql.slice(position, end + 1) : null;
  };
  // 折叠一段空白为单个空格（仅在 out 非空且不以空格结尾时追加）
  const collapseWhitespace = () => {
    let containsLineBreak = false;
    while (i < len && isWhitespace(sql[i])) i++;
    for (let j = i - 1; j >= 0 && isWhitespace(sql[j]); j--) {
      if (sql[j] === '\n' || sql[j] === '\r') {
        containsLineBreak = true;
        break;
      }
    }
    // PostgreSQL only concatenates adjacent string literals when their separating
    // whitespace contains a newline, so flattening this case would make valid SQL invalid.
    if (
      dialect === 'postgres' &&
      containsLineBreak &&
      out.trimEnd().endsWith("'") &&
      sql[i] === "'"
    ) {
      out = out.trimEnd() + '\n';
    } else if (out && !out.endsWith(' ')) {
      out += ' ';
    }
  };
  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];
    // 块注释 /* ... */ —— 需区分普通块注释、MySQL 可执行注释 /*! */、optimizer hint /*+ */
    if (ch === '/' && next === '*') {
      const third = sql[i + 2];
      const isExecutableMysql = third === '!';
      const isOptimizerHint = third === '+';
      if (isExecutableMysql || isOptimizerHint) {
        const contentStart = i + 3;
        const end = sql.indexOf('*/', contentStart);
        if (end < 0) {
          // Keep malformed input malformed instead of silently turning it into executable SQL.
          out += sql.slice(i);
          break;
        }
        const content = sql.slice(contentStart, end);
        const leadingSpace = /^\s/.test(content) ? ' ' : '';
        const trailingSpace = /\s$/.test(content) ? ' ' : '';
        const compressedContent = content.trim() ? compressSqlText(content, dialect, locale) : '';
        out += `/*${third}${leadingSpace}${compressedContent}${trailingSpace}*/`;
        i = end + 2;
        continue;
      }
      // 普通块注释 —— 移除
      const commentStart = i;
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (supportsNestedBlockComments && sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      if (depth > 0) {
        // Removing an unterminated comment can expose a destructive statement that was invalid before.
        out += sql.slice(commentStart);
        break;
      }
      if (out && !out.endsWith(' ')) out += ' ';
      continue;
    }
    // MySQL additionally supports # comments and requires whitespace/control after --.
    const startsDashComment =
      ch === '-' && next === '-' && (dialect !== 'mysql' || isMysqlDashComment(sql[i + 2]));
    if (startsDashComment || (dialect === 'mysql' && ch === '#' && next !== '{')) {
      i += startsDashComment ? 2 : 1;
      while (i < len && sql[i] !== '\n' && sql[i] !== '\r') i++;
      continue;
    }
    // PostgreSQL dollar-quoted 字符串：$$...$$ 或 $tag$...$tag$
    if (dialect === 'postgres' && ch === '$') {
      const tag = dollarQuoteTagAt(i);
      if (tag) {
        out += tag;
        i += tag.length;
        const end = sql.indexOf(tag, i);
        if (end < 0) {
          out += sql.slice(i);
          break;
        }
        out += sql.slice(i, end + tag.length);
        i = end + tag.length;
        continue;
      }
    }
    // 单引号字符串字面量（处理 '' 转义；MySQL 额外处理反斜杠转义）
    if (ch === "'") {
      out += "'";
      i++;
      const postgresEscapeString =
        dialect === 'postgres' &&
        (sql[i - 2] === 'E' || sql[i - 2] === 'e') &&
        !isIdentifierPart(sql[i - 3]);
      while (i < len) {
        const c = sql[i];
        // MySQL strings and PostgreSQL E'...' strings use backslash escapes.
        if ((dialect === 'mysql' || postgresEscapeString) && c === '\\' && i + 1 < len) {
          out += c;
          out += sql[i + 1];
          i += 2;
          continue;
        }
        out += c;
        if (c === "'") {
          if (sql[i + 1] === "'") {
            out += sql[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // 双引号标识符（处理 "" 转义）
    if (ch === '"') {
      out += '"';
      i++;
      while (i < len) {
        if (dialect === 'mysql' && sql[i] === '\\' && i + 1 < len) {
          out += sql[i];
          out += sql[i + 1];
          i += 2;
          continue;
        }
        out += sql[i];
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            out += sql[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // 反引号标识符（MySQL）
    if (ch === '`') {
      out += '`';
      i++;
      while (i < len && sql[i] !== '`') {
        out += sql[i];
        i++;
      }
      if (i < len) {
        out += '`';
        i++;
      }
      continue;
    }
    // SQLite 方括号标识符 [...]
    if (dialect === 'sqlite' && ch === '[') {
      out += '[';
      i++;
      while (i < len) {
        const c = sql[i];
        out += c;
        if (c === ']') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // 空白 —— 折叠为单个空格
    if (isWhitespace(ch)) {
      collapseWhitespace();
      continue;
    }
    out += ch;
    i++;
  }
  return out.trim();
}
/**
 * Format SQL for *display* (object source, view/table DDL viewers).
 *
 * Unlike `formatSqlText`, this never throws: if the SQL can't be parsed by the
 * formatter (vendor-specific DDL, oversized input, ...) the original text is
 * returned unchanged so the viewer still shows the source. Use this for
 * read-only/auto-format surfaces; use `formatSqlText` where a thrown error
 * should surface to the user (e.g. the explicit "Format SQL" command).
 */
export async function formatSqlForDisplay(
  sql: string,
  dialect: SqlFormatDialect = 'generic',
  settings: Partial<SqlFormatterSettings> = DEFAULT_SQL_FORMATTER_SETTINGS,
): Promise<string> {
  if (!sql.trim()) return sql;
  try {
    return await formatSqlText(sql, dialect, settings);
  } catch {
    return sql;
  }
}
