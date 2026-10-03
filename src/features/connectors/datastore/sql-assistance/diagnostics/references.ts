import { tokenIsIdentifier, type RelationalProvider } from '@fouc/shared';
import { buildSqlSemanticModel } from '../../sql-semantic/model';
import { visibleSqlSources } from '../../sql-semantic/sources';
import type { SqlSemanticModel, SqlSemanticRowSource, SqlSemanticSpan } from '../../sql-semantic/types';
import { sqlAliasHighlightGroups } from './alias-highlights';
import { cteDefinitionSources, findCteColumnResolution, findCteReferenceAt, resolveCteColumnOrigins } from './cte-navigation';
import { containsPosition, identifierKey, MAX_SQL_ASSISTANCE_LENGTH, sourceTokenSpans, tokenName } from './model-context';

export interface SqlSemanticNavigationTarget {
  name: string;
  schema?: string;
  alias?: string;
  columns?: string[];
  source: SqlSemanticRowSource;
}

export interface SqlReferenceNavigation {
  span: SqlSemanticSpan;
  target?: SqlSemanticSpan;
  title: string;
  description: string;
  kind: 'alias' | 'cte' | 'column' | 'table';
  origins: Array<{ table: string; column: string }>;
}

/** DBX source navigation: ambiguous aliases are deliberately not resolved to an arbitrary table. */
export function resolveSqlSemanticNavigationTarget(model: SqlSemanticModel, identifierParts: readonly string[]): SqlSemanticNavigationTarget | null {
  if (model.cursorIntent.kind === 'suppressed' || !identifierParts.length) return null;
  const key = (value: string) => identifierKey(value, model.provider);
  const parts = identifierParts.map(key);
  const name = parts.at(-1)!;
  const qualifier = parts.at(-2);
  const database = parts.at(-3);
  const candidates = visibleSqlSources(model).filter((source) => {
    if (qualifier) {
      if (!database && source.alias && key(source.alias) === qualifier) return true;
      const schema = source.qualifierParts.at(-1);
      return key(source.name) === name && (!schema || key(schema) === qualifier) && (!database || key(source.qualifierParts.at(-2) ?? '') === database);
    }
    return key(source.name) === name || !!source.alias && key(source.alias) === name;
  });
  if (candidates.length !== 1) return null;
  const source = candidates[0];
  return { name: source.name, schema: source.qualifierParts.at(-1), alias: source.alias, columns: source.columns, source };
}

function displaySource(source: SqlSemanticRowSource): string {
  return [...source.qualifierParts, source.name].join('.');
}

/** Resolve hover/click information only within the statement and query scope of this position. */
export function sqlReferenceNavigationAt(sql: string, position: number, provider: RelationalProvider): SqlReferenceNavigation | null {
  if (sql.length > MAX_SQL_ASSISTANCE_LENGTH) return null;
  const preliminary = buildSqlSemanticModel(sql, position, { provider });
  const token = preliminary.tokens.find((candidate) => containsPosition(candidate.span, position) && tokenIsIdentifier(candidate));
  if (!token) return null;
  const model = buildSqlSemanticModel(sql, token.span.end, { provider });
  if (model.cursorIntent.kind === 'suppressed') return null;
  const cte = findCteReferenceAt(model, position);
  if (cte) {
    const spans = sourceTokenSpans(cte.reference, model.tokens, provider);
    return {
      span: spans.alias && containsPosition(spans.alias, position) ? spans.alias : spans.name,
      target: cte.definition.nameSpan,
      title: `${cte.definition.name} · CTE`,
      description: cte.definition.columns?.length ? `输出：${cte.definition.columns.join(', ')}` : '当前语句的公共表表达式',
      kind: 'cte', origins: [],
    };
  }
  const column = tokenName(token, provider);
  const tokenIndex = model.tokens.indexOf(model.tokens.find((candidate) => candidate.span.start === token.span.start)!);
  const qualifierToken = model.tokens[tokenIndex - 2];
  const qualifier = model.tokens[tokenIndex - 1]?.text === '.' && tokenIsIdentifier(qualifierToken) ? tokenName(qualifierToken, provider) : undefined;
  const hit = findCteColumnResolution(model, column, qualifier);
  if (hit) {
    const origins = resolveCteColumnOrigins(model, hit, column).map((origin) => ({ table: displaySource(origin.source), column: origin.column }));
    return {
      span: token.span,
      target: hit.output?.jumpSpan ?? (hit.stars?.length === 1 ? hit.stars[0].starSpan : undefined),
      title: `${hit.definition.name}.${column}`,
      description: origins.length ? `来源：${origins.map((origin) => `${origin.table}.${origin.column}`).join(', ')}` : hit.output ? 'CTE 输出列；点击查看定义' : 'CTE 星号投影；具体来源需要字段元数据',
      kind: 'column', origins,
    };
  }
  const group = sqlAliasHighlightGroups(sql, provider).find((candidate) => containsPosition(candidate.declaration, position) || candidate.references.some((span) => containsPosition(span, position)));
  if (group) {
    const source = visibleSqlSources(model).find((candidate) => sourceTokenSpans(candidate, model.tokens, provider).alias?.start === group.declaration.start);
    if (source) {
      return {
        span: group.references.find((span) => containsPosition(span, position)) ?? group.declaration,
        target: containsPosition(group.declaration, position) ? sourceTokenSpans(source, model.tokens, provider).name : group.declaration,
        title: `${source.alias} → ${displaySource(source)}`,
        description: source.kind === 'subquery' ? '当前查询块的派生表别名' : '当前查询块的来源别名',
        kind: 'alias', origins: [],
      };
    }
  }
  const source = visibleSqlSources(model).find((candidate) => containsPosition(sourceTokenSpans(candidate, model.tokens, provider).name, position));
  if (!source) return null;
  const definition = cteDefinitionSources(model).find((candidate) => candidate.id === source.definitionId);
  return {
    span: sourceTokenSpans(source, model.tokens, provider).name,
    target: definition?.nameSpan,
    title: displaySource(source),
    description: source.kind === 'table_function' ? '返回行集的数据库函数' : '当前查询的表来源',
    kind: 'table', origins: [],
  };
}
