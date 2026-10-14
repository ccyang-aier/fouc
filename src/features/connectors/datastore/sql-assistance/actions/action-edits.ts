import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './action-edits.messages';
import { tokenizeSqlSemantic, type RelationalProvider, type SqlFormatterCase } from '@fouc/shared';
import { sqlSemanticDialectFor } from '../../sql-semantic/dialect';
import {
  buildSqlInConditionFromPasteSource,
  insertTextForSqlInCondition,
  type SqlInListPasteResult,
} from './in-list-paste';
import {
  buildExpandWildcardReplacement,
  prepareExpandWildcardContext,
  type IntentionAction,
} from './intention-actions';
import { buildSqlSemanticModel } from './semantic-context';
import type { SqlActionEdit, SqlActionSnapshot } from './editor-actions';
export function intentionActionEdit(action: IntentionAction): SqlActionEdit {
  const replacements = action.replacements ?? [
    { span: action.span, replacement: action.replacement },
  ];
  return {
    changes: replacements.map((entry) => ({
      from: entry.span.start,
      to: entry.span.end,
      insert: entry.replacement,
    })),
  };
}
export function sqlInListEdit(
  snapshot: SqlActionSnapshot,
  source: string,
  provider: RelationalProvider,
  keywordCase: SqlFormatterCase,
): {
  result: SqlInListPasteResult;
  edit?: SqlActionEdit;
} {
  const result = buildSqlInConditionFromPasteSource(source, keywordCase, provider);
  if (!result.ok) return { result };
  const range = snapshot.state.selection.main,
    line = snapshot.state.doc.lineAt(range.from),
    prefix = snapshot.state.sliceDoc(line.from, range.from);
  const insert = insertTextForSqlInCondition(result.sql, prefix);
  return {
    result,
    edit: {
      changes: { from: range.from, to: range.to, insert },
      anchor: range.from + insert.length,
    },
  };
}
export function sqlInListIssue(result: SqlInListPasteResult, locale?: Locale): string {
  const tConnector = createTranslator(connectorMessages, locale);
  if (result.ok) return '';
  return result.reason === 'too-large'
    ? tConnector('listContentMustNotExceedMib')
    : result.reason === 'too-many-values'
      ? tConnector('aListCanContainAtMostValues')
      : result.reason === 'not-list'
        ? tConnector('separateValuesWithNewlinesCommasOrTabsEncloseASingle')
        : tConnector('theListContainsNoUsableValues');
}
/** Metadata-free star expansion uses actual parsed CTE/derived outputs or explicit user fields. */
export function sqlWildcardFields(
  snapshot: SqlActionSnapshot,
  provider: RelationalProvider,
): {
  id: string;
  label: string;
  fields: string[];
}[] {
  const sql = snapshot.state.doc.toString(),
    cursor = snapshot.state.selection.main.head;
  const context = prepareExpandWildcardContext(sql, cursor, provider);
  return (
    context?.rowSources.map((source) => ({
      id: source.id,
      label: source.alias ?? source.name,
      fields: source.columnAliases ?? source.columns ?? [],
    })) ?? []
  );
}
export async function sqlWildcardEdit(
  snapshot: SqlActionSnapshot,
  provider: RelationalProvider,
  fields: Record<string, string[]>,
): Promise<SqlActionEdit | null> {
  const sql = snapshot.state.doc.toString(),
    cursor = snapshot.state.selection.main.head;
  const context = prepareExpandWildcardContext(sql, cursor, provider);
  if (!context || context.rowSources.some((source) => !fields[source.id]?.length)) return null;
  const model = buildSqlSemanticModel(sql, cursor, { databaseType: provider }),
    dialect = sqlSemanticDialectFor({ provider });
  const qualified = model.cursorIntent.qualifierParts.length > 0;
  const columns = context.rowSources.flatMap((source) =>
    fields[source.id].map((name) => ({ name, source })),
  );
  const replacement = qualified
    ? columns
        .map(({ name, source }, index) => {
          const quoted = dialect.quoteIdentifier(name);
          return context.rowSources.length > 1 || (qualified && index > 0)
            ? `${dialect.quoteIdentifier(source.alias ?? source.name)}.${quoted}`
            : quoted;
        })
        .join(', ')
    : await buildExpandWildcardReplacement(
        provider,
        context.rowSources,
        async (source) => fields[source.id],
      );
  return {
    changes: { from: context.starSpan.start, to: context.starSpan.end, insert: replacement },
    anchor: context.starSpan.start,
    head: context.starSpan.start + replacement.length,
  };
}
/** DBX context-menu comment actions cover complete selected lines as one transaction. */
export function sqlLineCommentEdit(snapshot: SqlActionSnapshot): SqlActionEdit {
  const state = snapshot.state,
    range = state.selection.main;
  const first = state.doc.lineAt(range.from),
    last = state.doc.lineAt(Math.max(range.from, range.to - (range.empty ? 0 : 1)));
  const lines = state.sliceDoc(first.from, last.to).split('\n');
  const remove = lines.filter((line) => line.trim()).every((line) => /^\s*--(?:\s|$)/.test(line));
  const insert = lines
    .map((line) =>
      !line.trim()
        ? line
        : remove
          ? line.replace(/^(\s*)-- ?/, '$1')
          : line.replace(/^(\s*)/, '$1-- '),
    )
    .join('\n');
  return {
    changes: { from: first.from, to: last.to, insert },
    anchor: first.from,
    head: first.from + insert.length,
  };
}
export function sqlBlockCommentEdit(
  snapshot: SqlActionSnapshot,
  provider: RelationalProvider,
): SqlActionEdit | null {
  const range = snapshot.state.selection.main;
  if (range.empty) return null;
  const original = snapshot.state.sliceDoc(range.from, range.to),
    tokens = tokenizeSqlSemantic(original, provider);
  let replacement: string;
  if (
    tokens.length === 1 &&
    tokens[0].kind === 'comment' &&
    /^\/\*(?![!+])/.test(original) &&
    original.endsWith('*/')
  )
    replacement = original.slice(2, -2).replace(/^ | $/g, '');
  else {
    if (original.includes('*/')) return null;
    replacement = `/* ${original} */`;
  }
  return {
    changes: { from: range.from, to: range.to, insert: replacement },
    anchor: range.from,
    head: range.from + replacement.length,
  };
}
