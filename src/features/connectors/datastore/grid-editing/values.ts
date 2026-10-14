import { createUiMessages } from '../../i18n/ui-message';
import { type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './values.messages';
/** Native DBX cell coercion subset, keeping exact numeric text and explicit NULL/empty values. */
import {
  formatJsonSource,
  type DatabaseCell,
  type DatabaseColumnInfo,
  type RelationalProvider,
} from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
const numeric =
  /\b(?:int|integer|smallint|bigint|tinyint|mediumint|int2|int4|int8|serial|bigserial|smallserial|decimal|numeric|dec|real|float|double|money|smallmoney)\b/i;
export function gridGeneratedColumn(column: DatabaseColumnInfo): boolean {
  return /\b(?:generated|identity)\b/i.test(column.extra ?? '');
}
export function gridCellEditorText(value: DatabaseCell, column?: DatabaseColumnInfo): string {
  return value === null
    ? ''
    : /\bjsonb?\b/i.test(column?.dataType ?? '')
      ? JSON.stringify(value, null, 2)
      : typeof value === 'object'
        ? !Array.isArray(value) && value.type === 'binary'
          ? String(value.base64)
          : JSON.stringify(value, null, 2)
        : String(value);
}
/** Refuse values the current save contract cannot represent; never round JSON or smuggle array text. */
function preciseJson(text: string): DatabaseCell {
  function decimalToken(token: string): string {
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)!,
      fraction = match[3] ?? '',
      exponent = Number(match[4] ?? 0);
    if (Math.abs(exponent) > 8192)
      throw connectorUiMessages.error('aJsonNumberExceedsTheSaveProtocolSPrecisionLimit');
    let digits = (match[2] + fraction).replace(/^0+/, ''),
      scale = fraction.length - exponent;
    if (!digits) return match[1] ? '-0' : '0';
    while (digits.endsWith('0')) {
      digits = digits.slice(0, -1);
      scale--;
    }
    return `${match[1]}${digits}:${scale}`;
  }
  const source = formatJsonSource(text);
  if (source === 'null')
    throw connectorUiMessages.error('theSaveProtocolCannotDistinguishJsonNullFromSqlNull');
  let index = 0;
  while (index < source.length) {
    if (source[index] === '"') {
      index++;
      while (index < source.length) {
        if (source[index] === '\\') index += 2;
        else if (source[index++] === '"') break;
      }
    } else if (source[index] === '-' || /\d/.test(source[index])) {
      const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index))![0],
        number = Number(token);
      if (
        !Number.isFinite(number) ||
        (Number.isInteger(number) && !Number.isSafeInteger(number)) ||
        decimalToken(token) !== decimalToken(String(number))
      )
        throw connectorUiMessages.error(
          'jsonContainsNumbersBeyondReliablePrecisionAndCannotBeSaved',
        );
      index += token.length;
    } else index++;
  }
  return JSON.parse(source) as DatabaseCell;
}
export function coerceGridEditValue(
  text: string,
  column: DatabaseColumnInfo,
  original: DatabaseCell,
  provider: RelationalProvider,
): DatabaseCell {
  if (text === gridCellEditorText(original, column) && original !== null) return original;
  if (/\bjsonb?\b/i.test(column.dataType)) return preciseJson(text);
  if (
    /\b(?:bytea|blob|binary|varbinary)\b/i.test(column.dataType) ||
    (original !== null &&
      typeof original === 'object' &&
      !Array.isArray(original) &&
      original.type === 'binary')
  ) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))
      throw connectorUiMessages.error('binaryValuesForMustBeValidBase', {
        p0: String(column.name),
      });
    return { type: 'binary', base64: text };
  }
  if (
    Array.isArray(original) ||
    (provider === 'postgres' &&
      (column.dataType.trim().endsWith('[]') || /^array$/i.test(column.dataType)))
  )
    throw connectorUiMessages.error('isAnArrayAndArrayAssignmentsAreUnsupportedByThe', {
      p0: String(column.name),
    });
  if (/\bbool(?:ean)?\b/i.test(column.dataType) || typeof original === 'boolean') {
    const normalized = text.trim().toLowerCase();
    if (['true', '1'].includes(normalized)) return true;
    if (['false', '0'].includes(normalized)) return false;
    throw connectorUiMessages.error('enterTrueFalseOrFor', { p0: String(column.name) });
  }
  if (
    provider === 'mysql' &&
    /^tinyint\s*\(1\)/i.test(column.dataType.trim()) &&
    /^(true|false)$/i.test(text.trim())
  )
    return text.trim().toLowerCase() === 'true' ? 1 : 0;
  if (numeric.test(column.dataType)) {
    const value = text.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))
      throw connectorUiMessages.error('mustBeADecimalNumberExplicitlyChooseEmptyStringOr', {
        p0: String(column.name),
      });
    if (
      /\b(?:int|integer|smallint|bigint|tinyint|mediumint|int2|int4|int8|serial|bigserial|smallserial)\b/i.test(
        column.dataType,
      ) &&
      !/^[+-]?\d+$/.test(value)
    )
      throw connectorUiMessages.error('mustBeAnInteger', { p0: String(column.name) });
    return value;
  }
  if (
    column.characterMaximumLength !== null &&
    Array.from(text).length > column.characterMaximumLength
  )
    throw connectorUiMessages.error('supportsUpToCharacters', {
      p0: String(column.name),
      p1: String(column.characterMaximumLength),
    });
  return text;
}
export function sameGridEditValue(left: DatabaseCell, right: DatabaseCell): boolean {
  return (
    typeof left === typeof right &&
    (typeof left === 'object'
      ? JSON.stringify(left) === JSON.stringify(right)
      : Object.is(left, right))
  );
}
export function validateGridOriginalValue(value: DatabaseCell, depth = 0, locale?: Locale): void {
  if (depth > 20)
    throw connectorUiMessages.error('theOriginalValueExceedsTheSaveProtocolSLevelNesting');
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  )
    throw connectorUiMessages.error('theOriginalRowContainsUnsafeNumbersReturnedByTheDriver');
  if (value && typeof value === 'object')
    for (const cell of Object.values(value)) validateGridOriginalValue(cell, depth + 1, locale);
}
