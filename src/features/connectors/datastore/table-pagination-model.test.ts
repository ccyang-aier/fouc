import { expect, test } from 'bun:test';
import {
  lastTablePageOffset,
  loadedTableTotal,
  readTablePageSize,
  saveTablePageSize,
  tablePageOffset,
  tablePageSize,
  TABLE_PAGE_SIZE_STORAGE_PREFIX,
} from './table-pagination-model';

test('page size and page offsets keep the native limits, clamp known totals and never round unsafe offsets', () => {
  expect(tablePageSize('1000')).toBe(1000);
  expect(tablePageSize(1)).toBe(1);
  for (const value of ['', 0, 1001, '1.5', '1e2', Infinity, null, true])
    expect(tablePageSize(value)).toBeNull();
  expect(lastTablePageOffset('0', 50)).toBe(0);
  expect(lastTablePageOffset('100', 50)).toBe(50);
  expect(lastTablePageOffset('101', 50)).toBe(100);
  expect(lastTablePageOffset('900719925474099312345', 100)).toBeNull();
  expect(tablePageOffset('3', 50, null)).toBe(100);
  expect(tablePageOffset('3', 50, '6')).toBe(0);
  expect(tablePageOffset('100001', 100, null)).toBe(10_000_000);
  expect(tablePageOffset('100002', 100, null)).toBeNull();
  for (const input of ['0', '-1', '2.5', '', '900719925474099312345'])
    expect(tablePageOffset(input, 50, null)).toBeNull();
});
test('loaded rows only imply a total on a nonempty last page or an empty first page', () => {
  expect(loadedTableTotal({ offset: 0, rows: [], hasMore: false })).toBe('0');
  expect(loadedTableTotal({ offset: 0, rows: [1, 2], hasMore: true })).toBeNull();
  expect(loadedTableTotal({ offset: 100, rows: [1, 2], hasMore: false })).toBe('102');
  expect(loadedTableTotal({ offset: 100, rows: [], hasMore: false })).toBeNull();
});
test('defaults are isolated by connection/database; invalid or denied storage never reports a saved default', () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  const source = JSON.stringify(['connection-a', 'main']),
    other = JSON.stringify(['connection-b', 'main']);
  expect(readTablePageSize(storage, source)).toBe(100);
  expect(saveTablePageSize(storage, source, 500)).toBe(true);
  expect(readTablePageSize(storage, source)).toBe(500);
  expect(readTablePageSize(storage, other)).toBe(100);
  expect(saveTablePageSize(storage, source, 1001)).toBe(false);
  values.set(TABLE_PAGE_SIZE_STORAGE_PREFIX + source, '0');
  expect(readTablePageSize(storage, source)).toBe(100);
  const denied = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  expect(readTablePageSize(denied, source)).toBe(100);
  expect(saveTablePageSize(denied, source, 50)).toBe(false);
  expect(saveTablePageSize(undefined, source, 50)).toBe(false);
});
