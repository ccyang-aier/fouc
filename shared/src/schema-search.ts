import type { DatabaseObjectInfo } from './database';
import type { SchemaObject, SchemaObjectKind } from './schema-objects';

export type SchemaSearchKind = 'schema' | 'table' | 'column' | SchemaObjectKind;
export type SchemaSearchInput = { query: string; schemas?: string[]; kinds?: SchemaSearchKind[]; includeColumns?: boolean; caseSensitive?: boolean; limit?: number };
export type SchemaSearchMatch = { kind: 'exact' | 'initials' | 'prefix' | 'word-prefix' | 'substring' | 'fuzzy'; score: number; indices: number[]; field: 'name' | 'path' | 'parent' | 'comment' | 'type'; text: string };
export type SchemaSearchHit = { id: string; schema: string; kind: SchemaSearchKind; name: string; label: string; parentName: string | null; column: string | null; dataType: string | null; comment: string | null; object: SchemaObject | null; relation: DatabaseObjectInfo | null; match: SchemaSearchMatch };
export type SchemaSearchIssue = { schema: string | null; table: string | null; operation: 'schemas' | 'tables' | 'columns' | 'objects'; message: string };
export type SchemaSearchScope = { schemas: string[]; schemasTotal: number; relationsScanned: number; relationsTotal: number; columnTablesScanned: number; columnTablesTotal: number; columnsScanned: number; catalogObjectsScanned: number; complete: boolean; limits: string[] };
export type SchemaSearchResult = { query: string; hits: SchemaSearchHit[]; totalMatches: number; limit: number; truncated: boolean; scope: SchemaSearchScope; issues: SchemaSearchIssue[]; elapsedMs: number };
export const SCHEMA_SEARCH_KINDS: readonly SchemaSearchKind[] = ['schema', 'table', 'view', 'materialized-view', 'function', 'procedure', 'trigger', 'sequence', 'column'];
export const SCHEMA_SEARCH_LABELS: Record<SchemaSearchKind, string> = { schema: 'Schema', table: '表', view: '视图', 'materialized-view': '物化视图', function: '函数', procedure: '过程', trigger: '触发器', sequence: '序列', column: '字段' };

function words(text: string): { text: string; start: number }[] {
  const entries: { text: string; start: number }[] = []; let start = -1;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (/[\s_\-./\\:$]/u.test(character)) { if (start >= 0) entries.push({ text: text.slice(start, index), start }); start = -1; continue; }
    if (start < 0) start = index;
    else if (/[a-z]/.test(text[index - 1]) && /[A-Z]/.test(character)) { entries.push({ text: text.slice(start, index), start }); start = index; }
  }
  if (start >= 0) entries.push({ text: text.slice(start), start });
  return entries;
}
function range(start: number, length: number) { return Array.from({ length }, (_, index) => start + index); }
/** DBX quick-open ranking. Literal Unicode names work directly; no invented transliteration. */
export function matchSchemaSearchText(query: string, text: string, caseSensitive = false): Omit<SchemaSearchMatch, 'field' | 'text'> | null {
  const needle = caseSensitive ? query.trim() : query.trim().toLowerCase(), haystack = caseSensitive ? text : text.toLowerCase();
  if (!needle) return null;
  if (haystack === needle) return { kind: 'exact', score: 1, indices: range(0, text.length) };
  const pieces = words(text), fold = (value: string) => caseSensitive ? value : value.toLowerCase(), initials = pieces.map((piece) => fold(piece.text[0] ?? '')).join('');
  if (pieces.length >= 2 && initials === needle) return { kind: 'initials', score: 100 + Math.min(pieces.length, 99), indices: pieces.map((piece) => piece.start) };
  if (haystack.startsWith(needle)) return { kind: 'prefix', score: 200 + Math.min(text.length - needle.length, 99), indices: range(0, needle.length) };
  // Keep the best word-prefix path for each consumed query length; bounded by 256 characters.
  let states = new Map<number, { indices: number[]; used: number }>([[0, { indices: [], used: 0 }]]);
  for (const piece of pieces) {
    const next = new Map(states), word = fold(piece.text);
    for (const [consumed, state] of states) for (let length = 1; length <= Math.min(word.length, needle.length - consumed); length++) {
      if (word.slice(0, length) !== needle.slice(consumed, consumed + length)) break;
      const candidate = { indices: [...state.indices, ...range(piece.start, length)], used: state.used + 1 }, previous = next.get(consumed + length);
      if (!previous || candidate.used < previous.used) next.set(consumed + length, candidate);
    }
    states = next;
  }
  const prefixed = states.get(needle.length);
  if (prefixed && prefixed.used >= 2) return { kind: 'word-prefix', score: 300 + Math.min(text.length - needle.length, 99), indices: prefixed.indices };
  const substring = haystack.indexOf(needle);
  if (substring >= 0) return { kind: 'substring', score: 400 + Math.min(substring, 99), indices: range(substring, needle.length) };
  if (needle.length < 2) return null;
  const indices: number[] = []; let position = 0;
  for (let index = 0; index < haystack.length && position < needle.length; index++) if (haystack[index] === needle[position]) { indices.push(index); position++; }
  return position === needle.length ? { kind: 'fuzzy', score: 500 + Math.min(indices[indices.length - 1] - indices[0] + 1 - needle.length, 99), indices } : null;
}
export function rankSchemaSearchHit(input: Pick<SchemaSearchInput, 'query' | 'caseSensitive'>, hit: Omit<SchemaSearchHit, 'match'>): SchemaSearchHit | null {
  const fields: { field: SchemaSearchMatch['field']; text: string; weight: number }[] = [{ field: 'name', text: hit.name, weight: 0 }, { field: 'name', text: hit.label, weight: 0 }, { field: 'path', text: [hit.schema, hit.parentName, hit.name].filter((entry) => entry !== null).join('.'), weight: 600 }, { field: 'path', text: [hit.schema, hit.parentName, hit.label].filter((entry) => entry !== null).join('.'), weight: 600 }, { field: 'parent', text: hit.parentName ?? '', weight: 800 }, { field: 'comment', text: (hit.comment ?? '').slice(0, 4096), weight: 1000 }, { field: 'type', text: hit.dataType ?? '', weight: 1200 }];
  let best: SchemaSearchMatch | null = null;
  for (const field of fields) { const matched = matchSchemaSearchText(input.query, field.text, input.caseSensitive); if (matched && (!best || matched.score + field.weight < best.score)) best = { ...matched, score: matched.score + field.weight, field: field.field, text: field.text }; }
  return best ? { ...hit, match: best } : null;
}
export function compareSchemaSearchHits(a: SchemaSearchHit, b: SchemaSearchHit): number { return a.match.score - b.match.score || SCHEMA_SEARCH_KINDS.indexOf(a.kind) - SCHEMA_SEARCH_KINDS.indexOf(b.kind) || a.schema.localeCompare(b.schema) || (a.parentName ?? '').localeCompare(b.parentName ?? '') || a.label.localeCompare(b.label) || a.id.localeCompare(b.id); }
