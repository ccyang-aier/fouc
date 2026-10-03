import { tokenizeSqlSemantic, tokenIsIdentifier, type RelationalProvider } from '@fouc/shared';
import type { SqlSemanticSpan } from '../../sql-semantic/types';
import { identifierKey, MAX_SQL_ASSISTANCE_LENGTH, MAX_SQL_ASSISTANCE_TOKENS, queryBlockAt, sourceTokenSpans, sqlQueryBlocks } from './model-context';

export interface SqlAliasHighlightGroup {
  declaration: SqlSemanticSpan;
  qualifiers: SqlSemanticSpan[];
  references: SqlSemanticSpan[];
}

/** DBX declaration/reference groups, preserving query-block shadowing and native quoted identifiers. */
export function sqlAliasHighlightGroups(sql: string, provider: RelationalProvider): SqlAliasHighlightGroup[] {
  if (sql.length > MAX_SQL_ASSISTANCE_LENGTH) return [];
  const allTokens = tokenizeSqlSemantic(sql, provider);
  if (allTokens.length > MAX_SQL_ASSISTANCE_TOKENS || allTokens.some((token) => token.closed === false)) return [];
  const tokens = allTokens.filter((token) => token.kind !== 'comment');
  let parentheses = 0;
  for (const token of tokens) {
    if (token.text === '(') parentheses++;
    if (token.text === ')' && --parentheses < 0) return [];
  }
  if (parentheses !== 0) return [];
  const blocks = sqlQueryBlocks(sql, provider, tokens);
  const groups = new Map<number, SqlAliasHighlightGroup | null>();
  const owners = new Map<number, Map<string, number | null>>();
  for (const block of blocks) {
    const aliases = new Map<string, number | null>();
    for (const source of block.sources) {
      const spans = sourceTokenSpans(source, tokens, provider);
      const key = identifierKey(source.alias ?? source.name, provider);
      if (aliases.has(key)) {
        const prior = aliases.get(key);
        if (prior !== null && prior !== undefined) groups.set(prior, null);
        aliases.set(key, null);
        continue;
      }
      aliases.set(key, spans.alias?.start ?? null);
      if (spans.alias) groups.set(spans.alias.start, { declaration: spans.alias, qualifiers: [], references: [] });
    }
    owners.set(block.start, aliases);
  }
  for (let index = 0; index + 2 < tokens.length; index++) {
    const qualifier = tokens[index], column = tokens[index + 2];
    if (!tokenIsIdentifier(qualifier) || tokens[index + 1].text !== '.' || column.text !== '*' && !tokenIsIdentifier(column)) continue;
    if (tokens[index - 1]?.text === '.' || tokens[index + 3]?.text === '.' || tokens[index + 3]?.text === '(') continue;
    const block = queryBlockAt(blocks, qualifier.span.start);
    if (!block || block.visible.some((source) => {
      const span = sourceTokenSpans(source, tokens, provider).name;
      return span.start <= qualifier.span.start && column.span.end <= span.end;
    })) continue;
    const dialectName = qualifier.kind === 'quoted_identifier'
      ? qualifier.text.slice(1, -1).replaceAll(qualifier.quote! + qualifier.quote!, qualifier.quote!)
      : provider === 'postgres' ? qualifier.normalized : qualifier.text;
    const key = identifierKey(dialectName, provider);
    let owner = block;
    while (!owners.get(owner.start)?.has(key) && owner.parent) owner = owner.parent;
    const declaration = owners.get(owner.start)?.get(key);
    const group = declaration === null || declaration === undefined ? null : groups.get(declaration);
    // CTE and non-LATERAL derived bodies cannot borrow an enclosing alias.
    if (!group || !block.visible.some((source) => sourceTokenSpans(source, tokens, provider).alias?.start === declaration)) continue;
    group.qualifiers.push(qualifier.span);
    group.references.push({ start: qualifier.span.start, end: column.span.end });
  }
  return [...groups.values()].filter((group): group is SqlAliasHighlightGroup => group !== null);
}
