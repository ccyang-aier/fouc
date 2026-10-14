import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-import-encoding.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-import-encoding.importFilesMustNotExceedMib': 'importFilesMustNotExceedMib',
  'table-import-encoding.theFileContainsBytesThatCannotBeDecoded':
    'theFileContainsBytesThatCannotBeDecoded',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
