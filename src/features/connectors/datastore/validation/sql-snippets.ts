import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './sql-snippets.messages';
import { localizedValidationValues } from './values';
const keys = {
  'sql-snippets.atMostSqlSnippetsAreAllowed': 'atMostSqlSnippetsAreAllowed',
  'sql-snippets.invalidSqlSnippetFormat': 'invalidSqlSnippetFormat',
  'sql-snippets.sqlSnippetsRequireACompleteIdNamePrefix': 'sqlSnippetsRequireACompleteIdNamePrefix',
  'sql-snippets.invalidSqlSnippetId': 'invalidSqlSnippetId',
  'sql-snippets.sqlSnippetNamesMustContainCharacters': 'sqlSnippetNamesMustContainCharacters',
  'sql-snippets.sqlSnippetPrefixesMustContainLettersDigitsUnderscores':
    'sqlSnippetPrefixesMustContainLettersDigitsUnderscores',
  'sql-snippets.sqlSnippetContentMustNotBeEmptyAnd': 'sqlSnippetContentMustNotBeEmptyAnd',
  'sql-snippets.sqlSnippetsMustBeValidUtf': 'sqlSnippetsMustBeValidUtf',
  'sql-snippets.invalidSqlSnippetEnabledStatus': 'invalidSqlSnippetEnabledStatus',
  'sql-snippets.sqlSnippetIdsMustBeUnique': 'sqlSnippetIdsMustBeUnique',
  'sql-snippets.sqlSnippetPrefixesMustBeUnique': 'sqlSnippetPrefixesMustBeUnique',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
