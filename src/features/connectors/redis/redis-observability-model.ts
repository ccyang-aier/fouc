import { getLocale, type Locale } from '@/lib/i18n';
import type { RedisInfoSection, RedisSlowlogEntry } from '@fouc/shared';
import { createUiMessages, uiText } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-observability-model';
const { message: uiMessage } = createUiMessages(unitMessages);

export function redisInfoValue(
  sections: RedisInfoSection[],
  section: string,
  key: string,
): string | null {
  return (
    sections.find((item) => item.name === section)?.entries.find((item) => item.key === key)
      ?.value ?? null
  );
}
function integer(value: string | null): bigint | null {
  return value !== null && /^\d+$/.test(value) ? BigInt(value) : null;
}
export function redisInteger(value: string | null, locale: Locale = getLocale()): string {
  const number = integer(value);
  return number === null ? uiText(uiMessage('未知'), locale) : number.toLocaleString(locale);
}
export function redisBytes(value: string | null, locale: Locale = getLocale()): string {
  const number = integer(value);
  if (number === null) return uiText(uiMessage('未知'), locale);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
  let unit = 0,
    divisor = 1n;
  while (number >= divisor * 1024n && unit < units.length - 1) {
    divisor *= 1024n;
    unit++;
  }
  if (!unit) return `${number} B`;
  const scaled = (number * 100n + divisor / 2n) / divisor;
  return `${scaled / 100n}.${String(scaled % 100n).padStart(2, '0')} ${units[unit]}`;
}
export function redisHitRatio(
  hits: string | null,
  misses: string | null,
  locale: Locale = getLocale(),
): string {
  const hit = integer(hits),
    miss = integer(misses);
  if (hit === null || miss === null || hit + miss === 0n) return uiText(uiMessage('未知'), locale);
  const total = hit + miss,
    percent = (hit * 10000n + total / 2n) / total;
  return `${percent / 100n}.${String(percent % 100n).padStart(2, '0')}%`;
}
export function redisTotalKeys(sections: RedisInfoSection[]): string | null {
  const keyspace = sections.find((section) => section.name === 'Keyspace');
  if (!keyspace) return null;
  let total = 0n;
  for (const entry of keyspace.entries) {
    if (!/^db\d+$/.test(entry.key)) continue;
    const keys = /(?:^|,)keys=(\d+)(?:,|$)/.exec(entry.value)?.[1];
    if (!keys) return null;
    total += BigInt(keys);
  }
  return total.toString();
}
export function redisInfoFilter(sections: RedisInfoSection[], search: string): RedisInfoSection[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return sections;
  return sections
    .map((section) => ({
      ...section,
      entries: section.name.toLowerCase().includes(needle)
        ? section.entries
        : section.entries.filter((entry) =>
            `${entry.key}\n${entry.value}`.toLowerCase().includes(needle),
          ),
    }))
    .filter((section) => section.entries.length);
}
export function redisSlowlogCommand(entry: RedisSlowlogEntry): string {
  return entry.arguments
    .map((argument, index) =>
      argument.encoding === 'binary'
        ? argument.display
        : index === 0 && /^[\w.-]+$/.test(argument.display)
          ? argument.display
          : JSON.stringify(argument.display),
    )
    .join(' ');
}
export type SlowlogSortField =
  'id' | 'timestampSeconds' | 'durationMicros' | 'command' | 'clientAddress' | 'clientName';
export function redisSlowlogSort(
  entries: RedisSlowlogEntry[],
  field: SlowlogSortField,
  direction: 'asc' | 'desc',
) {
  const sign = direction === 'asc' ? 1 : -1;
  return [...entries].sort((left, right) => {
    let comparison: number;
    if (field === 'id' || field === 'timestampSeconds' || field === 'durationMicros') {
      const a = BigInt(left[field]),
        b = BigInt(right[field]);
      comparison = a < b ? -1 : a > b ? 1 : 0;
    } else {
      const a = field === 'command' ? redisSlowlogCommand(left) : (left[field]?.display ?? null);
      const b = field === 'command' ? redisSlowlogCommand(right) : (right[field]?.display ?? null);
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
      comparison = a.localeCompare(b);
    }
    return (
      comparison * sign ||
      (BigInt(left.id) > BigInt(right.id) ? -1 : BigInt(left.id) < BigInt(right.id) ? 1 : 0)
    );
  });
}
export function redisSlowlogTime(seconds: string, locale: Locale = getLocale()): string {
  const value = BigInt(seconds);
  if (value === 0n) return uiText(uiMessage('未提供'), locale);
  if (value > 8640000000000n) return `${seconds} s (Unix)`;
  return new Date(Number(value * 1000n)).toLocaleString(locale, { hour12: false });
}
