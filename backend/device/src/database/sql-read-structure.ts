import { tokenizeSqlSemantic, tokenIsIdentifier, type RelationalProvider } from '@fouc/shared';

/**
 * DBX's structural read proof distinguishes CTE/derived/LATERAL declarations from calls.
 * Mask output-list/LATERAL openings and verified MATERIALIZED modifiers. Names, comments and bodies
 * still pass the original function/write guards, including MySQL executable comments.
 * UTF-16 offsets and all separators remain unchanged for the existing preflight scanners.
 */
export function maskSqlReadDeclarations(sql: string, provider: RelationalProvider): string {
  const tokens = tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment');
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].text === '(') stack.push(index);
    else if (tokens[index].text === ')') { const open = stack.pop(); if (open !== undefined) pairs.set(open, index); }
  }
  const spans: Array<{ start: number; end: number }> = [];
  const word = (index: number, value: string) => tokens[index]?.kind === 'word' && tokens[index].normalized === value;
  const identifierListEnd = (open: number) => {
    if (tokens[open]?.text !== '(') return undefined;
    const close = pairs.get(open);
    if (close === undefined) return undefined;
    const list = tokens.slice(open + 1, close);
    return list.length && list.length % 2 === 1 && list.every((token, part) => part % 2 === 0 ? tokenIsIdentifier(token) : token.text === ',') ? close : undefined;
  };
  if (provider !== 'sqlite') for (const [open, close] of pairs) {
    if (!word(open + 1, 'select') && !word(open + 1, 'with')) continue;
    const alias = close + (word(close + 1, 'as') ? 2 : 1);
    if (tokenIsIdentifier(tokens[alias]) && identifierListEnd(alias + 1) !== undefined) spans.push(tokens[alias + 1].span);
  }
  for (let index = 0; index < tokens.length; index++) {
    if (provider !== 'sqlite' && word(index, 'lateral') && (word(index - 1, 'from') || word(index - 1, 'join') || tokens[index - 1]?.text === ',') && tokens[index + 1]?.text === '(' && pairs.has(index + 1) && (word(index + 2, 'select') || word(index + 2, 'with'))) spans.push(tokens[index + 1].span);
    if (!word(index, 'with')) continue;
    let declaration = index + (word(index + 1, 'recursive') ? 2 : 1);
    while (tokenIsIdentifier(tokens[declaration])) {
      let after = declaration + 1;
      let columns: { start: number; end: number } | undefined;
      if (tokens[after]?.text === '(') {
        const close = identifierListEnd(after);
        if (close === undefined) break;
        columns = tokens[after].span;
        after = close + 1;
      }
      if (!word(after, 'as')) break;
      after++;
      if (provider === 'postgres' && word(after, 'not')) after++;
      const materialized = provider === 'postgres' && word(after, 'materialized') ? tokens[after++].span : undefined;
      if (tokens[after]?.text !== '(') break;
      const bodyEnd = pairs.get(after);
      if (bodyEnd === undefined) break;
      if (columns) spans.push(columns);
      if (materialized) spans.push(materialized);
      if (tokens[bodyEnd + 1]?.text !== ',') break;
      declaration = bodyEnd + 2;
    }
  }
  let offset = 0;
  const parts: string[] = [];
  for (const span of spans.sort((left, right) => left.start - right.start)) {
    parts.push(sql.slice(offset, span.start), sql.slice(span.start, span.end).replace(/[^\r\n]/g, ' '));
    offset = span.end;
  }
  return parts.join('') + sql.slice(offset);
}
