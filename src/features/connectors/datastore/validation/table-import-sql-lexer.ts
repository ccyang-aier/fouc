import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-import-sql-lexer.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-import-sql-lexer.expectedOnlyInsertIntoValuesWithExplicitColumn':
    'expectedOnlyInsertIntoValuesWithExplicitColumn',
  'table-import-sql-lexer.sqlImportDoesNotExecuteMysqlVersionConditional':
    'sqlImportDoesNotExecuteMysqlVersionConditional',
  'table-import-sql-lexer.sqlCommentsSupportAtMostNestingLevels':
    'sqlCommentsSupportAtMostNestingLevels',
  'table-import-sql-lexer.sqlBlockCommentIsNotClosed': 'sqlBlockCommentIsNotClosed',
  'table-import-sql-lexer.sqlQuoteIsNotClosed': 'sqlQuoteIsNotClosed',
  'table-import-sql-lexer.incompleteSqlStringEscape': 'incompleteSqlStringEscape',
  'table-import-sql-lexer.convertPostgresqlNonAsciiByteEscapesToUtf':
    'convertPostgresqlNonAsciiByteEscapesToUtf',
  'table-import-sql-lexer.invalidSqlStringHexadecimalEscape': 'invalidSqlStringHexadecimalEscape',
  'table-import-sql-lexer.sqlStringUnicodeEscapeIsNotAValid': 'sqlStringUnicodeEscapeIsNotAValid',
  'table-import-sql-lexer.sqlImportsSupportAtMostLexicalElementsSplit':
    'sqlImportsSupportAtMostLexicalElementsSplit',
  'table-import-sql-lexer.sqlDollarQuotedStringIsNotClosed': 'sqlDollarQuotedStringIsNotClosed',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
