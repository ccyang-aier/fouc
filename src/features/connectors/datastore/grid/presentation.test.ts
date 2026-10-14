import { expect, test } from 'bun:test';
import {
  binaryGridValue,
  equalSelectedGridColumns,
  highlightedGridCell,
  jsonGridPreview,
  type GridHighlight,
} from './presentation';
import {
  defaultGridLayout,
  gridColumnKeys,
  hideGridColumns,
  visibleGridColumns,
} from './layout/model';

test('matching columns compare all visible raw fields across selected rows without coercing types', () => {
  const rows = [
      [1, 'same', null, 'NULL'],
      ['1', 'same', '', 'NULL'],
    ],
    scope = { rows: [0, 1], columns: [0], rectangular: true };
  expect(equalSelectedGridColumns(rows, scope, [0, 1, 2, 3])).toEqual([1, 3]);
  expect(equalSelectedGridColumns(rows, { ...scope, rows: [0] }, [0, 1, 2, 3])).toEqual([]);
  expect(equalSelectedGridColumns(rows, scope, [0, 2])).toEqual([]);
  const keys = gridColumnKeys(['a', 'b']);
  expect(visibleGridColumns(keys, hideGridColumns(defaultGridLayout(), keys, [0, 1]))).toHaveLength(
    1,
  );
  expect(rows[0][0]).toBe(1);
});

test('highlight targets preserve original row/column coordinates and exact value types', () => {
  const mark: GridHighlight = { mode: 'value', value: '1', rows: [3], columns: [2] };
  expect(highlightedGridCell(mark, 0, 0, 1)).toBe(false);
  expect(highlightedGridCell(mark, 0, 0, '1')).toBe(true);
  expect(highlightedGridCell({ ...mark, mode: 'rows' }, 3, 0, null)).toBe(true);
  expect(highlightedGridCell({ ...mark, mode: 'rows' }, 2, 0, null)).toBe(false);
  expect(highlightedGridCell({ ...mark, mode: 'columns' }, 8, 2, null)).toBe(true);
  expect(highlightedGridCell(null, 3, 2, '1')).toBe(false);
});

test('JSON presentation preserves numeric source tokens and rejects invalid/binary values', () => {
  const source = '{"amount":9007199254740993,"fraction":0.1000000000000000001}';
  const preview = jsonGridPreview(source)!;
  expect(preview).toContain('9007199254740993');
  expect(preview).toContain('0.1000000000000000001');
  expect(jsonGridPreview('ordinary text')).toBeNull();
  expect(jsonGridPreview(null)).toBe('null');
  expect(jsonGridPreview(false)).toBe('false');
  expect(binaryGridValue({ type: 'binary', base64: 'QUJD' })).toBe(true);
  expect(jsonGridPreview({ type: 'binary', base64: 'QUJD' })).toBeNull();
});
