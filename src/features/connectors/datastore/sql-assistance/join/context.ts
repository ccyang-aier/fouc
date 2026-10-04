import type { CompletionContext } from '@codemirror/autocomplete';
import type { RelationalProvider, SqlSemanticToken } from '@fouc/shared';
import { sqlCompletionPosition, type SqlCompletionPosition, type SqlTableReference } from '../../sql-completion-context';

export interface SqlJoinContext {
  mode: 'join' | 'table' | 'on' | 'using';
  position: SqlCompletionPosition;
  references: SqlTableReference[];
  from: number;
  to: number;
  prefix: string;
  usingParentheses: boolean;
}
const JOIN_MODIFIERS = new Set(['left', 'right', 'inner', 'outer', 'full', 'cross', 'natural']);
const BOUNDARIES = new Set(['where', 'group', 'order', 'having', 'limit', 'offset', 'union', 'intersect', 'except', 'returning']);
export const SQL_JOIN_DOCUMENT_LIMIT = 128_000;
export const SQL_JOIN_TOKEN_LIMIT = 20_000;

/** Reuse the installed DBX semantic scope; never infer a relationship from column names. */
export function sqlJoinContext(context: CompletionContext, provider: RelationalProvider): SqlJoinContext | null {
  if (context.state.doc.length > SQL_JOIN_DOCUMENT_LIMIT) return null;
  const position = sqlCompletionPosition(context.state.doc.toString(), context.pos, provider, context.state);
  if (!position || position.model.tokens.length > SQL_JOIN_TOKEN_LIMIT) return null;
  const tokens = position.model.tokens.filter(token => token.kind !== 'comment');
  const cursorToken = tokens.find(token => token.span.start < context.pos && context.pos <= token.span.end);
  let parent = cursorToken?.parent ?? tokens.findLast(token => token.span.end <= context.pos)?.parent ?? null;
  const ancestors: Array<number | null> = [parent];
  while (parent !== null) { parent = tokens.find(token => token.span.start === parent)?.parent ?? null; ancestors.push(parent); }
  const selects = tokens.filter(token => token.kind === 'word' && token.normalized === 'select' && token.span.start <= context.pos && ancestors.includes(token.parent));
  const select = selects.sort((a, b) => ancestors.indexOf(a.parent) - ancestors.indexOf(b.parent) || b.span.start - a.span.start)[0];
  if (!select) return null;
  const local = tokens.filter(token => token.parent === select.parent && token.span.start > select.span.start);
  const before = local.filter(token => token.span.end <= position.from);
  const clause = before.findLast(token => token.kind === 'word' && ['from', 'join', 'on', 'using', ...BOUNDARIES].includes(token.normalized));
  if (!clause || BOUNDARIES.has(clause.normalized)) return null;
  // Correlated outer tables, CTEs and derived tables do not acquire catalog FKs.
  const references = position.references.filter(ref => !ref.virtual && ref.parent === select.parent && ref.from > select.span.start && ref.from < position.from);
  if (!references.length || references.length > 8) return null;
  const base = { position, references, from: position.from, to: position.to, prefix: position.prefix, usingParentheses: false };
  const afterClause = before.filter(token => token.span.start >= clause.span.end);
  const isIdentifierFragment = (items: SqlSemanticToken[]) => items.every(token => token.kind === 'word' || token.kind === 'quoted_identifier' || token.text === '.');
  if (clause.normalized === 'on') {
    if (references.length < 2 || !isIdentifierFragment(afterClause)) return null;
    const suffix = local.filter(token => token.span.start >= position.to);
    if (suffix[0] && !BOUNDARIES.has(suffix[0].normalized) && !['join', ';', ')'].includes(suffix[0].text.toLowerCase())) return null;
    return { ...base, mode: 'on', from: afterClause[0]?.span.start ?? position.from,
      prefix: context.state.sliceDoc(afterClause[0]?.span.start ?? position.from, context.pos) };
  }
  if (clause.normalized === 'using') {
    if (references.length < 2) return null;
    const start = tokens.find(token => token.span.start >= clause.span.end && token.span.start < context.pos);
    const inside = tokens.filter(token => token.span.start >= (start?.span.end ?? clause.span.end) && token.span.end <= position.from);
    if (start?.text === '(' ? !isIdentifierFragment(inside) || inside.some(token => token.text === '.') : afterClause.length > 0) return null;
    const next = tokens.find(token => token.span.start >= position.to);
    if (next && next.text !== ')' && !BOUNDARIES.has(next.normalized) && next.normalized !== 'join') return null;
    return { ...base, mode: 'using', usingParentheses: start?.text === '(' };
  }
  if (clause.normalized === 'join' && isIdentifierFragment(afterClause) && position.tableContext) {
    const modifiers = before.filter(token => token.span.end <= clause.span.start).slice(-3);
    if (modifiers.some(token => token.kind === 'word' && ['natural', 'cross'].includes(token.normalized))) return null;
    // An existing alias/ON/USING belongs to the user's SQL; leave its insertion to ordinary table completion.
    const next = local.find(token => token.span.start >= position.to);
    if (next && !BOUNDARIES.has(next.normalized) && !['join', ';'].includes(next.normalized)) return null;
    if (position.qualifier.length > 1) return null;
    const preceding = references.filter(reference => reference.from < clause.span.start);
    return preceding.length ? { ...base, references: preceding, mode: 'table' } : null;
  }
  const last = references.at(-1)!;
  if (position.from < last.source.sourceSpan.end) return null;
  const trailing = before.filter(token => token.span.start >= last.source.sourceSpan.end);
  if (trailing.some(token => !JOIN_MODIFIERS.has(token.normalized)) || position.qualifier.length || position.quoted ||
    position.prefix && !'join'.startsWith(position.prefix.toLowerCase())) return null;
  if (trailing.some(token => ['natural', 'cross'].includes(token.normalized))) return null;
  const next = local.find(token => token.span.start >= position.to);
  if (next && !BOUNDARIES.has(next.normalized) && next.normalized !== 'join' && next.text !== ';') return null;
  return { ...base, mode: 'join' };
}
