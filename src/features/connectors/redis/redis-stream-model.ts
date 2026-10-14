import { getLocale, translate, type Locale } from '@/lib/i18n';
import { messages } from './i18n/redis-stream-model';
/** Exact durations without converting potentially 64-bit milliseconds to Number. */
export function redisStreamDuration(value: string | null, locale: Locale = getLocale()): string {
  if (value === null) return translate(messages, '未知', undefined, locale);
  const milliseconds = BigInt(value);
  if (milliseconds < 1000n) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000n;
  if (seconds < 60n) return `${seconds}.${String(milliseconds % 1000n).padStart(3, '0')} s`;
  if (seconds < 3600n)
    return translate(
      messages,
      '{v0} 分 {v1} 秒',
      { v0: String(seconds / 60n), v1: String(seconds % 60n) },
      locale,
    );
  if (seconds < 86400n)
    return translate(
      messages,
      '{v0} 时 {v1} 分',
      { v0: String(seconds / 3600n), v1: String((seconds % 3600n) / 60n) },
      locale,
    );
  return translate(
    messages,
    '{v0} 天 {v1} 时',
    { v0: String(seconds / 86400n), v1: String((seconds % 86400n) / 3600n) },
    locale,
  );
}
