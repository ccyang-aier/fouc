import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-import-mapping.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-import-mapping.columnMappingsSupportAtMostEntries': 'columnMappingsSupportAtMostEntries',
  'table-import-mapping.sourceColumnDoesNotExist': 'sourceColumnDoesNotExist',
  'table-import-mapping.sourceColumnMappedMoreThanOnce': 'sourceColumnMappedMoreThanOnce',
  'table-import-mapping.targetColumnDoesNotExist': 'targetColumnDoesNotExist',
  'table-import-mapping.generatedColumnsCannotBeImported': 'generatedColumnsCannotBeImported',
  'table-import-mapping.targetColumnMappedMoreThanOnce': 'targetColumnMappedMoreThanOnce',
  'table-import-mapping.mapAtLeastOneTargetColumn': 'mapAtLeastOneTargetColumn',
  'table-import-mapping.requiredColumnsAreNotMapped': 'requiredColumnsAreNotMapped',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
