import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './completion.messages';
import { snippet, type Completion, type CompletionSource } from '@codemirror/autocomplete';
import type { RelationalProvider, SqlFormatterCase } from '@fouc/shared';
import { sqlCompletionPosition } from '../../sql-completion-context';
import { createSqlFunctionDocumentationDom } from './tooltip-dom';
import { MAX_SQL_ASSISTANCE_DOCUMENT_CHARS } from './signature';
import {
  FUNCTION_CATEGORY_LABELS,
  sqlFunctionRegistry,
  type SqlFunctionDefinition,
} from './registry';
export type SqlFunctionSettings = {
  keywordCase?: SqlFormatterCase;
  functionCase?: SqlFormatterCase;
};
const GENERATED_KEYWORDS = /\b(?:AS|FROM|IN|INTERVAL|OVER|PARTITION|BY|ORDER)\b/g;
const MYSQL_TEMPLATES = new Map([
  ['DATE_ADD', '(${date}, INTERVAL ${expr} ${unit})'],
  ['DATE_SUB', '(${date}, INTERVAL ${expr} ${unit})'],
  ['POSITION', '(${substring} IN ${string})'],
]);
function functionName(name: string, settings: SqlFunctionSettings): string {
  return settings.functionCase === 'lower' ? name.toLowerCase() : name;
}
function generatedKeywordCase(template: string, settings: SqlFunctionSettings): string {
  return template
    .split(/(\$\{[^}]*\})/g)
    .map((part) =>
      part.startsWith('${')
        ? part
        : part.replace(GENERATED_KEYWORDS, (word) =>
            settings.keywordCase === 'lower' ? word.toLowerCase() : word,
          ),
    )
    .join('');
}
/** Native SQL grammar is retained while argument fields participate in Tab navigation. */
export function sqlFunctionTemplate(
  definition: SqlFunctionDefinition,
  provider: RelationalProvider,
  settings: SqlFunctionSettings = {},
  openingParenExists = false,
): string {
  const name = functionName(definition.name, settings);
  if (openingParenExists) return name;
  const parameters = definition.parameters
    .map((parameter) => `\${${parameter.replace(/^\.\.\./, '')}}`)
    .join(', ');
  const special = provider === 'mysql' ? MYSQL_TEMPLATES.get(definition.name) : undefined;
  let suffix = special ?? `(${parameters})`;
  if (definition.name === 'CAST') suffix = '(${expression} AS ${type})';
  if (definition.name === 'EXTRACT') suffix = '(${unit} FROM ${date})';
  if (definition.kind === 'window')
    suffix += ' OVER (PARTITION BY ${partition_column} ORDER BY ${order_column})';
  return name + generatedKeywordCase(suffix, settings);
}
/** DBX's ASCII match tiers: exact, initials, prefix, substring, then ordered fuzzy. */
export function sqlFunctionMatchScore(candidate: string, prefix: string): number {
  if (!prefix) return 1;
  const name = candidate.toLowerCase(),
    typed = prefix.toLowerCase();
  if (name === typed) return 3000 - name.length;
  if (name.startsWith(typed)) return 2000 - name.length;
  const initials = name
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('');
  if (initials.startsWith(typed)) return 2400 + (initials === typed ? 400 : 0) - name.length;
  const substring = name.indexOf(typed);
  if (substring >= 0)
    return 900 + (substring === 0 || name[substring - 1] === '_' ? 400 : 0) - name.length;
  let cursor = 0,
    gap = 0,
    first = -1;
  for (const letter of typed) {
    const next = name.indexOf(letter, cursor);
    if (next < 0) return -1;
    if (first < 0) first = next;
    gap += next - cursor;
    cursor = next + 1;
  }
  return 1200 + Math.max(0, 700 - first * 35) - gap * 10 - name.length;
}
export function buildFunctionSnippetItems(
  prefix: string,
  provider: RelationalProvider,
  settings: SqlFunctionSettings = {},
  openingParenExists = false,
  locale?: Locale,
): Completion[] {
  const tConnector = createTranslator(connectorMessages, locale);
  return [...sqlFunctionRegistry(provider, locale).values()]
    .map((definition) => ({ definition, score: sqlFunctionMatchScore(definition.name, prefix) }))
    .filter(({ score }) => score >= 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.definition.name.localeCompare(right.definition.name),
    )
    .map(({ definition, score }) => ({
      label: functionName(definition.name, settings),
      type: 'function',
      detail: `${definition.kind === 'window' ? tConnector('windowFunctions') : tConnector('builtInFunctions')} · ${FUNCTION_CATEGORY_LABELS(locale)[definition.category]}`,
      info: () => createSqlFunctionDocumentationDom(definition, provider, locale),
      apply: snippet(sqlFunctionTemplate(definition, provider, settings, openingParenExists)),
      boost: Math.min(40, Math.max(5, Math.round(score / 100))),
    }));
}
/** Current callback settings are read on each request, including after tab-cache reuse. */
export function sqlFunctionCompletion(
  provider: RelationalProvider,
  getSettings: () => SqlFunctionSettings,
  locale?: Locale,
): CompletionSource {
  return (context) => {
    if (context.state.doc.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS) return null;
    const source = context.state.doc.toString();
    const position = sqlCompletionPosition(source, context.pos, provider, context.state);
    if (
      !position ||
      position.quoted ||
      position.qualifier.length ||
      position.tableContext ||
      (!context.explicit && !position.prefix)
    )
      return null;
    const openingParenExists = /^\s*\(/.test(source.slice(position.to));
    const options = buildFunctionSnippetItems(
      position.prefix,
      provider,
      getSettings(),
      openingParenExists,
      locale,
    );
    return options.length ? { from: position.from, to: position.to, options } : null;
  };
}
