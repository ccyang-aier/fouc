import { MySQL, PostgreSQL, SQLite } from '@codemirror/lang-sql';
import { splitSqlExecutionRanges, tokenIsIdentifier, tokenizeSqlSemantic, type RelationalProvider } from '@fouc/shared';
import { sqlSemanticDialectFor } from '../../sql-semantic/dialect';
import { visibleProjectionAliases } from '../../sql-semantic/sources';
import type { SqlSemanticModel, SqlSemanticRowSource, SqlSemanticSpan, SqlSemanticToken } from '../../sql-semantic/types';
import { sqlErrorDecorationRange, sqlErrorSqlMatchesEditor } from './error-locations';
import { identifierKey, MAX_SQL_ASSISTANCE_LENGTH, MAX_SQL_ASSISTANCE_TOKENS, queryBlockAt, sourceTokenSpans, sqlQueryBlocks, tableReferenceKey, tokenName } from './model-context';

export interface SqlSemanticDiagnostic {
  span: SqlSemanticSpan;
  message: string;
  severity: 'error' | 'warning';
  source: 'lexical' | 'reference' | 'metadata';
}

export interface SqlDiagnosticColumn { name: string; dataType?: string; comment?: string | null }
export interface SqlSemanticDiagnosticSchema {
  /** Metadata has meaning only for this exact editor source. */
  sql?: string;
  columnsByTable: ReadonlyMap<string, readonly SqlDiagnosticColumn[]>;
  loadedColumnTables?: ReadonlySet<string>;
  /** Only confirmed missing tables; an unloaded catalog is never a missing table. */
  missingTables?: ReadonlySet<string>;
}

export interface SqlSemanticDiagnosticVisibleRange { from: number; to: number }

export function sqlSemanticDiagnosticRangesForViewport(sql: string, visibleRanges: readonly SqlSemanticDiagnosticVisibleRange[], provider: RelationalProvider) {
  if (!visibleRanges.length) return [];
  return splitSqlExecutionRanges(sql, provider).filter((statement) => visibleRanges.some((visible) => statement.from < visible.to && visible.from < statement.to));
}

/** Preserve DBX's distinction between input-in-progress and resolved semantic errors. */
export function isSqlSemanticDiagnosticInputContext(sql: string, cursor: number, provider: RelationalProvider): boolean {
  const tokens = tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment' && token.span.start < cursor);
  const last = tokens.at(-1);
  if (!last) return false;
  if (last.text === '.') return true;
  const previous = tokens.at(-2);
  return last.kind === 'word' && ['from', 'join', 'update', 'into', 'table'].includes(last.normalized)
    || !!previous && previous.kind === 'word' && ['from', 'join', 'update', 'into', 'table'].includes(previous.normalized) && cursor <= last.span.end;
}

export function shouldRunSqlSemanticDiagnostics(sql: string, cursor: number, provider: RelationalProvider): boolean {
  return sql.length <= MAX_SQL_ASSISTANCE_LENGTH && !isSqlSemanticDiagnosticInputContext(sql, cursor, provider);
}

export function buildSqlParserErrorDiagnostic(error: unknown, sql: string, provider: RelationalProvider): SqlSemanticDiagnostic | null {
  const message = error instanceof Error ? error.message : String(error);
  const range = sqlErrorDecorationRange(sql, message, provider);
  return range ? { span: { start: range.from, end: range.to }, message, severity: 'error', source: 'lexical' } : null;
}

export function areSqlSemanticDiagnosticsEqual(left: readonly SqlSemanticDiagnostic[], right: readonly SqlSemanticDiagnostic[]): boolean {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return !!other && item.message === other.message && item.severity === other.severity && item.source === other.source && item.span.start === other.span.start && item.span.end === other.span.end;
  });
}

