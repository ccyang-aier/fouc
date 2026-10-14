import { createUiMessages, uiText } from '../../../i18n/ui-message';
import { createTranslator, type Locale, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './formatter.messages';
/** Display-only DBX formatter subset. No evaluated templates, numeric coercion or mutated driver values. */
import { formatJsonSource, type DatabaseCell } from '@fouc/shared';
import { databaseCellText } from '../../cell-format';
const connectorUiMessages = createUiMessages(connectorMessages);
export type ColumnFormatter =
  | {
      type: 'datetime';
      unit: 'auto' | 'seconds' | 'milliseconds';
      timeZone: string;
      pattern: string;
    }
  | {
      type: 'json-path';
      path: string;
    }
  | {
      type: 'mask';
      prefix: number;
      suffix: number;
    }
  | {
      type: 'template';
      template: string;
    };
export type FormattedGridValue = {
  text: string;
  error?: string;
};
const DATE_TOKENS = /\[[^\]]*\]|YYYY|SSS|ZZ|MM|DD|HH|hh|mm|ss|YY|M|D|H|h|m|s|Z|A|a|[^A-Za-z\[\]]+/g;
const timezoneFormatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timezoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    });
    if (timezoneFormatters.size >= 64)
      timezoneFormatters.delete(timezoneFormatters.keys().next().value!);
    timezoneFormatters.set(timeZone, formatter);
  }
  return formatter;
}
export function supportedGridTimeZones(): string[] {
  try {
    return ['UTC', ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== 'UTC')];
  } catch {
    return ['UTC', 'Asia/Shanghai', 'America/New_York', 'Europe/London'];
  }
}
export function parseGridJsonPath(path: string): (string | number)[] {
  if (!path || path.length > 1024)
    throw connectorUiMessages.error('jsonPathsMustContainCharacters');
  let index = path.startsWith('$') ? 1 : 0;
  const segments: (string | number)[] = [];
  while (index < path.length) {
    if (path[index] === '.' || index === 0) {
      if (path[index] === '.') index++;
      const match = /^[\p{L}_$][\p{L}\p{N}_$-]*/u.exec(path.slice(index));
      if (!match)
        throw connectorUiMessages.error('pathsSupportFieldIndexOrFieldWildcardsAreNotSupported');
      segments.push(match[0]);
      index += match[0].length;
    } else if (path[index] === '[') {
      const match = /^\[(\d+|"(?:[^"\\]|\\.)*")\]/.exec(path.slice(index));
      if (!match) throw connectorUiMessages.error('useANonNegativeIndexOrAJsonDoubleQuoted');
      const value = match[1][0] === '"' ? (JSON.parse(match[1]) as string) : Number(match[1]);
      if (typeof value === 'number' && !Number.isSafeInteger(value))
        throw connectorUiMessages.error('theJsonArrayIndexExceedsTheSafeRange');
      segments.push(value);
      index += match[0].length;
    } else throw connectorUiMessages.error('invalidJsonPathSyntax');
    if (segments.length > 32) throw connectorUiMessages.error('jsonPathsSupportUpToLevels');
  }
  return segments;
}
/** Validated JSON source slices preserve large number tokens and duplicate object members. */
function jsonSourceAtPath(raw: string, path: readonly (string | number)[]): string | undefined {
  let source = formatJsonSource(raw);
  function stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length) {
      if (text[index] === '\\') index += 2;
      else if (text[index++] === '"') return index;
    }
    return index;
  }
  function valueEnd(text: string, start: number): number {
    if (text[start] === '"') return stringEnd(text, start);
    if (text[start] !== '{' && text[start] !== '[') {
      let end = start;
      while (end < text.length && !/[\],}]/.test(text[end])) end++;
      return end;
    }
    let depth = 0,
      index = start;
    while (index < text.length) {
      if (text[index] === '"') index = stringEnd(text, index);
      else {
        if (text[index] === '{' || text[index] === '[') depth++;
        if (text[index] === '}' || text[index] === ']') depth--;
        index++;
        if (!depth) return index;
      }
    }
    return index;
  }
  for (const segment of path) {
    let found: string | undefined,
      index = 1,
      arrayIndex = 0;
    if (typeof segment === 'number' && source[0] === '[') {
      while (index < source.length - 1) {
        const end = valueEnd(source, index);
        if (arrayIndex++ === segment) {
          found = source.slice(index, end);
          break;
        }
        index = end + 1;
      }
    } else if (typeof segment === 'string' && source[0] === '{') {
      while (index < source.length - 1) {
        const keyEnd = stringEnd(source, index),
          key = JSON.parse(source.slice(index, keyEnd)) as string,
          start = keyEnd + 1,
          end = valueEnd(source, start);
        if (key === segment) found = source.slice(start, end);
        index = end + 1;
      }
    }
    if (found === undefined) return undefined;
    source = found;
  }
  return source;
}
export function validateColumnFormatter(value: unknown, locale?: Locale): string | null {
  const tConnector = createTranslator(connectorMessages, locale);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return tConnector('invalidFormattingSettings');
  const formatter = value as Record<string, unknown>;
  try {
    if (formatter.type === 'datetime') {
      if (!['auto', 'seconds', 'milliseconds'].includes(String(formatter.unit)))
        return tConnector('selectATimeUnit');
      if (typeof formatter.timeZone !== 'string' || formatter.timeZone.length > 100)
        return tConnector('selectAValidTimeZone');
      dateFormatter(formatter.timeZone);
      if (
        typeof formatter.pattern !== 'string' ||
        !formatter.pattern ||
        formatter.pattern.length > 100 ||
        formatter.pattern.match(DATE_TOKENS)?.join('') !== formatter.pattern
      )
        return tConnector('dateFormatsSupportYyyyMmDdHhMmSsSss');
    } else if (formatter.type === 'json-path') {
      if (typeof formatter.path !== 'string') return tConnector('enterAJsonPath');
      parseGridJsonPath(formatter.path);
    } else if (formatter.type === 'mask') {
      if (
        ![formatter.prefix, formatter.suffix].every(
          (count) =>
            typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 1000,
        )
      )
        return tConnector('theNumberOfVisibleCharactersMustBeAnIntegerFrom');
    } else if (formatter.type === 'template') {
      if (typeof formatter.template !== 'string' || formatter.template.length > 4096)
        return tConnector('templatesSupportUpToCharacters');
      if (/\$\{(?!(?:value|upper|lower|length)\})/.test(formatter.template))
        return tConnector('templatesSupportOnlyAnd');
    } else return tConnector('unsupportedDisplayFormat');
    return null;
  } catch (reason) {
    return reason instanceof Error
      ? uiText(reason, locale ?? getLocale())
      : tConnector('invalidFormattingSettings');
  }
}
function parseGridDate(value: DatabaseCell, unit: 'auto' | 'seconds' | 'milliseconds'): Date {
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+$/.test(value))) {
    const source = String(value);
    if (!/^-?\d+$/.test(source) || (typeof value === 'number' && !Number.isSafeInteger(value)))
      throw connectorUiMessages.error('timestampsMustBeExactIntegers');
    if (unit === 'auto' && !/^\d{10}(?:\d{3})?$/.test(source))
      throw connectorUiMessages.error(
        'automaticTimestampsRecognizeDigitSecondsOrDigitMillisecondsOnlySpecify',
      );
    const milliseconds =
      BigInt(source) *
      (unit === 'seconds' || (unit === 'auto' && source.length === 10) ? 1000n : 1n);
    if (milliseconds < -8640000000000000n || milliseconds > 8640000000000000n)
      throw connectorUiMessages.error('timestampIsOutsideTheSupportedDateRange');
    return new Date(Number(milliseconds));
  }
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(value)
  )
    throw connectorUiMessages.error('supportsIsoDatesWithTimeZonesDatesOrIntegerTimestamps');
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value.replace(' ', 'T');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number),
    calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(0, 0, 0, 0);
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    throw connectorUiMessages.error('theDateDoesNotExist');
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()))
    throw connectorUiMessages.error('invalidDateOrTimeZoneOffset');
  return date;
}
export function applyColumnFormatter(
  value: DatabaseCell,
  formatter?: ColumnFormatter,
  locale?: Locale,
): FormattedGridValue {
  const tConnector = createTranslator(connectorMessages, locale);
  const original = databaseCellText(value, locale);
  if (!formatter || value === null) return { text: original };
  try {
    if (formatter.type === 'mask') {
      const chars = Array.from(original),
        keep = formatter.prefix + formatter.suffix;
      return {
        text:
          chars.length <= keep
            ? '*'.repeat(chars.length)
            : chars.slice(0, formatter.prefix).join('') +
              '*'.repeat(chars.length - keep) +
              (formatter.suffix ? chars.slice(-formatter.suffix).join('') : ''),
      };
    }
    if (formatter.type === 'template')
      return {
        text: formatter.template.replace(/\$\{(value|upper|lower|length)\}/g, (_, token: string) =>
          token === 'upper'
            ? original.toUpperCase()
            : token === 'lower'
              ? original.toLowerCase()
              : token === 'length'
                ? String(Array.from(original).length)
                : original,
        ),
      };
    if (formatter.type === 'json-path') {
      if (original.length > 1000000)
        throw connectorUiMessages.error('jsonExceedsMbShowingTheOriginalValue');
      const path = parseGridJsonPath(formatter.path);
      if (typeof value === 'string') {
        const selected = jsonSourceAtPath(value, path);
        return {
          text:
            selected === undefined
              ? ''
              : selected === 'null'
                ? 'NULL'
                : selected[0] === '"'
                  ? (JSON.parse(selected) as string)
                  : selected,
        };
      }
      let selected: DatabaseCell | undefined = value;
      for (const segment of path) {
        if (
          typeof selected !== 'object' ||
          selected === null ||
          (typeof segment === 'number' && !Array.isArray(selected)) ||
          (typeof segment === 'string' && Array.isArray(selected)) ||
          !Object.hasOwn(selected, segment)
        )
          return { text: '' };
        selected =
          typeof segment === 'number'
            ? (selected as DatabaseCell[])[segment]
            : (selected as Record<string, DatabaseCell>)[segment];
      }
      return { text: selected === undefined ? '' : databaseCellText(selected, locale) };
    }
    const date = parseGridDate(value, formatter.unit),
      parts = Object.fromEntries(
        dateFormatter(formatter.timeZone)
          .formatToParts(date)
          .map((part) => [part.type, part.value]),
      );
    const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.replace('GMT', ''),
      hour = Number(parts.hour);
    const tokens: Record<string, string> = {
      YYYY: parts.year.padStart(4, '0'),
      YY: parts.year.slice(-2),
      MM: parts.month,
      M: String(Number(parts.month)),
      DD: parts.day,
      D: String(Number(parts.day)),
      HH: parts.hour,
      H: String(hour),
      hh: String(hour % 12 || 12).padStart(2, '0'),
      h: String(hour % 12 || 12),
      mm: parts.minute,
      m: String(Number(parts.minute)),
      ss: parts.second,
      s: String(Number(parts.second)),
      SSS: String(date.getUTCMilliseconds()).padStart(3, '0'),
      Z: offset,
      ZZ: offset.replace(':', ''),
      A: hour < 12 ? 'AM' : 'PM',
      a: hour < 12 ? 'am' : 'pm',
    };
    return {
      text: formatter.pattern.replace(DATE_TOKENS, (token) =>
        token.startsWith('[') ? token.slice(1, -1) : (tokens[token] ?? token),
      ),
    };
  } catch (reason) {
    return {
      text: original,
      error:
        reason instanceof Error
          ? uiText(reason, locale ?? getLocale())
          : tConnector('cannotDisplayThisFormat'),
    };
  }
}
