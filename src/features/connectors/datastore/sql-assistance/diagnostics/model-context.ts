import { tokenIsIdentifier, tokenizeSqlSemantic, unquoteSqlSemanticIdentifier, type RelationalProvider } from '@fouc/shared';
import { buildSqlSemanticModel } from '../../sql-semantic/model';
import { sqlSemanticDialectFor } from '../../sql-semantic/dialect';
import { visibleSqlSources } from '../../sql-semantic/sources';
import type { SqlSemanticModel, SqlSemanticRowSource, SqlSemanticSpan, SqlSemanticToken } from '../../sql-semantic/types';

export const MAX_SQL_ASSISTANCE_LENGTH = 128 * 1024;
export const MAX_SQL_ASSISTANCE_TOKENS = 20_000;
export const MAX_SQL_QUERY_BLOCKS = 128;

export function containsPosition(span: SqlSemanticSpan | undefined, position: number): boolean {
  return !!span && span.start <= position && position <= span.end;
}

export function identifierKey(name: string, provider: RelationalProvider): string {
  return provider === 'postgres' ? name : name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function tokenName(token: SqlSemanticToken, provider: RelationalProvider): string {
  return sqlSemanticDialectFor({ provider }).normalizeIdentifier(unquoteSqlSemanticIdentifier(token), token.kind === 'quoted_identifier');
}

/** Recover declaration tokens from the existing model's source span, without parsing a second SQL grammar. */
export function sourceTokenSpans(source: SqlSemanticRowSource, tokens: readonly SqlSemanticToken[], provider: RelationalProvider): { name: SqlSemanticSpan; alias?: SqlSemanticSpan } {
  if (source.id.startsWith('cte:') && source.nameSpan) return { name: source.nameSpan };
  const start = tokens.findIndex((token) => token.span.start === source.sourceSpan.start);
  const first = tokens[start];
  if (!first) return { name: source.sourceSpan };
  let end = first.span.end;
  if (tokenIsIdentifier(first)) {
    for (let index = start + 1; tokens[index]?.text === '.' && tokenIsIdentifier(tokens[index + 1]); index += 2) end = tokens[index + 1].span.end;
  } else if (source.bodySpan) end = source.bodySpan.end;
  const name = { start: first.span.start, end };
  if (!source.alias) return { name };
  const alias = tokens.find((token) => token.span.start >= end && token.span.end <= source.sourceSpan.end && token.depth === first.depth && tokenIsIdentifier(token) && identifierKey(tokenName(token, provider), provider) === identifierKey(source.alias!, provider));
  return { name, alias: alias?.span };
}

export interface SqlQueryBlock {
  start: number;
  end: number;
  depth: number;
  model: SqlSemanticModel;
  sources: SqlSemanticRowSource[];
  visible: SqlSemanticRowSource[];
  parent?: SqlQueryBlock;
}

/** DBX SELECT/set-operation query blocks, sourced from the installed native semantic model. */
export function sqlQueryBlocks(sql: string, provider: RelationalProvider, inputTokens?: SqlSemanticToken[]): SqlQueryBlock[] {
  if (sql.length > MAX_SQL_ASSISTANCE_LENGTH) return [];
  const tokens = inputTokens ?? tokenizeSqlSemantic(sql, provider);
  if (tokens.length > MAX_SQL_ASSISTANCE_TOKENS) return [];
  const blocks: SqlQueryBlock[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind !== 'word' || !['select', 'update', 'delete'].includes(token.normalized)) continue;
    if (blocks.length >= MAX_SQL_QUERY_BLOCKS) return [];
    let end = index + 1;
    while (end < tokens.length) {
      const next = tokens[end];
      if (next.depth < token.depth || next.text === ';' && next.depth === token.depth || next.depth === token.depth && next.kind === 'word' && ['union', 'intersect', 'except'].includes(next.normalized)) break;
      end++;
    }
    const blockEnd = tokens[end]?.span.start ?? sql.length;
    const model = buildSqlSemanticModel(sql, token.span.end, { provider });
    const visible = visibleSqlSources(model);
    const sources = visible.filter((source) => source.sourceSpan.start >= token.span.start && source.sourceSpan.start < blockEnd);
    blocks.push({ start: token.span.start, end: blockEnd, depth: token.depth, model, sources, visible });
  }
  blocks.sort((left, right) => left.start - right.start || right.end - left.end);
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    block.parent = blocks.slice(0, index).findLast((candidate) => candidate.depth < block.depth && candidate.start <= block.start && candidate.end >= block.end);
  }
  return blocks;
}

export function queryBlockAt(blocks: readonly SqlQueryBlock[], position: number): SqlQueryBlock | undefined {
  return blocks.findLast((block) => block.start <= position && position < block.end);
}

export function tableReferenceKey(source: SqlSemanticRowSource, provider: RelationalProvider): string {
  return identifierKey([...source.qualifierParts, source.name].join('.'), provider);
}

/** Collect only physical/derived references exposed by a query block; CTE bodies retain their own scope. */
export function sqlSemanticTableReferences(model: SqlSemanticModel): Array<{ name: string; schema?: string; alias?: string; columns?: string[]; source: SqlSemanticRowSource; span: SqlSemanticSpan }> {
  return visibleSqlSources(model).filter((source) => source.kind !== 'unknown').map((source) => ({
    name: source.name,
    schema: source.qualifierParts.at(-1),
    alias: source.alias,
    columns: source.columns,
    source,
    span: sourceTokenSpans(source, model.tokens, model.provider).name,
  }));
}
