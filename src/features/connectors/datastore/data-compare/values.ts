import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './values.messages';
import type { DatabaseCell, RelationalProvider } from '@fouc/shared';
import { isBinaryCell, numericExportType } from '../result-export/values';
import type { DataCompareCell } from './model';
const connectorUiMessages = createUiMessages(connectorMessages);
const decimalPattern = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
export type CompareValueBudget = {
  characters: number;
};
export class CompareValueLimitError extends Error {}
export function compareJsonType(type: string, provider?: RelationalProvider): boolean {
  return (
    /^jsonb?$/i.test(type.trim()) ||
    /^oid:(?:114|3802)$/.test(type) ||
    (provider === 'mysql' && type === '245')
  );
}
export function compareBinaryValue(
  value: DataCompareCell,
  type = '',
  provider?: RelationalProvider,
): boolean {
  return value !== undefined && isBinaryCell(value) && !compareJsonType(type, provider);
}
export function compareCellText(value: DataCompareCell, pretty = false, locale?: Locale): string {
  const tConnector = createTranslator(connectorMessages, locale);
  if (value === undefined) return tConnector('missing');
  if (value === null) return 'NULL';
  if (value === '') return '""';
  return typeof value === 'object'
    ? JSON.stringify(value, null, pretty ? 2 : undefined)
    : String(value);
}
function exactDecimal(text: string): string | null {
  const match = decimalPattern.exec(text.trim());
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? '',
    exponent = Number(match[5] ?? 0);
  if (
    Math.abs(exponent) > 8192 ||
    !Number.isInteger(exponent) ||
    (match[2] ?? '').length + fraction.length > 8192
  )
    throw connectorUiMessages.error('theDecimalValueExceedsTheDigitPrecisionLimit');
  let digits = ((match[2] ?? '') + fraction).replace(/^0+/, ''),
    scale = fraction.length - exponent;
  if (!digits) return '0:0';
  while (digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    scale--;
  }
  return `${match[1] === '-' ? '-' : ''}${digits}:${scale}`;
}
/** Typed, length-delimited tokens: text, exact decimals and JS numbers never coerce into one another. */
export function compareValueToken(
  value: DataCompareCell,
  type = '',
  provider?: RelationalProvider,
  budget: CompareValueBudget = { characters: 0 },
  depth = 0,
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  if (depth > 32) throw connectorUiMessages.error('theCellIsNestedMoreThanLevelsAndCannotBe');
  let token: string;
  if (value === undefined) token = 'missing';
  else if (value === null) token = 'null';
  else if (typeof value === 'boolean') token = value ? 'boolean:1' : 'boolean:0';
  else if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
      throw connectorUiMessages.error('theDriverReturnedANonFiniteNumberOrUnsafeInteger');
    token = `number:${Object.is(value, -0) ? '-0' : String(value)}`;
  } else if (typeof value === 'string') {
    const decimal = numericExportType(provider ?? 'postgres', type) ? exactDecimal(value) : null;
    token = decimal === null ? `text:${value.length}:${value}` : `decimal:${decimal}`;
  } else if (isBinaryCell(value) && compareBinaryValue(value, type, provider)) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64))
      throw connectorUiMessages.error('theBinaryValueContainsInvalidBase');
    const binary: Record<string, DatabaseCell> = value;
    token = `binary:${JSON.stringify(
      Object.keys(binary)
        .sort()
        .map((key) => [
          key,
          compareValueToken(binary[key], '', provider, budget, depth + 1, locale),
        ]),
    )}`;
  } else if (Array.isArray(value))
    token = `array:${JSON.stringify(value.map((cell) => compareValueToken(cell, '', provider, budget, depth + 1, locale)))}`;
  else {
    const object: Record<string, DatabaseCell> = value;
    token = `json:${JSON.stringify(
      Object.keys(object)
        .sort()
        .map((key) => [
          key,
          compareValueToken(object[key], '', provider, budget, depth + 1, locale),
        ]),
    )}`;
  }
  if (token.length > 1000000)
    throw new CompareValueLimitError(tConnector('aValueExceedsTheCharacterComparisonLimit'));
  budget.characters += token.length;
  if (budget.characters > 32000000)
    throw new CompareValueLimitError(
      tConnector('normalizedComparisonContentExceedsCharactersReduceTheResultSet'),
    );
  return token;
}
export function compareCellKind(
  value: DataCompareCell,
  type = '',
  provider?: RelationalProvider,
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  return value === undefined
    ? tConnector('missing766')
    : value === null
      ? 'NULL'
      : typeof value === 'object'
        ? compareBinaryValue(value, type, provider)
          ? tConnector('binary')
          : Array.isArray(value)
            ? tConnector('array')
            : 'JSON'
        : typeof value === 'number'
          ? tConnector('numeric')
          : typeof value === 'boolean'
            ? tConnector('boolean')
            : numericExportType(provider ?? 'postgres', type) && decimalPattern.test(value.trim())
              ? tConnector('originalDecimal')
              : tConnector('text');
}
