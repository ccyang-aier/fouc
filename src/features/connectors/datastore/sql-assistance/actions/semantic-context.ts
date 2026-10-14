import {
  findActiveSqlStatementSpan,
  tokenIsIdentifier,
  unquoteSqlSemanticIdentifier,
  type RelationalProvider,
  type SqlSemanticSpan,
} from '@fouc/shared';
import { buildSqlSemanticModel as buildNativeModel } from '../../sql-semantic/model';
import { visibleSqlSources } from '../../sql-semantic/sources';
import { sqlSemanticDialectFor } from '../../sql-semantic/dialect';
import type {
  SqlSemanticModel as NativeModel,
  SqlSemanticRowSource,
} from '../../sql-semantic/types';

export type SqlSemanticScope = {
  span: SqlSemanticSpan;
  rowSources: SqlSemanticRowSource[];
  projections: NativeModel['projections'];
  clauseSpans: Partial<
    Record<
      'select' | 'from' | 'where' | 'having' | 'groupBy' | 'orderBy' | 'limit',
      SqlSemanticSpan
    >
  >;
};
export type SqlSemanticModel = NativeModel & { scopes: SqlSemanticScope[] };

/** Use Fouc's existing native lexer and correlation barriers for DBX intention scopes. */
export function buildSqlSemanticModel(
  sql: string,
  cursor: number,
  options: { databaseType?: RelationalProvider; dialect?: RelationalProvider } = {},
): SqlSemanticModel {
  const model = buildNativeModel(sql, cursor, {
    provider: options.databaseType ?? options.dialect ?? 'mysql',
  });
  const token =
    model.tokens.find((item) => item.span.start < cursor && cursor <= item.span.end) ??
    model.tokens.findLast((item) => item.span.end <= cursor);
  let parent = token?.parent ?? null;
  const ancestors: Array<number | null> = [];
  while (true) {
    ancestors.push(parent);
    if (parent === null) break;
    parent = model.tokens.find((item) => item.span.start === parent)?.parent ?? null;
  }
  const selects = model.tokens.filter(
    (item) =>
      item.kind === 'word' &&
      item.normalized === 'select' &&
      item.span.start <= cursor &&
      ancestors.includes(item.parent),
  );
  const select = selects.sort(
    (left, right) =>
      ancestors.indexOf(left.parent) - ancestors.indexOf(right.parent) ||
      right.span.start - left.span.start,
  )[0];
  const queryParent = select?.parent ?? ancestors[0];
  const opening =
    queryParent === null ? null : model.tokens.find((item) => item.span.start === queryParent);
  const closing =
    opening &&
    model.tokens.find(
      (item) => item.text === ')' && item.span.start > cursor && item.depth === opening.depth,
    );
  const statement = findActiveSqlStatementSpan(sql, model.tokens, cursor);
  const span = {
    start: select?.span.start ?? statement.start,
    end: closing?.span.start ?? statement.end,
  };
  const clauseSpans: SqlSemanticScope['clauseSpans'] = {};
  const local = model.tokens.filter(
    (item) =>
      item.parent === queryParent && span.start <= item.span.start && item.span.end <= span.end,
  );
  for (const item of local) {
    if (item.kind !== 'word') continue;
    const key =
      item.normalized === 'group'
        ? 'groupBy'
        : item.normalized === 'order'
          ? 'orderBy'
          : item.normalized;
    if (['select', 'from', 'where', 'having', 'groupBy', 'orderBy', 'limit'].includes(key))
      clauseSpans[key as keyof typeof clauseSpans] = item.span;
  }
  const visible = visibleSqlSources(model);
  const owned = visible.filter(
    (source) =>
      model.tokens.find((item) => item.span.start === source.sourceSpan.start)?.parent ===
      queryParent,
  );
  return {
    ...model,
    scopes: [
      {
        span,
        rowSources: owned.length ? owned : visible,
        projections: model.projections,
        clauseSpans,
      },
    ],
  };
}

export function resolveSqlSemanticNavigationTarget(
  model: SqlSemanticModel,
  qualifierParts: string[],
): SqlSemanticRowSource | null {
  if (!qualifierParts.length) return null;
  const dialect = sqlSemanticDialectFor({ provider: model.provider });
  const qualifier = qualifierParts.at(-1)!;
  return (
    visibleSqlSources(model).find((source) =>
      dialect.sameIdentifier(source.alias ?? source.name, qualifier),
    ) ?? null
  );
}

export function quoteTableIdentifier(
  provider: RelationalProvider | undefined,
  name: string,
): string {
  return provider ? sqlSemanticDialectFor({ provider }).quoteIdentifier(name) : name;
}
export function supportsColumnNameQuoting(provider?: RelationalProvider): boolean {
  return Boolean(provider);
}

/** Full original spans retain quotes/dots; syntax and literals never become table targets. */
export function identifierAtCursor(
  sql: string,
  cursor: number,
  provider: RelationalProvider,
): { start: number; end: number; parts: string[] } | null {
  const model = buildNativeModel(sql, cursor, { provider });
  if (model.cursorIntent.kind === 'suppressed') return null;
  const tokens = model.tokens.filter((item) => item.kind !== 'comment');
  const found = tokens.findIndex((item) => item.span.start <= cursor && cursor < item.span.end);
  let index = found;
  if (index < 0 && cursor > 0)
    index = tokens.findIndex((item) => item.span.start < cursor && cursor <= item.span.end);
  if (index < 0 || !tokenIsIdentifier(tokens[index])) return null;
  let first = index,
    last = index;
  while (first >= 2 && tokens[first - 1].text === '.' && tokenIsIdentifier(tokens[first - 2]))
    first -= 2;
  while (
    last + 2 < tokens.length &&
    tokens[last + 1].text === '.' &&
    tokenIsIdentifier(tokens[last + 2])
  )
    last += 2;
  return {
    start: tokens[first].span.start,
    end: tokens[last].span.end,
    parts: tokens
      .slice(first, last + 1)
      .filter(tokenIsIdentifier)
      .map(unquoteSqlSemanticIdentifier),
  };
}