/** Known empty metadata is different from an unloaded table. CTE stars remain uncertain until expanded. */
export function columnsForTable(source: SqlSemanticRowSource, model: SqlSemanticModel, schema?: SqlSemanticDiagnosticSchema): readonly SqlDiagnosticColumn[] | null {
  const definition = source.definitionId ? model.rowSources.find((candidate) => candidate.id === source.definitionId) : source;
  if (!definition) return null;
  if (source.columnAliases?.length) return source.columnAliases.map((name) => ({ name }));
  if (definition.columnAliases?.length) return definition.columnAliases.map((name) => ({ name }));
  if (definition.kind === 'cte' || definition.kind === 'subquery') {
    if (definition.cteStars?.length || definition.cteOutputs === undefined || definition.cteOutputs.some((output) => !output.name)) return null;
    return definition.cteOutputs.map((output) => ({ name: output.name }));
  }
  if (definition.kind === 'table_function') return definition.columns?.length ? definition.columns.map((name) => ({ name })) : null;
  if (!schema) return null;
  const exact = tableReferenceKey(source, model.provider);
  const bare = identifierKey(source.name, model.provider);
  const keys = [exact];
  if (!source.qualifierParts.length) {
    const suffixMatches = [...schema.columnsByTable.keys()].filter((key) => identifierKey(key, model.provider).endsWith('.' + bare));
    if (suffixMatches.length === 1) keys.push(suffixMatches[0]);
    if (!keys.includes(bare)) keys.push(bare);
  }
  for (const key of keys) {
    const columns = schema.columnsByTable.get(key);
    if (columns && (columns.length > 0 || schema.loadedColumnTables?.has(key))) return columns;
  }
  return schema.loadedColumnTables?.has(exact) ? [] : null;
}

function lexicalDiagnostics(tokens: readonly SqlSemanticToken[]): SqlSemanticDiagnostic[] {
  const diagnostics: SqlSemanticDiagnostic[] = [];
  const opens: SqlSemanticToken[] = [];
  for (const token of tokens) {
    if (token.closed === false) {
      const label = token.kind === 'comment' ? '块注释' : token.kind === 'quoted_identifier' ? '引用标识符' : token.quote?.startsWith('$') ? '美元引用字符串' : '字符串';
      diagnostics.push({ span: { start: token.span.start, end: Math.min(token.span.end, token.span.start + Math.max(token.quote?.length ?? 2, 1)) }, message: `${label}尚未闭合`, severity: 'warning', source: 'lexical' });
    }
    if (token.kind !== 'punctuation') continue;
    if (token.text === '(') opens.push(token);
    if (token.text === ')') {
      if (opens.length) opens.pop();
      else diagnostics.push({ span: token.span, message: '右括号没有对应的左括号', severity: 'error', source: 'lexical' });
    }
  }
  for (const token of opens) diagnostics.push({ span: token.span, message: '左括号尚未闭合', severity: 'warning', source: 'lexical' });
  return diagnostics;
}

