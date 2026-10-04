import { DATABASE_ADMIN_OBJECT_LIMITS, type DatabaseAdminObjectRows, type DatabaseAdminObjectSource } from '@fouc/shared/database-admin-objects';
import type { RelationalProvider } from '@fouc/shared';

export interface AdminObjectAdapter {
  provider: RelationalProvider;
  database: string;
  query(sql: string, parameters: (string | number | boolean | null)[], maxRows: number, signal?: AbortSignal): Promise<Record<string, unknown>[]>;
}
export const catalogText = (value: unknown): string | null => value == null ? null : value instanceof Date ? value.toISOString() : String(value);
export const catalogBoolean = (value: unknown): boolean | null => value === true || value === 1 || value === 't' ? true : value === false || value === 0 || value === 'f' ? false : null;
export const errorMessage = (value: unknown): string => value instanceof Error ? value.message : String(value);

export function sourceText(value: unknown, origin: DatabaseAdminObjectSource['origin'] = 'native', alreadyTruncated = false): DatabaseAdminObjectSource {
  const text = catalogText(value);
  if (text === null) return { text: null, origin: 'unknown', complete: false, bytes: null, warning: '原生目录未提供或当前角色未获授权。' };
  const bytes = Buffer.byteLength(text);
  const truncated = alreadyTruncated || bytes > DATABASE_ADMIN_OBJECT_LIMITS.sourceBytes || text.length > DATABASE_ADMIN_OBJECT_LIMITS.sourceCharacters;
  // Decode whole UTF-8 code points; never export a truncated SQL definition as complete.
  const fragment = text.slice(0, DATABASE_ADMIN_OBJECT_LIMITS.sourceCharacters).replace(/[\uD800-\uDBFF]$/, '');
  const selected = Buffer.byteLength(fragment) > DATABASE_ADMIN_OBJECT_LIMITS.sourceBytes ? Buffer.from(fragment).subarray(0, DATABASE_ADMIN_OBJECT_LIMITS.sourceBytes).toString('utf8').replace(/\uFFFD$/, '') : fragment;
  return { text: selected, origin, complete: !truncated, bytes, warning: truncated ? '源码超过 1 MiB / 256K 字符读取上限，仅展示有界片段；完整复制与下载已禁用。' : null };
}
export function boundedRows<T>(items: T[], limit: number): DatabaseAdminObjectRows<T> {
  return { items: items.slice(0, limit), limit, hasMore: items.length > limit, complete: items.length <= limit, error: null };
}
export function unavailableRows<T>(limit: number, error: unknown): DatabaseAdminObjectRows<T> {
  return { items: [], limit, hasMore: false, complete: false, error: errorMessage(error) };
}
export async function optionalSection<T>(load: () => Promise<T>, onError: (error: unknown) => T, signal?: AbortSignal): Promise<T> {
  try { return await load(); }
  catch (error) { signal?.throwIfAborted(); return onError(error); }
}
export function quoteAdminObject(provider: RelationalProvider, value: string): string {
  return provider === 'mysql' ? '`' + value.replaceAll('`', '``') + '`' : '"' + value.replaceAll('"', '""') + '"';
}
