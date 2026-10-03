import { sqlSemanticDialectFor } from './dialect';
import type { SqlSemanticModel, SqlSemanticRowSource } from './types';

function contains(span: { start: number; end: number } | undefined, position: number): boolean {
  return !!span && span.start <= position && position <= span.end;
}

export function visibleCteDefinitions(model: SqlSemanticModel): SqlSemanticRowSource[] {
  const dialect = sqlSemanticDialectFor({ provider: model.provider });
  const definitions = model.rowSources.filter((source) => source.id.startsWith('cte:') && contains(source.definitionScope, model.cursor) && (source.nameSpan?.start ?? 0) < model.cursor && (!contains(source.bodySpan, model.cursor) || source.recursive));
  const innerFirst = definitions.sort((left, right) => (left.definitionScope!.end - left.definitionScope!.start) - (right.definitionScope!.end - right.definitionScope!.start) || (right.nameSpan?.start ?? 0) - (left.nameSpan?.start ?? 0));
  return innerFirst.filter((source, index) => !innerFirst.slice(0, index).some((other) => dialect.sameIdentifier(source.name, other.name)));
}

/** DBX query-block references with explicit CTE/derived-table correlation boundaries. */
export function visibleSqlSources(model: SqlSemanticModel): SqlSemanticRowSource[] {
  const dialect = sqlSemanticDialectFor({ provider: model.provider });
  const token = model.tokens.find((item) => item.span.start < model.cursor && item.span.end >= model.cursor) ?? model.tokens.findLast((item) => item.span.end <= model.cursor);
  let parent = token?.parent ?? null;
  const ancestors: Array<number | null> = [];
  const barriers = model.rowSources.filter((source) => contains(source.bodySpan, model.cursor) && (source.id.startsWith('cte:') || source.kind === 'subquery' && model.tokens.findLast((item) => item.span.end <= source.bodySpan!.start)?.normalized !== 'lateral'));
  while (true) {
    ancestors.push(parent);
    if (parent === null || barriers.some((source) => source.bodySpan?.start === parent)) break;
    parent = model.tokens.find((item) => item.span.start === parent)?.parent ?? null;
  }
  const sources = model.rowSources.filter((source) => !source.id.startsWith('cte:')).map((source) => ({ source, parent: model.tokens.find((item) => item.span.start === source.sourceSpan.start)?.parent ?? null }));
  const lateral = sources.filter(({ source }) => contains(source.bodySpan, model.cursor) && source.kind === 'subquery' && model.tokens.findLast((item) => item.span.end <= source.bodySpan!.start)?.normalized === 'lateral');
  const visible = sources.filter((item) => ancestors.includes(item.parent) && !contains(item.source.bodySpan, model.cursor) && !lateral.some((boundary) => boundary.parent === item.parent && item.source.sourceSpan.start >= boundary.source.sourceSpan.start)).sort((left, right) => ancestors.indexOf(left.parent) - ancestors.indexOf(right.parent) || left.source.sourceSpan.start - right.source.sourceSpan.start);
  return visible.filter((item, index) => !visible.slice(0, index).some((other) => other.parent !== item.parent && dialect.sameIdentifier(other.source.alias ?? other.source.name, item.source.alias ?? item.source.name))).map((item) => item.source);
}

/** DBX dialect rules for SELECT aliases; input fields keep their own metadata. */
export function visibleProjectionAliases(model: SqlSemanticModel): string[] {
  const dialect = sqlSemanticDialectFor({ provider: model.provider });
  const projection = model.projections[0];
  if (!projection) return [];
  const depth = model.tokens.find((token) => token.span.start === projection.span.start)?.depth ?? 0;
  const before = model.tokens.filter((token) => token.span.end <= model.cursor && token.depth === depth && token.kind === 'word');
  for (let index = before.length - 1; index >= 0; index--) {
    const word = before[index].normalized;
    const previous = before[index - 1]?.normalized;
    const clause = word === 'by' && previous === 'order' ? 'orderBy' : word === 'by' && previous === 'group' ? 'groupBy' : word === 'having' ? 'having' : word === 'where' ? 'where' : null;
    if (clause) return dialect.projectionAliasVisibility[clause] ? model.projections.filter((field) => field.alias).map((field) => field.name) : [];
    if (['select', 'from', 'join', 'on', 'union', 'intersect', 'except'].includes(word)) return [];
  }
  return [];
}