/** DBX metadata/reference checks adapted to native UTF-16 spans and the existing scoped source model. */
export function buildSqlSemanticDiagnostics(sql: string, provider: RelationalProvider, metadata?: SqlSemanticDiagnosticSchema): SqlSemanticDiagnostic[] {
  if (sql.length > MAX_SQL_ASSISTANCE_LENGTH) return [];
  const tokens = tokenizeSqlSemantic(sql, provider);
  if (tokens.length > MAX_SQL_ASSISTANCE_TOKENS) return [];
  const diagnostics = lexicalDiagnostics(tokens);
  if (diagnostics.length) return diagnostics;
  const schema = metadata?.sql !== undefined && !sqlErrorSqlMatchesEditor(sql, metadata.sql) ? undefined : metadata;
  const useful = tokens.filter((token) => token.kind !== 'comment');
  const blocks = sqlQueryBlocks(sql, provider, useful);
  const dialect = sqlSemanticDialectFor({ provider });
  const spec = (provider === 'mysql' ? MySQL : provider === 'postgres' ? PostgreSQL : SQLite).spec;
  const keywords = new Set([spec.keywords, spec.builtin, spec.types, 'true false null current_date current_time current_timestamp'].filter(Boolean).join(' ').toLowerCase().split(/\s+/));
  const syntaxWords = new Set('select from join inner left right full cross outer natural on using where group by having order asc desc limit offset fetch first next rows row only with recursive materialized as union intersect except all distinct update set delete insert into values returning case when then else end and or xor not is in like ilike between exists null true false over partition range unbounded following preceding filter window collate lateral for lock share of interval cast current_date current_time current_timestamp'.split(' '));
  const templates = [...sql.matchAll(/(?:\$|#)\{[^}\r\n]*\}/g)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  const reported = new Set<string>();
  const push = (span: SqlSemanticSpan, message: string, source: SqlSemanticDiagnostic['source']) => {
    const key = `${span.start}:${span.end}:${message}`;
    if (reported.has(key) || diagnostics.length >= 64) return;
    reported.add(key);
    diagnostics.push({ span, message, severity: 'warning', source });
  };
  for (const block of blocks) {
    const aliases = new Map<string, SqlSemanticRowSource[]>();
    for (const source of block.sources) {
      const key = identifierKey(source.alias ?? source.name, provider);
      aliases.set(key, [...(aliases.get(key) ?? []), source]);
      if (source.kind === 'table' && !(provider === 'mysql' && !source.qualifierParts.length && source.name.toLowerCase() === 'dual') && schema?.missingTables?.has(tableReferenceKey(source, provider))) {
        push(sourceTokenSpans(source, useful, provider).name, `已确认当前目录不存在表 ${[...source.qualifierParts, source.name].join('.')}`, 'metadata');
      }
    }
    for (const sources of aliases.values()) {
      if (sources.length < 2) continue;
      for (const source of sources) push(sourceTokenSpans(source, useful, provider).alias ?? sourceTokenSpans(source, useful, provider).name, `来源名称 ${source.alias ?? source.name} 在当前查询块中重复`, 'reference');
    }
  }
  for (let index = 0; index < useful.length; index++) {
    const token = useful[index];
    if (!tokenIsIdentifier(token) || token.kind === 'word' && (syntaxWords.has(token.normalized) || /^[@$]/.test(token.text))) continue;
    if (templates.some((span) => span.start <= token.span.start && token.span.end <= span.end)) continue;
    const block = queryBlockAt(blocks, token.span.start);
    if (!block) continue;
    // SQL dialect lists contain nonreserved identifiers such as PostgreSQL `id`.
    // A plain projection token or a known field can still be a column reference.
    if (token.kind === 'word' && keywords.has(token.normalized)
      && !block.model.projections.some((projection) => !projection.alias && projection.name && projection.span.start <= token.span.start && token.span.end <= projection.span.end)
      && !block.visible.some((source) => columnsForTable(source, block.model, schema)?.some((column) => dialect.columnKey(column.name) === dialect.columnKey(tokenName(token, provider))))) continue;
    if (block.visible.some((source) => {
      const spans = sourceTokenSpans(source, useful, provider);
      return spans.name.start <= token.span.start && token.span.end <= spans.name.end || spans.alias?.start === token.span.start;
    })) continue;
    if (block.model.projections.some((projection) => projection.aliasSpan?.start === token.span.start)) continue;
    if (useful[index + 1]?.text === '(' || useful[index - 1]?.text === '::' || useful[index - 1]?.normalized === 'collate') continue;
    const name = tokenName(token, provider);
    // Qualified functions and catalog.schema.table chains are not alias.column references.
    if (useful[index + 1]?.text === '.') {
      const field = useful[index + 2];
      if ((!tokenIsIdentifier(field) && field?.text !== '*') || useful[index - 1]?.text === '.' || useful[index + 3]?.text === '.' || useful[index + 3]?.text === '(') continue;
      const key = identifierKey(name, provider);
      const sources = block.visible.filter((source) => identifierKey(source.alias ?? source.name, provider) === key);
      if (!sources.length) push(token.span, `当前查询块没有定义来源 ${name}`, 'reference');
      else if (sources.length === 1 && tokenIsIdentifier(field)) {
        const source = sources[0];
        const columns = columnsForTable(source, block.model, schema);
        if (columns && !schema?.missingTables?.has(tableReferenceKey(source, provider)) && !columns.some((column) => dialect.columnKey(column.name) === dialect.columnKey(tokenName(field, provider)))) {
          push(field.span, `已知来源 ${name} 没有字段 ${tokenName(field, provider)}`, 'metadata');
        }
      }
      continue;
    }
    if (useful[index - 1]?.text === '.' || useful[index + 1]?.kind === 'string' && useful[index + 1].span.start === token.span.end) continue;
    const sources = block.visible;
    if (!sources.length) continue;
    const columns = sources.map((source) => columnsForTable(source, block.model, schema));
    if (columns.some((fields) => fields === null) || sources.some((source) => schema?.missingTables?.has(tableReferenceKey(source, provider)))) continue;
    if (visibleProjectionAliases({ ...block.model, cursor: token.span.end }).some((alias) => dialect.columnKey(alias) === dialect.columnKey(name))) continue;
    const matches = columns.filter((fields) => fields!.some((column) => dialect.columnKey(column.name) === dialect.columnKey(name)));
    if (matches.length > 1) push(token.span, `字段 ${name} 来自多个已知来源，请加上来源限定`, 'metadata');
    else if (!matches.length) push(token.span, `当前已知来源中没有字段 ${name}`, 'metadata');
  }
  return diagnostics.sort((left, right) => left.span.start - right.span.start || left.span.end - right.span.end);
}
