/** Native MySQL/PostgreSQL/SQLite semantic model adapted from DBX f909f850. */
import { sqlSemanticDialectFor, type SqlSemanticDialectAdapter } from './dialect';
import {
  findActiveSqlStatementSpan,
  isSuppressedSqlSemanticContext,
  tokenIsIdentifier,
  tokenizeSqlSemantic,
  unquoteSqlSemanticIdentifier,
} from '@fouc/shared';
import { resolveSqlStatementWindow } from './statement-window';
import type {
  SqlSemanticBuildOptions,
  SqlSemanticCteOutputColumn,
  SqlSemanticCteStar,
  SqlSemanticCursorIntent,
  SqlSemanticIdentifierPart,
  SqlSemanticModel,
  SqlSemanticProjection,
  SqlSemanticQualifiedName,
  SqlSemanticRowSource,
  SqlSemanticSpan,
  SqlSemanticStatement,
  SqlSemanticStatementKind,
  SqlSemanticToken,
} from './types';

const TABLE_INTRODUCERS = new Set([
  'from',
  'join',
  'straight_join',
  'update',
  'into',
  'using',
  'apply',
]);
const TABLE_FUNCTION_NAMES = new Set([
  'table',
  'xmltable',
  'json_table',
  'the',
  'read_csv',
  'read_parquet',
  'read_json',
  'unnest',
]);
const JOIN_MODIFIERS = new Set(['left', 'right', 'inner', 'outer', 'cross', 'full', 'natural']);
const CLAUSE_BOUNDARIES = new Set([
  'where',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'union',
  'intersect',
  'except',
  'on',
  'set',
  'values',
  'returning',
]);
const FROM_CLAUSE_BOUNDARIES = new Set(
  [...CLAUSE_BOUNDARIES, 'window', 'qualify', 'fetch', 'for', 'connect', 'start', 'model'].filter(
    (item) => item !== 'on',
  ),
);
const ALIAS_BLACKLIST = new Set([
  ...FROM_CLAUSE_BOUNDARIES,
  'on',
  'join',
  'straight_join',
  'left',
  'right',
  'inner',
  'outer',
  'cross',
  'full',
  'natural',
  'as',
  'select',
  'from',
  'with',
  'case',
  'when',
  'then',
  'else',
  'end',
  'distinct',
  'all',
  'null',
  'true',
  'false',
  'over',
  'filter',
  'collate',
  'asc',
  'desc',
]);
const TOP_LEVEL_STATEMENT_WORDS = new Set([
  'select',
  'insert',
  'delete',
  'merge',
  'create',
  'alter',
  'drop',
  'truncate',
  'call',
  'exec',
  'execute',
  'grant',
  'revoke',
]);
// Projection enrichment is bounded; very large bodies retain explicitly named outputs only.
const CTE_ENRICHMENT_STATEMENT_TOKEN_LIMIT = 20_000;
const CTE_ENRICHMENT_BODY_TOKEN_LIMIT = 5_000;

interface ParseState {
  dialect: SqlSemanticDialectAdapter;
  tokens: SqlSemanticToken[];
  statement: SqlSemanticStatement;
  cteSources: SqlSemanticRowSource[];
  expandGroupedSources?: boolean;
  /** Resolve inline projections up to eight levels inside the active statement. */
  enrichDerivedTables?: boolean;
  enrichmentDepth?: number;
}

interface QuerySourceRange {
  depth: number;
  startIndex: number;
  endIndex: number;
}

interface TrailingIdentifier {
  prefix: string;
  replacementRange: SqlSemanticSpan;
  qualifierParts: string[];
}

function significantTokens(tokens: readonly SqlSemanticToken[]): SqlSemanticToken[] {
  return tokens.filter((item) => item.kind !== 'comment');
}

function tokenTextAt(sql: string, span: SqlSemanticSpan): string {
  return sql.slice(span.start, span.end);
}

function firstWord(tokens: readonly SqlSemanticToken[]): string {
  return tokens.find((item) => item.kind === 'word')?.normalized ?? '';
}

function statementKind(tokens: readonly SqlSemanticToken[]): SqlSemanticStatementKind {
  const word = firstWord(tokens);
  if (word === 'with' || word === 'select') return 'select';
  if (word === 'insert') return 'insert';
  if (word === 'update') return 'update';
  if (word === 'delete') return 'delete';
  if (word === 'call' || word === 'exec' || word === 'execute') return 'call';
  return 'unknown';
}

function identifierPart(
  tokenValue: SqlSemanticToken,
  dialect: SqlSemanticDialectAdapter,
): SqlSemanticIdentifierPart {
  const quoted = tokenValue.kind === 'quoted_identifier';
  const raw = unquoteSqlSemanticIdentifier(tokenValue);
  return {
    raw: tokenValue.text,
    name: dialect.normalizeIdentifier(raw, quoted),
    span: tokenValue.span,
    quote: tokenValue.quote,
  };
}

function readQualifiedName(
  tokens: readonly SqlSemanticToken[],
  startIndex: number,
  dialect: SqlSemanticDialectAdapter,
): { name: SqlSemanticQualifiedName; nextIndex: number } | null {
  const parts: SqlSemanticIdentifierPart[] = [];
  let index = startIndex;
  while (index < tokens.length) {
    const current = tokens[index];
    if (!tokenIsIdentifier(current)) break;
    parts.push(identifierPart(current, dialect));
    if (tokens[index + 1]?.text !== '.') {
      index += 1;
      break;
    }
    index += 2;
    if (!tokenIsIdentifier(tokens[index])) return null;
  }
  if (parts.length === 0) return null;
  return {
    name: {
      parts,
      span: {
        start: parts[0]?.span.start ?? tokens[startIndex]?.span.start ?? 0,
        end: parts[parts.length - 1]?.span.end ?? tokens[startIndex]?.span.end ?? 0,
      },
    },
    nextIndex: index,
  };
}

function updateIntroducesMutationTarget(
  tokens: readonly SqlSemanticToken[],
  updateIndex: number,
): boolean {
  const update = tokens[updateIndex];
  if (update?.kind !== 'word' || update.normalized !== 'update') return false;
  for (let index = updateIndex - 1; index >= 0; index -= 1) {
    const item = tokens[index];
    if (!item || item.depth !== update.depth) continue;
    if (item.text === ';') break;
    if (
      item.kind === 'word' &&
      (item.normalized === 'update' || TOP_LEVEL_STATEMENT_WORDS.has(item.normalized))
    )
      return false;
  }
  return true;
}

