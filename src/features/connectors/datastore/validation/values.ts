import { isValidationIssue, type ValidationValue } from '@fouc/shared';
import { getLocale, type Locale, type MessageValues } from '@/lib/i18n';
import { formatValidationIssue } from './index';

function localizedValue(value: ValidationValue, locale?: Locale): string | number {
  if (isValidationIssue(value)) return formatValidationIssue(value, locale);
  if (Array.isArray(value))
    return value.map((item) => localizedValue(item, locale)).join(locale === 'en-US' ? '; ' : '；');
  return value as string | number;
}

export function localizedValidationValues(
  values: Readonly<Record<string, ValidationValue>>,
  locale: Locale = getLocale(),
): MessageValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, localizedValue(value, locale)]),
  );
}
