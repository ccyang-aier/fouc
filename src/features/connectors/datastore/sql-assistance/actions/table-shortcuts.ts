import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './table-shortcuts.messages';
import {
  tokenizeSqlSemantic,
  tokenIsIdentifier,
  type RelationalProvider,
  type SqlFormatterCase,
} from '@fouc/shared';
import { buildSqlSemanticModel } from '../../sql-semantic/model';
import { visibleSqlSources } from '../../sql-semantic/sources';
import { identifierAtCursor } from './semantic-context';
import { sqlAppendQueryEdit, type SqlActionSnapshot, type SqlActionEdit } from './editor-actions';
export const DEFAULT_SQL_SHORTCUT_SELECT_LIMIT = 100;
export const SQL_SHORTCUT_TABLE_TOKEN = '${table}';
const KEYWORDS = new Set(
  'select from where join left right inner outer on group by order asc desc having limit offset insert into values update set delete create table view as and or not in is null like distinct union all exists between case when then else end count sum avg min max coalesce cast alter drop add column index primary key foreign references constraint default check unique begin commit rollback truncate explain analyze with recursive over partition cross full natural using lateral returning'.split(
    ' ',
  ),
);
type Selection = {
  from: number;
  to: number;
  empty: boolean;
  head: number;
};
/** DBX selection-first target resolution, preserving source quotes and qualified segments. */
export function resolveSqlShortcutTableToken(
  doc: string,
  selection: Selection,
  provider: RelationalProvider = 'mysql',
): string | null {
  if (!selection.empty) return doc.slice(selection.from, selection.to).trim() || null;
  const token = identifierAtCursor(doc, selection.head, provider);
  if (!token) return null;
  const raw = doc.slice(token.start, token.end);
  const last = tokenizeSqlSemantic(raw, provider).filter(tokenIsIdentifier).at(-1);
  if (!last || (last.kind === 'word' && KEYWORDS.has(last.normalized))) return null;
  return raw.trim() || null;
}
/** Column/star context prefers its actual row source; a selected table token remains explicit. */
export function sqlShortcutContextTable(
  snapshot: SqlActionSnapshot,
  provider: RelationalProvider,
): string {
  const doc = snapshot.state.doc.toString(),
    range = snapshot.state.selection.main;
  if (!range.empty) return resolveSqlShortcutTableToken(doc, range, provider) ?? '';
  const model = buildSqlSemanticModel(doc, range.head, { provider, editorState: snapshot.state });
  if (model.cursorIntent.kind === 'suppressed') return '';
  const sources = visibleSqlSources(model);
  if (
    !['table', 'schema', 'catalog', 'routine', 'delete_target'].includes(model.cursorIntent.kind)
  ) {
    const source =
      sources.find((entry) => entry.id === model.cursorIntent.targetSourceId) ??
      (sources.length === 1 ? sources[0] : undefined);
    if (source) {
      if (source.kind !== 'table' && source.kind !== 'mutation_target') return '';
      const name = identifierAtCursor(doc, source.sourceSpan.start, provider);
      return name ? doc.slice(name.start, name.end) : '';
    }
  }
  return resolveSqlShortcutTableToken(doc, range, provider) ?? '';
}
export function normalizeSqlShortcutLimit(
  value: unknown,
  fallback = DEFAULT_SQL_SHORTCUT_SELECT_LIMIT,
): number {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return !Number.isFinite(number) || number < 1 ? fallback : Math.min(Math.floor(number), 100000);
}
export function resolveSqlShortcutTemplate(template: string, selectedTable: string): string {
  return template.replace(/\$\{table\}/g, () => selectedTable.trim());
}
export function buildSqlTableShortcut(
  kind: 'select' | 'count' | 'projection',
  table: string,
  limit: number,
  projection: string,
  keywordCase: SqlFormatterCase = 'upper',
): string {
  const keyword = (value: string) => (keywordCase === 'lower' ? value.toLowerCase() : value);
  if (kind === 'count')
    return `${keyword('SELECT')} ${keyword('COUNT')}(*) ${keyword('AS')} row_count\n${keyword('FROM')} ${table.trim()};`;
  return `${keyword('SELECT')} ${kind === 'projection' ? projection.trim() || '*' : '*'}\n${keyword('FROM')} ${table.trim()}\n${keyword('LIMIT')} ${normalizeSqlShortcutLimit(limit)};`;
}
export function sqlTableShortcutEdit(snapshot: SqlActionSnapshot, query: string): SqlActionEdit {
  return sqlAppendQueryEdit(snapshot, query);
}
export function sqlTableNameIssue(
  table: string,
  provider: RelationalProvider,
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  const tokens = tokenizeSqlSemantic(table.trim(), provider);
  if (!tokens.length) return tConnector('enterATableNameSchemaTableIsSupported');
  if (
    tokens.some((token, index) =>
      index % 2 === 0
        ? !tokenIsIdentifier(token) || (token.kind === 'quoted_identifier' && !token.closed)
        : token.text !== '.',
    ) ||
    tokens.length % 2 === 0
  )
    return tConnector('theTableNameMustBeASingleOrQualifiedIdentifier');
  if (tokens.some((token) => token.kind === 'word' && KEYWORDS.has(token.normalized)))
    return tConnector('theTableNameContainsSqlKeywordsUseIdentifierQuotes');
  return '';
}
