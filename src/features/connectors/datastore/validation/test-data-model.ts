import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './test-data-model.messages';
import { localizedValidationValues } from './values';
const keys = {
  'test-data-model.databaseGeneratedColumn': 'databaseGeneratedColumn',
  'test-data-model.databaseAutoIncrementSequence': 'databaseAutoIncrementSequence',
  'test-data-model.sqliteNativeRowid': 'sqliteNativeRowid',
  'test-data-model.foreignKeyReferencedTablesAreNotSampledIn':
    'foreignKeyReferencedTablesAreNotSampledIn',
  'test-data-model.generationIsUnsupportedForTheCurrentType':
    'generationIsUnsupportedForTheCurrentType',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
