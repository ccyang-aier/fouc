import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './database-export-values.messages';
import { localizedValidationValues } from './values';
const keys = {
  'database-export-values.theBinaryCellContainsInvalidBaseData':
    'theBinaryCellContainsInvalidBaseData',
  'database-export-values.theResultContainsJavascriptNumbersThatCannotBe':
    'theResultContainsJavascriptNumbersThatCannotBe',
  'database-export-values.cellsAreNestedBeyondLevels': 'cellsAreNestedBeyondLevels',
  'database-export-values.sqlIdentifiersMustNotBeEmptyOrContain':
    'sqlIdentifiersMustNotBeEmptyOrContain',
  'database-export-values.postgresqlTextDoesNotSupportNulExportBinary':
    'postgresqlTextDoesNotSupportNulExportBinary',
  'database-export-values.arrayCellsAreNestedBeyondLevels': 'arrayCellsAreNestedBeyondLevels',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
