import type { RelationalProvider } from './relational';
export interface SqlSemanticSpan {
  start: number;
  end: number;
}

export type SqlSemanticTokenKind = "word" | "quoted_identifier" | "string" | "number" | "comment" | "parameter" | "punctuation" | "operator";

export interface SqlSemanticToken {
  kind: SqlSemanticTokenKind;
  text: string;
  normalized: string;
  span: SqlSemanticSpan;
  depth: number;
  quote?: string;
  closed?: boolean;
  parent: number | null;
}

const WORD_START = /[\p{ID_Start}_@$]/u;
const WORD_PART = /[\p{ID_Continue}_@$]/u;
const DOLLAR_QUOTE_TAG = /\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/y;
const NUMBER = /(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/y;

export function matchDollarQuoteTag(input: string, index: number): string | undefined {
  DOLLAR_QUOTE_TAG.lastIndex = index;
  return DOLLAR_QUOTE_TAG.exec(input)?.[0];
}

/** Span-preserving DBX tokenization with the native providers' actual default quoting. */
export function tokenizeSqlSemantic(text: string, provider: RelationalProvider = 'mysql'): SqlSemanticToken[] {
  const tokens: SqlSemanticToken[] = [];
  const scopes: number[] = [];
  let position = 0;
  let depth = 0;
  const push = (kind: SqlSemanticToken['kind'], from: number, quote?: string, closed?: boolean) => {
    const raw = text.slice(from, position);
    tokens.push({ kind, text: raw, normalized: kind === 'word' ? raw.toLowerCase() : raw,
      span: { start: from, end: position }, depth, parent: scopes.at(-1) ?? null, quote, closed });
  };
  while (position < text.length) {
    const from = position;
    const char = String.fromCodePoint(text.codePointAt(position)!);
    const next = text[position + 1];
    if (/\s/u.test(char)) { position += char.length; continue; }
    if ((char === '-' && next === '-' && (provider !== 'mysql' || position + 2 === text.length || /\s/.test(text[position + 2]))) || (provider === 'mysql' && char === '#')) {
      while (position < text.length && !/[\r\n]/.test(text[position])) position++;
      push('comment', from); continue;
    }
    if (char === '/' && next === '*') {
      position += 2;
      let nesting = 1;
      while (position < text.length && nesting) {
        if (text.startsWith('*/', position)) { nesting--; position += 2; }
        else if (provider === 'postgres' && text.startsWith('/*', position)) { nesting++; position += 2; }
        else position++;
      }
      push('comment', from, undefined, nesting === 0); continue;
    }
    if (provider === 'postgres' && char === '$') {
      const marker = matchDollarQuoteTag(text, position);
      if (marker) {
        const end = text.indexOf(marker, position + marker.length);
        position = end < 0 ? text.length : end + marker.length;
        push('string', from, marker, end >= 0); continue;
      }
    }
    const identifierQuote = char === '"' && provider !== 'mysql' || char === '`' && provider !== 'postgres' || char === '[' && provider === 'sqlite';
    if (char === "'" || char === '"' || identifierQuote) {
      const closing = char === '[' ? ']' : char;
      const previous = tokens.at(-1);
      const escaped = provider === 'mysql' || provider === 'postgres' && previous?.kind === 'word' && previous.normalized === 'e' && previous.span.end === from;
      position++;
      let closed = false;
      while (position < text.length) {
        if (!identifierQuote && escaped && text[position] === '\\') { position = Math.min(text.length, position + 2); continue; }
        if (text[position] === closing) {
          position++;
          if (char !== '[' && text[position] === closing) { position++; continue; }
          closed = true; break;
        }
        position++;
      }
      push(identifierQuote ? 'quoted_identifier' : 'string', from, char, closed); continue;
    }
    if (/\d/.test(char) || char === '.' && /\d/.test(next ?? '')) {
      NUMBER.lastIndex = position;
      const number = NUMBER.exec(text)![0];
      position += number.length;
      push('number', from); continue;
    }
    if (char === ':' && next === ':') { position += 2; push('operator', from); continue; }
    if (char === '?' || char === ':' || provider === 'postgres' && char === '$' && /\d/.test(next ?? '')) {
      position += char.length;
      while (position < text.length) {
        const part = String.fromCodePoint(text.codePointAt(position)!);
        if (!WORD_PART.test(part)) break;
        position += part.length;
      }
      push('parameter', from); continue;
    }
    if (WORD_START.test(char)) {
      position += char.length;
      while (position < text.length) {
        const part = String.fromCodePoint(text.codePointAt(position)!);
        if (!WORD_PART.test(part)) break;
        position += part.length;
      }
      push('word', from); continue;
    }
    if ('(),.;*'.includes(char)) {
      if (char === ')') { depth = Math.max(0, depth - 1); scopes.pop(); }
      position++; push('punctuation', from);
      if (char === '(') { depth++; scopes.push(from); }
      continue;
    }
    position += char.length; push('operator', from);
  }
  return tokens;
}

export function unquoteSqlSemanticIdentifier(token: SqlSemanticToken): string {
  if (token.kind !== 'quoted_identifier') return token.text;
  const quote = token.quote!;
  const text = token.text.slice(1, token.closed ? -1 : undefined);
  return quote === '[' ? text : text.replaceAll(quote + quote, quote);
}

export function tokenIsIdentifier(token?: SqlSemanticToken): token is SqlSemanticToken & { kind: 'word' | 'quoted_identifier' } {
  return token?.kind === 'word' || token?.kind === 'quoted_identifier';
}

export function isSuppressedSqlSemanticContext(tokens: readonly SqlSemanticToken[], cursor: number): boolean {
  return tokens.some((token) => (token.kind === 'comment' || token.kind === 'string') && token.span.start < cursor && cursor <= token.span.end);
}

export function findActiveSqlStatementSpan(sql: string, tokens: readonly SqlSemanticToken[], cursor: number): SqlSemanticSpan {
  let start = 0, end = sql.length;
  for (const token of tokens) {
    if (token.kind !== 'punctuation' || token.text !== ';' || token.depth !== 0) continue;
    if (token.span.end <= cursor) start = token.span.end;
    else if (token.span.start >= cursor) { end = token.span.start; break; }
  }
  while (start < end && /\s/.test(sql[start])) start++;
  while (end > start && /\s/.test(sql[end - 1])) end--;
  return { start, end };
}
