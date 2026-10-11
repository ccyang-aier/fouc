import { RELATIONAL_PAGE_LIMITS } from '@fouc/shared'

export const DEFAULT_TABLE_PAGE_SIZE = 100
export const TABLE_PAGE_SIZE_OPTIONS = [50, 100, 500, 1000] as const
export const TABLE_PAGE_SIZE_STORAGE_PREFIX = 'fouc:table-page-size:'

export function tablePageSize(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (!/^\d+$/.test(String(value))) return null
  const size = Number(value)
  return Number.isInteger(size) && size >= 1 && size <= RELATIONAL_PAGE_LIMITS.rows ? size : null
}
export function lastTablePageOffset(total: string, limit: number): number | null {
  if (!/^\d+$/.test(total) || tablePageSize(limit) === null) return null
  const rows = BigInt(total), size = BigInt(limit), offset = rows > 0n ? ((rows - 1n) / size) * size : 0n
  return offset <= BigInt(RELATIONAL_PAGE_LIMITS.offset) ? Number(offset) : null
}
export function tablePageOffset(input: string, limit: number, total: string | null): number | null {
  if (!/^\d+$/.test(input) || BigInt(input) < 1n || tablePageSize(limit) === null) return null
  let offset = (BigInt(input) - 1n) * BigInt(limit)
  if (total !== null) {
    const last = lastTablePageOffset(total, limit)
    if (last !== null && offset > BigInt(last)) offset = BigInt(last)
  }
  return offset <= BigInt(RELATIONAL_PAGE_LIMITS.offset) ? Number(offset) : null
}
export function loadedTableTotal(page: { offset: number; rows: readonly unknown[]; hasMore: boolean }): string | null {
  return !page.hasMore && (page.offset === 0 || page.rows.length > 0) ? String(page.offset + page.rows.length) : null
}
export function readTablePageSize(storage: Pick<Storage, 'getItem'> | undefined, scope: string): number {
  try { return tablePageSize(storage?.getItem(TABLE_PAGE_SIZE_STORAGE_PREFIX + scope)) ?? DEFAULT_TABLE_PAGE_SIZE }
  catch { return DEFAULT_TABLE_PAGE_SIZE }
}
export function saveTablePageSize(storage: Pick<Storage, 'setItem'> | undefined, scope: string, size: number): boolean {
  if (tablePageSize(size) === null || !storage) return false
  try { storage.setItem(TABLE_PAGE_SIZE_STORAGE_PREFIX + scope, String(size)); return true }
  catch { return false }
}
