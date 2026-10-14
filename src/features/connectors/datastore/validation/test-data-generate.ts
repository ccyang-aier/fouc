import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './test-data-generate.messages';
import { localizedValidationValues } from './values';
const keys = {
  'test-data-generate.invalidConfiguration': 'invalidConfiguration',
  'test-data-generate.generatedDataExceedsMibReduceRowsOrText':
    'generatedDataExceedsMibReduceRowsOrText',
  'test-data-generate.rowStillCannotSatisfyBatchUniquenessAfterAttempts':
    'rowStillCannotSatisfyBatchUniquenessAfterAttempts',
  'test-data-generate.localGenerationCancelledNoCommitWasPrepared':
    'localGenerationCancelledNoCommitWasPrepared',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
