import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './test-data-random.messages';
import { localizedValidationValues } from './values';
const keys = {
  'test-data-random.theRandomRangeMinimumMustNotExceedThe': 'theRandomRangeMinimumMustNotExceedThe',
  'test-data-random.candidatesMustNotBeEmpty': 'candidatesMustNotBeEmpty',
  'test-data-random.decimalPlacesMustBe': 'decimalPlacesMustBe',
  'test-data-random.enterAnOrdinaryDecimalWithAtMostDigits':
    'enterAnOrdinaryDecimalWithAtMostDigits',
  'test-data-random.valueExceedsDecimalPlacesTheGeneratorDoesNot':
    'valueExceedsDecimalPlacesTheGeneratorDoesNot',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