function sourceNameFromQualifiedName(name: SqlSemanticQualifiedName): {
  name: string;
  qualifierParts: string[];
} {
  const parts = name.parts.map((part) => part.name);
  return {
    name: parts[parts.length - 1] ?? '',
    qualifierParts: parts.slice(0, -1),
  };
}

function findMatchingParenToken(tokens: readonly SqlSemanticToken[], openIndex: number): number {
  if (tokens[openIndex]?.text !== '(') return -1;
  const startDepth = tokens[openIndex]?.depth ?? 0;
  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const item = tokens[index];
    if (item?.text === ')' && item.depth === startDepth) return index;
  }
  return -1;
}

function splitTopLevelByComma(tokens: readonly SqlSemanticToken[]): SqlSemanticToken[][] {
  const groups: SqlSemanticToken[][] = [];
  let current: SqlSemanticToken[] = [];
  const baseDepth = tokens.reduce(
    (min, item) => Math.min(min, item.depth),
    Number.POSITIVE_INFINITY,
  );
  for (const item of tokens) {
    if (item.text === ',' && item.depth === baseDepth) {
      groups.push(current);
      current = [];
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function projectionNameFromTokens(
  tokens: readonly SqlSemanticToken[],
  dialect: SqlSemanticDialectAdapter,
): SqlSemanticProjection | null {
  const useful = tokens.filter((item) => item.kind !== 'comment');
  if (useful.length === 0) return null;
  let asIndex = -1;
  for (let index = useful.length - 1; index >= 0; index -= 1) {
    if (
      useful[index]?.depth === useful[0].depth &&
      useful[index]?.kind === 'word' &&
      useful[index]?.normalized === 'as'
    ) {
      asIndex = index;
      break;
    }
  }
  const aliasToken = asIndex >= 0 ? useful[asIndex + 1] : undefined;
  if (tokenIsIdentifier(aliasToken)) {
    const name = identifierPart(aliasToken, dialect).name;
    return {
      name,
      alias: name,
      aliasSpan: aliasToken.span,
      span: { start: useful[0]?.span.start ?? 0, end: useful[useful.length - 1]?.span.end ?? 0 },
    };
  }
  const last = useful.at(-1)!;
  const previous = useful.at(-2);
  const implicitAlias =
    tokenIsIdentifier(last) &&
    previous &&
    last.depth === useful[0].depth &&
    previous.span.end < last.span.start &&
    (tokenIsIdentifier(previous) ||
      previous.kind === 'number' ||
      previous.kind === 'string' ||
      previous.text === ')') &&
    !ALIAS_BLACKLIST.has(last.normalized);
  if (implicitAlias) {
    const name = identifierPart(last, dialect).name;
    return {
      name,
      alias: name,
      aliasSpan: last.span,
      span: { start: useful[0].span.start, end: last.span.end },
    };
  }
  const plain =
    useful.length % 2 === 1 &&
    useful.every((token, index) =>
      index % 2 === 0 ? tokenIsIdentifier(token) : token.text === '.',
    );
  const name = plain ? identifierPart(last, dialect).name : '';
  return {
    name,
    span: { start: useful[0]?.span.start ?? 0, end: useful[useful.length - 1]?.span.end ?? 0 },
  };
}

function parseSelectProjections(
  tokens: readonly SqlSemanticToken[],
  dialect: SqlSemanticDialectAdapter,
): SqlSemanticProjection[] {
  const baseDepth = tokens.reduce(
    (min, item) => Math.min(min, item.depth),
    Number.POSITIVE_INFINITY,
  );
  const selectDepth = Number.isFinite(baseDepth) ? baseDepth : 0;
  const selectIndex = tokens.findIndex(
    (item) => item.depth === selectDepth && item.kind === 'word' && item.normalized === 'select',
  );
  if (selectIndex < 0) return [];
  let fromIndex = tokens.findIndex(
    (item, index) =>
      index > selectIndex &&
      item.depth === selectDepth &&
      item.kind === 'word' &&
      [
        'from',
        'union',
        'intersect',
        'except',
        'where',
        'group',
        'having',
        'order',
        'limit',
      ].includes(item.normalized),
  );
  if (fromIndex < 0) fromIndex = tokens.length;
  const projectionTokens = selectProjectionTokens(
    tokens.slice(selectIndex + 1, fromIndex),
    dialect,
  );
  return splitTopLevelByComma(projectionTokens)
    .map((group) => projectionNameFromTokens(group, dialect))
    .filter(
      (projection): projection is SqlSemanticProjection =>
        projection != null && projection.name !== '*',
    );
}

function selectProjectionTokens(
  tokens: SqlSemanticToken[],
  dialect: SqlSemanticDialectAdapter,
): SqlSemanticToken[] {
  const modifier = tokens[0];
  if (modifier?.kind !== 'word' || !['distinct', 'all'].includes(modifier.normalized))
    return tokens;
  if (
    modifier.normalized === 'distinct' &&
    dialect.id === 'postgres' &&
    tokens[1]?.normalized === 'on' &&
    tokens[2]?.text === '('
  ) {
    const close = findMatchingParenToken(tokens, 2);
    return close < 0 ? [] : tokens.slice(close + 1);
  }
  return tokens.slice(1);
}

/**
 * Analyzes one comma-separated CTE body SELECT projection for navigation metadata:
 * a bare/qualified star or a named output with an optional plain-column origin.
 */
function cteBodyProjectionShape(
  state: ParseState,
  group: readonly SqlSemanticToken[],
): { output?: SqlSemanticCteOutputColumn; star?: SqlSemanticCteStar } | null {
  const useful = group.filter((item) => item.kind !== 'comment');
  if (useful.length === 0) return null;
  const dialect = state.dialect;

  // Bare `*`
  if (useful.length === 1 && useful[0]?.text === '*') {
    return { star: { starSpan: useful[0].span, qualifierParts: [] } };
  }

  // Qualified `q.*` (possibly a multi-part `a.b.*`) — the whole group must be the star chain.
  const last = useful[useful.length - 1];
  if (last?.text === '*' && useful[useful.length - 2]?.text === '.') {
    const qualifierParts: string[] = [];
    let cursor = useful.length - 3;
    let valid = cursor >= 0;
    while (valid && cursor >= 0) {
      const identifier = useful[cursor];
      if (!identifier || !tokenIsIdentifier(identifier)) {
        valid = false;
        break;
      }
      qualifierParts.unshift(identifierPart(identifier, dialect).name);
      cursor -= 1;
      if (cursor < 0) break;
      if (useful[cursor]?.text !== '.') {
        valid = false;
        break;
      }
      cursor -= 1;
    }
    if (valid && qualifierParts.length > 0) {
      return { star: { starSpan: last.span, qualifierParts } };
    }
  }

  const projection = projectionNameFromTokens(useful, dialect);
  if (!projection || projection.name === '*') return null;

  // A renamed plain column retains its physical type; computed aliases have no inferred type.
  const expression = projection.aliasSpan
    ? useful.filter(
        (token) => token.span.end <= projection.aliasSpan!.start && token.normalized !== 'as',
      )
    : useful;

  // Plain `col` / `q.col` chain (identifiers separated only by dots) — traceable to a body source.
  let isIdentifierChain = expression.length % 2 === 1;
  for (let index = 0; isIdentifierChain && index < expression.length; index += 1) {
    const token = expression[index];
    if (!token) {
      isIdentifierChain = false;
      break;
    }
    if (index % 2 === 0) {
      if (!tokenIsIdentifier(token)) isIdentifierChain = false;
    } else if (token.text !== '.') {
      isIdentifierChain = false;
    }
  }
  if (isIdentifierChain) {
    const identifiers = expression.filter((_, index) => index % 2 === 0);
    const columnToken = identifiers[identifiers.length - 1];
    if (columnToken) {
      return {
        output: {
          name: projection.name,
          jumpSpan: projection.aliasSpan ?? columnToken.span,
          origin: {
            qualifierParts: identifiers
              .slice(0, -1)
              .map((token) => identifierPart(token, dialect).name),
            column: identifierPart(columnToken, dialect).name,
          },
        },
      };
    }
  }

  // Any other expression without an alias — select the whole projection span, no origin.
  return { output: { name: projection.name, jumpSpan: projection.aliasSpan ?? projection.span } };
}

/**
 * CTE-body counterpart of parseSelectProjections that keeps stars and per-projection spans
 * instead of flattening everything to bare column names.
 */
function parseCteBodyProjectionShapes(
  state: ParseState,
  bodyTokens: readonly SqlSemanticToken[],
): { outputs: SqlSemanticCteOutputColumn[]; stars: SqlSemanticCteStar[] } {
  const outputs: SqlSemanticCteOutputColumn[] = [];
  const stars: SqlSemanticCteStar[] = [];
  const baseDepth = bodyTokens.reduce(
    (min, item) => Math.min(min, item.depth),
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(baseDepth)) return { outputs, stars };
  const selectDepth = baseDepth;
  const selectIndex = bodyTokens.findIndex(
    (item) => item.depth === selectDepth && item.kind === 'word' && item.normalized === 'select',
  );
  if (selectIndex < 0) return { outputs, stars };
  let fromIndex = bodyTokens.findIndex(
    (item, index) =>
      index > selectIndex &&
      item.depth === selectDepth &&
      item.kind === 'word' &&
      [
        'from',
        'union',
        'intersect',
        'except',
        'where',
        'group',
        'having',
        'order',
        'limit',
      ].includes(item.normalized),
  );
  if (fromIndex < 0) fromIndex = bodyTokens.length;
  const projectionTokens = selectProjectionTokens(
    bodyTokens.slice(selectIndex + 1, fromIndex),
    state.dialect,
  );
  for (const group of splitTopLevelByComma(projectionTokens)) {
    const shape = cteBodyProjectionShape(state, group);
    if (shape?.output) outputs.push(shape.output);
    if (shape?.star) stars.push(shape.star);
  }
  return { outputs, stars };
}

/** Parses row sources visible inside one CTE body; preceding CTEs are in scope for chaining. */
function parseCteBodySources(
  state: ParseState,
  bodyTokens: readonly SqlSemanticToken[],
  precedingCtes: readonly SqlSemanticRowSource[],
): SqlSemanticRowSource[] {
  if (bodyTokens.length === 0) return [];
  let bodyDepth = Number.POSITIVE_INFINITY;
  for (const token of bodyTokens) bodyDepth = Math.min(bodyDepth, token.depth);
  if (!Number.isFinite(bodyDepth)) return [];
  const first = bodyTokens.find((token) => token.depth === bodyDepth);
  const last = bodyTokens[bodyTokens.length - 1];
  if (!first || !last) return [];
  const bodyState: ParseState = {
    ...state,
    tokens: bodyTokens as SqlSemanticToken[],
    statement: {
      kind: 'select',
      span: { start: first.span.start, end: last.span.end },
    },
    cteSources: precedingCtes as SqlSemanticRowSource[],
  };
  bodyState.cteSources = [...bodyState.cteSources, ...parseCteSources(bodyState)];
  const setBoundary = bodyTokens.findIndex(
    (token) =>
      token.depth === bodyDepth &&
      token.kind === 'word' &&
      ['union', 'intersect', 'except'].includes(token.normalized),
  );
  if (setBoundary >= 0) bodyState.tokens = bodyTokens.slice(0, setBoundary);
  return parseRowSourcesAtDepth(bodyState, bodyDepth);
}

function parseCteDeclarationList(
  state: ParseState,
  first: number,
  definitionScope: SqlSemanticSpan,
): SqlSemanticRowSource[] {
  const tokens = state.tokens;
  const sources: SqlSemanticRowSource[] = [];
  let index = first + 1;
  const recursive = tokens[index]?.normalized === 'recursive';
  if (recursive) index += 1;
  const enrich =
    tokens.length <= CTE_ENRICHMENT_STATEMENT_TOKEN_LIMIT && (state.enrichmentDepth ?? 0) < 8;

  while (index < tokens.length) {
    while (tokens[index]?.text === ',') index += 1;
    const nameToken = tokens[index];
    if (!tokenIsIdentifier(nameToken)) break;
    const namePart = identifierPart(nameToken, state.dialect);
    index += 1;

    const explicitColumns: Array<{ name: string; span: SqlSemanticSpan }> = [];
    if (tokens[index]?.text === '(') {
      const close = findMatchingParenToken(tokens, index);
      if (close > index) {
        for (const part of splitTopLevelByComma(tokens.slice(index + 1, close))) {
          const identifier = part.find(tokenIsIdentifier);
          if (identifier)
            explicitColumns.push({
              name: identifierPart(identifier, state.dialect).name,
              span: identifier.span,
            });
        }
        index = close + 1;
      }
    }

    if (tokens[index]?.normalized === 'as') index += 1;
    while (
      tokens[index]?.kind === 'word' &&
      ['not', 'materialized'].includes(tokens[index].normalized)
    )
      index += 1;
    if (tokens[index]?.text !== '(') break;
    const bodyOpen = index;
    const bodyClose = findMatchingParenToken(tokens, bodyOpen);
    const safeBodyClose = bodyClose < 0 ? tokens.length - 1 : bodyClose;
    const bodyTokens = tokens.slice(bodyOpen + 1, safeBodyClose);

    // columns: unchanged flat name list consumed by completion/intention logic.
    const bodyColumns =
      explicitColumns.length > 0
        ? explicitColumns.map((column) => column.name)
        : parseSelectProjections(bodyTokens, state.dialect).map((projection) => projection.name);

    let cteOutputs: SqlSemanticCteOutputColumn[] | undefined;
    let cteStars: SqlSemanticCteStar[] | undefined;
    let bodySources: SqlSemanticRowSource[] | undefined;
    if (enrich && bodyTokens.length <= CTE_ENRICHMENT_BODY_TOKEN_LIMIT) {
      const shapes = parseCteBodyProjectionShapes(state, bodyTokens);
      cteStars = shapes.stars;
      cteOutputs = shapes.outputs;
      // Derived tables share the same depth budget as nested CTE bodies.
      bodySources = parseCteBodySources(
        { ...state, enrichDerivedTables: true, enrichmentDepth: (state.enrichmentDepth ?? 0) + 1 },
        bodyTokens,
        [...state.cteSources, ...sources],
      );
    }

    sources.push({
      id: `cte:${namePart.name}:${nameToken.span.start}`,
      kind: 'cte',
      name: namePart.name,
      qualifierParts: [],
      sourceSpan: {
        start: nameToken.span.start,
        end: tokens[safeBodyClose]?.span.end ?? nameToken.span.end,
      },
      columns: bodyColumns,
      columnAliases: explicitColumns.length
        ? explicitColumns.map((column) => column.name)
        : undefined,
      definitionScope,
      recursive,
      nameSpan: nameToken.span,
      bodySpan: {
        start: tokens[bodyOpen]?.span.start ?? nameToken.span.start,
        end: tokens[safeBodyClose]?.span.end ?? nameToken.span.end,
      },
      ...(cteOutputs ? { cteOutputs } : {}),
      ...(cteStars ? { cteStars } : {}),
      ...(bodySources ? { bodySources } : {}),
    });
    index = safeBodyClose + 1;

    if (tokens[index]?.text !== ',') break;
    index += 1;
  }
  return sources;
}

function parseCteSources(state: ParseState): SqlSemanticRowSource[] {
  const definitions: SqlSemanticRowSource[] = [];
  for (let index = 0; index < state.tokens.length; index++) {
    const token = state.tokens[index];
    if (token.kind !== 'word' || token.normalized !== 'with') continue;
    const parentIndex = state.tokens.findIndex(
      (candidate) => candidate.span.start === token.parent,
    );
    const closeIndex = parentIndex >= 0 ? findMatchingParenToken(state.tokens, parentIndex) : -1;
    const scope =
      parentIndex >= 0
        ? {
            start: state.tokens[parentIndex].span.end,
            end: closeIndex >= 0 ? state.tokens[closeIndex].span.start : state.statement.span.end,
          }
        : state.statement.span;
    const parsed = parseCteDeclarationList(
      { ...state, cteSources: [...state.cteSources, ...definitions] },
      index,
      scope,
    );
    definitions.push(...parsed);
  }
  return definitions;
}

function correlationColumnsAfter(
  tokens: readonly SqlSemanticToken[],
  index: number,
  dialect: SqlSemanticDialectAdapter,
): { columns: string[]; nextIndex: number } | null {
  if (tokens[index]?.text !== '(') return null;
  const close = findMatchingParenToken(tokens, index);
  if (close < 0) return null;
  const columns = splitTopLevelByComma(tokens.slice(index + 1, close))
    .map((group) => group.find(tokenIsIdentifier))
    .filter((item) => item != null)
    .map((item) => identifierPart(item, dialect).name);
  return { columns, nextIndex: close + 1 };
}

function aliasAfter(
  tokens: readonly SqlSemanticToken[],
  index: number,
  dialect: SqlSemanticDialectAdapter,
  options: { allowCorrelationColumns?: boolean } = {},
): { alias?: string; aliasSpan?: SqlSemanticSpan; columns?: string[]; nextIndex: number } {
  let cursor = index;
  if (tokens[cursor]?.kind === 'word' && tokens[cursor]?.normalized === 'as') cursor += 1;
  const aliasToken = tokens[cursor];
  if (tokenIsIdentifier(aliasToken)) {
    const alias = identifierPart(aliasToken, dialect).name;
    if (aliasToken.kind === 'quoted_identifier' || !ALIAS_BLACKLIST.has(alias.toLowerCase())) {
      const columns =
        options.allowCorrelationColumns === false
          ? null
          : correlationColumnsAfter(tokens, cursor + 1, dialect);
      return {
        alias,
        aliasSpan: aliasToken.span,
        columns: columns?.columns,
        nextIndex: columns?.nextIndex ?? cursor + 1,
      };
    }
  }
  return { nextIndex: index };
}

function mergeColumnAliases(
  columns: readonly string[],
  aliases: readonly string[] | undefined,
): string[] {
  if (!aliases?.length) return [...columns];
  if (columns.length === 0) return [...aliases];
  return columns.map((column, index) => aliases[index] ?? column);
}

function parseSubquerySource(
  state: ParseState,
  openIndex: number,
  introducer: string,
  sourceIndex: number,
): { source: SqlSemanticRowSource; nextIndex: number } | null {
  const close = findMatchingParenToken(state.tokens, openIndex);
  if (close < 0) return null;
  const alias = aliasAfter(state.tokens, close + 1, state.dialect);
  if (!alias.alias) return null;
  const bodyTokens = state.tokens.slice(openIndex + 1, close);
  const columns = mergeColumnAliases(
    parseSelectProjections(bodyTokens, state.dialect).map((projection) => projection.name),
    alias.columns,
  );
  // Preserve original shapes: the resolver applies positional aliases after star expansion.
  let body: Pick<SqlSemanticRowSource, 'cteOutputs' | 'cteStars' | 'bodySources'> = {};
  if (
    state.enrichDerivedTables &&
    (state.enrichmentDepth ?? 0) < 8 &&
    bodyTokens.length <= CTE_ENRICHMENT_BODY_TOKEN_LIMIT
  ) {
    const shapes = parseCteBodyProjectionShapes(state, bodyTokens);
    body = {
      cteOutputs: shapes.outputs,
      cteStars: shapes.stars,
      bodySources: parseCteBodySources(
        { ...state, enrichmentDepth: (state.enrichmentDepth ?? 0) + 1 },
        bodyTokens,
        state.cteSources,
      ),
    };
  }
  return {
    source: {
      id: `${introducer}:subquery:${sourceIndex}`,
      kind: 'subquery',
      name: alias.alias,
      qualifierParts: [],
      alias: alias.alias,
      sourceSpan: {
        start: state.tokens[openIndex]?.span.start ?? 0,
        end:
          state.tokens[alias.nextIndex - 1]?.span.end ??
          alias.aliasSpan?.end ??
          state.tokens[close]?.span.end ??
          0,
      },
      bodySpan: { start: state.tokens[openIndex].span.start, end: state.tokens[close].span.end },
      columns,
      columnAliases: alias.columns,
      ...body,
    },
    nextIndex: alias.nextIndex,
  };
}

function parseTableFunctionSource(
  state: ParseState,
  nameIndex: number,
  introducer: string,
  sourceIndex: number,
): { source: SqlSemanticRowSource; nextIndex: number } | null {
  const isMutationTarget =
    introducer === 'update' ||
    introducer === 'into' ||
    (state.statement.kind === 'delete' && introducer === 'from');
  if (isMutationTarget) return null;
  const qualified = readQualifiedName(state.tokens, nameIndex, state.dialect);
  if (!qualified || state.tokens[qualified.nextIndex]?.text !== '(') return null;
  const { name, qualifierParts } = sourceNameFromQualifiedName(qualified.name);
  if (state.dialect.id !== 'postgres' && !TABLE_FUNCTION_NAMES.has(name.toLowerCase())) return null;
  const close = findMatchingParenToken(state.tokens, qualified.nextIndex);
  const safeClose = close < 0 ? qualified.nextIndex : close;
  let aliasIndex = safeClose + 1;
  if (
    state.dialect.id === 'postgres' &&
    state.tokens[aliasIndex]?.normalized === 'with' &&
    state.tokens[aliasIndex + 1]?.normalized === 'ordinality'
  )
    aliasIndex += 2;
  const alias = aliasAfter(state.tokens, aliasIndex, state.dialect);
  const sourceName = alias.alias ?? name;
  return {
    source: {
      id: `${introducer}:table_function:${sourceIndex}`,
      kind: 'table_function',
      name: sourceName,
      qualifierParts,
      alias: alias.alias,
      sourceSpan: {
        start: qualified.name.span.start,
        end:
          state.tokens[alias.nextIndex - 1]?.span.end ??
          alias.aliasSpan?.end ??
          state.tokens[safeClose]?.span.end ??
          qualified.name.span.end,
      },
      columns: alias.columns,
    },
    nextIndex: alias.nextIndex,
  };
}

function parseTableSource(
  state: ParseState,
  nameIndex: number,
  introducer: string,
  sourceIndex: number,
): { source: SqlSemanticRowSource; nextIndex: number } | null {
  const qualified = readQualifiedName(state.tokens, nameIndex, state.dialect);
  if (!qualified) return null;
  const { name, qualifierParts } = sourceNameFromQualifiedName(qualified.name);
  const alias = aliasAfter(state.tokens, qualified.nextIndex, state.dialect);
  const nextIndex = alias.nextIndex;
  const cte =
    qualifierParts.length === 0
      ? state.cteSources
          .filter(
            (source) =>
              state.dialect.sameIdentifier(source.name, name) &&
              (source.nameSpan?.start ?? 0) < qualified.name.span.start &&
              (!source.definitionScope ||
                (source.definitionScope.start <= qualified.name.span.start &&
                  qualified.name.span.start <= source.definitionScope.end)) &&
              (!source.bodySpan ||
                source.recursive ||
                qualified.name.span.start < source.bodySpan.start ||
                qualified.name.span.start > source.bodySpan.end),
          )
          .sort(
            (left, right) =>
              left.definitionScope!.end -
                left.definitionScope!.start -
                (right.definitionScope!.end - right.definitionScope!.start) ||
              (right.nameSpan?.start ?? 0) - (left.nameSpan?.start ?? 0),
          )[0]
      : undefined;
  const kind = cte
    ? 'cte'
    : introducer === 'update' ||
        introducer === 'into' ||
        (state.statement.kind === 'delete' && introducer === 'from')
      ? 'mutation_target'
      : 'table';
  const source: SqlSemanticRowSource = {
    id: `${introducer}:${name}:${sourceIndex}`,
    kind,
    definitionId: cte?.id,
    name,
    qualifierParts,
    alias: alias.alias,
    sourceSpan: {
      start: qualified.name.span.start,
      end: state.tokens[nextIndex - 1]?.span.end ?? alias.aliasSpan?.end ?? qualified.name.span.end,
    },
    columns: cte?.columns ? mergeColumnAliases(cte.columns, alias.columns) : undefined,
    columnAliases: alias.columns,
  };
  return { source, nextIndex };
}

function isLateralSource(state: ParseState, target: number, introducer: string): boolean {
  if (
    state.dialect.id === 'sqlite' ||
    state.tokens[target]?.normalized !== 'lateral' ||
    (introducer !== 'from' && introducer !== 'join')
  )
    return false;
  const sourceIndex = target + 1;
  if (state.tokens[sourceIndex]?.text === '(') return true;
  const qualified = readQualifiedName(state.tokens, sourceIndex, state.dialect);
  return !!qualified && state.tokens[qualified.nextIndex]?.text === '(';
}

function parseRowSource(
  state: ParseState,
  target: number,
  introducer: string,
  sourceIndex: number,
): { source: SqlSemanticRowSource; nextIndex: number } | null {
  if (isLateralSource(state, target, introducer)) target += 1;
  if (state.dialect.id === 'postgres' && state.tokens[target]?.normalized === 'only') target += 1;
  if (state.tokens[target]?.text === '(')
    return parseSubquerySource(state, target, introducer, sourceIndex);
  return (
    parseTableFunctionSource(state, target, introducer, sourceIndex) ??
    parseTableSource(state, target, introducer, sourceIndex)
  );
}

function parseRowSourceList(
  state: ParseState,
  target: number,
  introducer: string,
  sourceIndex: number,
): { sources: SqlSemanticRowSource[]; nextIndex: number } | null {
  const open = state.tokens[target];
  if (state.expandGroupedSources && open?.text === '(' && open.depth < 128) {
    const close = findMatchingParenToken(state.tokens, target);
    const first = state.tokens[target + 1];
    const isQuery =
      first?.kind === 'word' && (first.normalized === 'select' || first.normalized === 'with');
    if (close >= 0 && !isQuery) {
      // An unaliased parenthesized join is transparent to the surrounding query scope.
      // A SELECT body or an explicitly aliased group must retain its own boundary.
      const from: SqlSemanticToken = {
        ...open,
        kind: 'word',
        text: 'from',
        normalized: 'from',
        depth: open.depth + 1,
      };
      const sources = parseRowSourcesAtDepth(
        { ...state, tokens: [from, ...state.tokens.slice(target + 1, close)] },
        from.depth,
        sourceIndex,
      );
      if (!aliasAfter(state.tokens, close + 1, state.dialect).alias)
        return { sources, nextIndex: close + 1 };
    }
  }
  const parsed = parseRowSource(state, target, introducer, sourceIndex);
  return parsed ? { sources: [parsed.source], nextIndex: parsed.nextIndex } : null;
}

function parseRowSourcesAtDepth(
  state: ParseState,
  sourceDepth: number,
  sourceIndexOffset = 0,
): SqlSemanticRowSource[] {
  const sources: SqlSemanticRowSource[] = [];
  let inSelectFromClause = false;
  for (let index = 0; index < state.tokens.length; index += 1) {
    const item = state.tokens[index];
    if (!item) continue;
    if (item.depth !== sourceDepth) continue;
    if (item.kind === 'word') {
      if (state.statement.kind === 'select' && item.normalized === 'from')
        inSelectFromClause = true;
      else if (inSelectFromClause && FROM_CLAUSE_BOUNDARIES.has(item.normalized))
        inSelectFromClause = false;
    }
    if (inSelectFromClause && item.text === ',') {
      const parsed = parseRowSourceList(
        state,
        index + 1,
        'from',
        sourceIndexOffset + sources.length,
      );
      if (parsed) {
        sources.push(...parsed.sources);
        index = parsed.nextIndex - 1;
      }
      continue;
    }
    if (item.kind !== 'word') continue;
    const normalized = item.normalized;
    if (!TABLE_INTRODUCERS.has(normalized)) continue;
    if (normalized === 'update' && !updateIntroducesMutationTarget(state.tokens, index)) continue;
    if (JOIN_MODIFIERS.has(normalized)) continue;
    let target = index + 1;
    while (JOIN_MODIFIERS.has(state.tokens[target]?.normalized ?? '')) target += 1;
    while (state.tokens[target]?.normalized === 'only') target += 1;
    for (;;) {
      const parsed = parseRowSourceList(
        state,
        target,
        normalized,
        sourceIndexOffset + sources.length,
      );
      if (!parsed) break;
      sources.push(...parsed.sources);
      index = parsed.nextIndex - 1;

      const afterSources = parsed.nextIndex;

      const separator = state.tokens[afterSources];
      if (normalized !== 'from' || separator?.text !== ',' || separator.depth !== sourceDepth)
        break;
      target = afterSources + 1;
    }
  }
  return dedupeSources(sources);
}

function querySourceRanges(
  tokens: readonly SqlSemanticToken[],
  cursor: number,
): QuerySourceRange[] {
  const rootDepth = tokens.reduce(
    (min, item) => Math.min(min, item.depth),
    Number.POSITIVE_INFINITY,
  );
  const fallbackDepth = Number.isFinite(rootDepth) ? rootDepth : 0;
  const cursorDepth =
    [...tokens].reverse().find((item) => item.span.start < cursor)?.depth ?? fallbackDepth;
  const starts = new Map<number, number>();

  for (let index = 0; index < tokens.length; index += 1) {
    const item = tokens[index];
    if (!item || item.span.start >= cursor) break;
    if (item.kind === 'word' && item.normalized === 'select' && item.depth <= cursorDepth) {
      starts.set(item.depth, index);
    }
  }
  if (!starts.has(fallbackDepth)) starts.set(fallbackDepth, 0);

  return [...starts.entries()]
    .sort(([left], [right]) => right - left)
    .map(([depth, startIndex]) => {
      let endIndex = tokens.length;
      for (let index = startIndex + 1; index < tokens.length; index += 1) {
        if (
          (tokens[index]?.depth ?? depth) < depth ||
          (tokens[index]?.depth === depth &&
            ['union', 'intersect', 'except'].includes(tokens[index]?.normalized ?? ''))
        ) {
          endIndex = index;
          break;
        }
      }
      return { depth, startIndex, endIndex };
    });
}

function parseRowSources(state: ParseState, cursor: number): SqlSemanticRowSource[] {
  const ranges = querySourceRanges(state.tokens, cursor);
  const sources: SqlSemanticRowSource[] = [];
  for (const range of ranges) {
    const scopedState = {
      ...state,
      tokens: state.tokens.slice(range.startIndex, range.endIndex),
    };
    sources.push(...parseRowSourcesAtDepth(scopedState, range.depth, sources.length));
  }
  return dedupeSources([...sources, ...state.cteSources]);
}

function dedupeSources(sources: SqlSemanticRowSource[]): SqlSemanticRowSource[] {
  const seen = new Set<string>();
  const result: SqlSemanticRowSource[] = [];
  for (const source of sources) {
    const key = `${source.kind}:${source.name}:${source.alias ?? ''}:${source.sourceSpan.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function trailingIdentifier(
  tokens: readonly SqlSemanticToken[],
  cursor: number,
  dialect: SqlSemanticDialectAdapter,
): TrailingIdentifier {
  const before = tokens.filter(
    (item) => item.span.start < cursor && item.kind !== 'comment' && item.kind !== 'string',
  );
  const last = before[before.length - 1];
  if (!last)
    return { prefix: '', replacementRange: { start: cursor, end: cursor }, qualifierParts: [] };
  if (last.span.end < cursor && last.text !== '.') {
    return { prefix: '', replacementRange: { start: cursor, end: cursor }, qualifierParts: [] };
  }

  let prefix = '';
  let replacementRange: SqlSemanticSpan = { start: cursor, end: cursor };
  let index = before.length - 1;
  let hasQualifier = false;
  if (tokenIsIdentifier(last) && cursor <= last.span.end) {
    const rawPrefix = tokenTextAt(last.text, {
      start: 0,
      end: Math.max(0, cursor - last.span.start),
    });
    prefix =
      last.kind === 'quoted_identifier'
        ? unquoteSqlSemanticIdentifier({
            ...last,
            closed: true,
            text: rawPrefix.endsWith(last.quote === '[' ? ']' : (last.quote ?? ''))
              ? rawPrefix
              : rawPrefix + (last.quote === '[' ? ']' : (last.quote ?? '')),
          })
        : rawPrefix;
    replacementRange = { start: last.span.start, end: cursor };
    index -= 1;
    if (before[index]?.text === '.') {
      hasQualifier = true;
      index -= 1;
    }
  } else if (last.text === '.') {
    hasQualifier = true;
    index -= 1;
  }

  const qualifierParts: string[] = [];
  if (hasQualifier) {
    while (index >= 0) {
      const identifier = before[index];
      if (!tokenIsIdentifier(identifier)) break;
      qualifierParts.unshift(identifierPart(identifier, dialect).name);
      if (before[index - 1]?.text !== '.') break;
      index -= 2;
    }
  }

  return { prefix, replacementRange, qualifierParts };
}

function previousWord(tokens: readonly SqlSemanticToken[], cursor: number): string {
  const before = tokens.filter((item) => item.span.end <= cursor && item.kind !== 'comment');
  return nearestPreviousSyntaxWord(before);
}

function wordBeforePosition(tokens: readonly SqlSemanticToken[], position: number): string {
  const before = tokens.filter((item) => item.span.end <= position && item.kind !== 'comment');
  return nearestPreviousSyntaxWord(before);
}

function wordBeforeTrailingIdentifier(
  tokens: readonly SqlSemanticToken[],
  cursor: number,
  trailing: TrailingIdentifier,
): string {
  const before = tokens.filter((item) => item.span.end <= cursor && item.kind !== 'comment');
  let index = before.length - 1;
  let identifiersToSkip = trailing.qualifierParts.length + (trailing.prefix ? 1 : 0);
  while (index >= 0 && identifiersToSkip > 0) {
    if (before[index]?.text === '.') {
      index -= 1;
      continue;
    }
    if (!tokenIsIdentifier(before[index])) break;
    identifiersToSkip -= 1;
    index -= 1;
  }
  return nearestPreviousSyntaxWord(before.slice(0, index + 1));
}

/**
 * Scans backward from the end of `before` for the nearest unquoted syntax word.
 * A quoted identifier is a barrier: its object name must not participate in
 * keyword comparisons even when it is named `from`, `join`, or `update`.
 */
function nearestPreviousSyntaxWord(tokens: readonly SqlSemanticToken[]): string {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const item = tokens[index];
    if (!item) continue;
    if (item.kind === 'word') return item.normalized;
    if (item.kind === 'quoted_identifier') return '';
    if (item.text === '.' || item.kind === 'comment') continue;
    break;
  }
  return '';
}

function isTableListContinuation(tokens: readonly SqlSemanticToken[], position: number): boolean {
  const before = tokens.filter((item) => item.span.end <= position && item.kind !== 'comment');
  let commaIndex = before.length - 1;
  while (
    commaIndex >= 0 &&
    (tokenIsIdentifier(before[commaIndex]) || before[commaIndex]?.text === '.')
  )
    commaIndex -= 1;
  const comma = before[commaIndex];
  if (comma?.text !== ',') return false;
  const depth = comma.depth;
  for (let index = commaIndex - 1; index >= 0; index -= 1) {
    const token = before[index];
    if (!token || token.depth !== depth || token.kind !== 'word') continue;
    if (
      TABLE_INTRODUCERS.has(token.normalized) ||
      token.normalized === 'from' ||
      token.normalized === 'join'
    )
      return true;
    if (CLAUSE_BOUNDARIES.has(token.normalized) || token.normalized === 'select') return false;
  }
  return false;
}

function hasWordBefore(tokens: readonly SqlSemanticToken[], cursor: number, word: string): boolean {
  return tokens.some(
    (item) => item.span.end <= cursor && item.kind === 'word' && item.normalized === word,
  );
}

function isBeforeWord(tokens: readonly SqlSemanticToken[], cursor: number, word: string): boolean {
  const target = tokens.find(
    (item) => item.span.start >= cursor && item.kind === 'word' && item.normalized === word,
  );
  return !!target;
}

function sourceForQualifier(
  sources: readonly SqlSemanticRowSource[],
  qualifierParts: readonly string[],
  dialect: SqlSemanticDialectAdapter,
): SqlSemanticRowSource | undefined {
  const qualifier = qualifierParts[qualifierParts.length - 1];
  if (!qualifier) return undefined;
  return sources.find(
    (source) =>
      (source.alias
        ? dialect.sameIdentifier(source.alias, qualifier)
        : dialect.sameIdentifier(source.name, qualifier)) && !source.id.startsWith('cte:'),
  );
}

function starQualifierParts(
  before: readonly SqlSemanticToken[],
  starIndex: number,
  dialect: SqlSemanticDialectAdapter,
): string[] {
  let index = starIndex - 1;
  if (before[index]?.text !== '.') return [];
  index -= 1;
  const qualifierParts: string[] = [];
  while (index >= 0) {
    const identifier = before[index];
    if (!tokenIsIdentifier(identifier)) break;
    qualifierParts.unshift(identifierPart(identifier, dialect).name);
    if (before[index - 1]?.text !== '.') break;
    index -= 2;
  }
  return qualifierParts;
}

function buildCursorIntent(
  tokens: readonly SqlSemanticToken[],
  cursor: number,
  sources: readonly SqlSemanticRowSource[],
  dialect: SqlSemanticDialectAdapter,
  suppressed: boolean,
  kind: SqlSemanticStatementKind,
): SqlSemanticCursorIntent {
  if (suppressed) {
    return {
      kind: 'suppressed',
      prefix: '',
      replacementRange: { start: cursor, end: cursor },
      qualifierParts: [],
      expectedObjectKinds: [],
      confidence: 'high',
      fallbackReason: 'comment_or_string',
    };
  }
  const trailing = trailingIdentifier(tokens, cursor, dialect);
  const previous = previousWord(tokens, cursor);
  const targetSource = sourceForQualifier(sources, trailing.qualifierParts, dialect);
  const before = tokens.filter((item) => item.span.end <= cursor);
  const last = before[before.length - 1];
  const wordBeforeReplacement = wordBeforePosition(tokens, trailing.replacementRange.start);
  const wordBeforeTrailing = wordBeforeTrailingIdentifier(tokens, cursor, trailing);
  const tableListContinuation = isTableListContinuation(tokens, trailing.replacementRange.start);

  if (last?.text === '*' || trailing.prefix === '*') {
    const starIndex = last?.text === '*' ? before.length - 1 : -1;
    const qualifierParts =
      starIndex >= 0 ? starQualifierParts(before, starIndex, dialect) : trailing.qualifierParts;
    const starTarget = sourceForQualifier(sources, qualifierParts, dialect);
    const replacementRange =
      last?.text === '*'
        ? { start: last.span.start, end: Math.min(cursor, last.span.end) }
        : trailing.replacementRange;
    return {
      kind: 'star',
      prefix: '*',
      replacementRange,
      qualifierParts,
      targetSourceId: starTarget?.id,
      expectedObjectKinds: ['column'],
      confidence: 'high',
    };
  }

  if (kind === 'call') {
    return {
      kind: 'routine',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      expectedObjectKinds: ['routine', 'procedure', 'function'],
      confidence: 'high',
    };
  }

  if (
    kind === 'insert' &&
    hasWordBefore(tokens, cursor, 'into') &&
    !hasWordBefore(tokens, cursor, 'values')
  ) {
    const mutationTarget = sources.find((source) => source.kind === 'mutation_target');
    return {
      kind: 'insert_column',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      targetSourceId: mutationTarget?.id,
      expectedObjectKinds: ['column'],
      confidence: mutationTarget ? 'medium' : 'low',
      fallbackReason: mutationTarget ? undefined : 'unresolved_insert_target',
    };
  }

  if (
    trailing.qualifierParts.length > 0 &&
    (previous === 'from' ||
      previous === 'join' ||
      TABLE_INTRODUCERS.has(previous) ||
      TABLE_INTRODUCERS.has(wordBeforeReplacement) ||
      TABLE_INTRODUCERS.has(wordBeforeTrailing) ||
      (!!targetSource &&
        !targetSource.alias &&
        trailing.replacementRange.start >= targetSource.sourceSpan.start &&
        trailing.replacementRange.start <= targetSource.sourceSpan.end + 1 &&
        TABLE_INTRODUCERS.has(wordBeforePosition(tokens, targetSource.sourceSpan.start))))
  ) {
    return {
      kind: 'table',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      expectedObjectKinds: ['table', 'view'],
      confidence: 'medium',
    };
  }

  if (trailing.qualifierParts.length > 0 && targetSource) {
    return {
      kind: 'alias_column',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      targetSourceId: targetSource.id,
      expectedObjectKinds: ['column'],
      confidence: 'high',
    };
  }

  if (
    TABLE_INTRODUCERS.has(previous) ||
    TABLE_INTRODUCERS.has(wordBeforeReplacement) ||
    TABLE_INTRODUCERS.has(wordBeforeTrailing) ||
    previous === 'from' ||
    previous === 'join' ||
    wordBeforeReplacement === 'from' ||
    wordBeforeReplacement === 'join' ||
    tableListContinuation
  ) {
    return {
      kind: 'table',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      expectedObjectKinds: ['table', 'view'],
      confidence: 'high',
    };
  }

  if (previous === 'call' || previous === 'exec' || previous === 'execute') {
    return {
      kind: 'routine',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      expectedObjectKinds: ['routine', 'procedure', 'function'],
      confidence: 'high',
    };
  }

  if (previous === 'set') {
    return {
      kind: 'update_column',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      expectedObjectKinds: ['column'],
      confidence: sources.length > 0 ? 'medium' : 'low',
      fallbackReason: sources.length > 0 ? undefined : 'unresolved_update_target',
    };
  }

  if (
    ['where', 'on', 'and', 'or', 'having', 'by', 'select'].includes(previous) &&
    sources.length > 0 &&
    !isBeforeWord(tokens, cursor, 'from')
  ) {
    return {
      kind: previous === 'on' ? 'join_condition' : 'column',
      prefix: trailing.prefix,
      replacementRange: trailing.replacementRange,
      qualifierParts: trailing.qualifierParts,
      expectedObjectKinds: ['column'],
      confidence: 'medium',
    };
  }

  return {
    kind: 'keyword',
    prefix: trailing.prefix,
    replacementRange: trailing.replacementRange,
    qualifierParts: trailing.qualifierParts,
    expectedObjectKinds: [],
    confidence: 'low',
    fallbackReason: 'keyword_context',
  };
}

export function buildSqlSemanticModel(
  sql: string,
  cursor: number,
  options: SqlSemanticBuildOptions = {},
): SqlSemanticModel {
  const safeCursor = Math.max(0, Math.min(cursor, sql.length));
  const dialect = sqlSemanticDialectFor(options);
  const window = resolveSqlStatementWindow(sql, safeCursor, options.editorState, dialect.id);
  const windowSql = sql.slice(window.from, window.to);
  const windowCursor = safeCursor - window.from;
  const localTokens = tokenizeSqlSemantic(windowSql, dialect.id);
  const localStatementSpan = findActiveSqlStatementSpan(windowSql, localTokens, windowCursor);
  const allTokens = localTokens.map((token) => ({
    ...token,
    span: { start: token.span.start + window.from, end: token.span.end + window.from },
    parent: token.parent === null ? null : token.parent + window.from,
  }));
  const statementSpan = {
    start: localStatementSpan.start + window.from,
    end: localStatementSpan.end + window.from,
  };
  const tokens = significantTokens(
    allTokens.filter(
      (item) => item.span.end > statementSpan.start && item.span.start < statementSpan.end,
    ),
  );
  const kind = statementKind(tokens);
  const statement: SqlSemanticStatement = {
    kind,
    span: statementSpan,
  };
  const suppressed = isSuppressedSqlSemanticContext(allTokens, safeCursor);
  const parseState: ParseState = {
    dialect,
    tokens,
    statement,
    cteSources: [],
    expandGroupedSources: true,
    enrichDerivedTables: true,
  };
  parseState.cteSources = parseCteSources(parseState);
  const rowSources = parseRowSources(parseState, safeCursor);
  const activeQuery = querySourceRanges(tokens, safeCursor)[0];
  const projections = parseSelectProjections(
    activeQuery ? tokens.slice(activeQuery.startIndex, activeQuery.endIndex) : tokens,
    dialect,
  );
  const cursorIntent = buildCursorIntent(tokens, safeCursor, rowSources, dialect, suppressed, kind);
  return {
    provider: dialect.id,
    cursor: safeCursor,
    tokens: allTokens,
    rowSources,
    projections,
    cursorIntent,
  };
}
