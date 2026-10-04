import { expect, test } from 'bun:test';
import type { DatabaseQueryResult } from '@fouc/shared';
import {
  emptyGridSelection,
  selectAllGridCells,
  selectGridTarget,
} from '../selection-controller';
import {
  formatTransposeSelection,
  selectedTransposeCells,
  transposeRecordWindow,
  transposeSelectionScope,
  transposeSourceCell,
} from './model';

const result: DatabaseQueryResult = {
  columns: ['id', 'amount', 'payload'],
  columnTypes: ['bigint', 'decimal', 'json'],
  columnSortables: [],
  rows: [
    ['9007199254740993', '0.00000000000000000001', { nested: ['α\nβ', null] }],
    ['9007199254740994', null, { type: 'binary', base64: 'AAE=' }],
  ],
  affectedRows: 0,
  executionTimeMs: 1,
  truncated: true,
  hasMore: true,
  sessionId: 'session',
  messages: [],
};
test('transpose coordinates honor hidden/reordered fields and absolute source records', () => {
  const mapping = { columns: [2, 0], records: [1] },
    selection = selectAllGridCells({ rows: 2, columns: 1 });
  expect(transposeSourceCell(mapping, 0, 0)).toEqual({
    rowIndex: 1,
    columnIndex: 2,
  });
  expect(
    [...selectedTransposeCells(result, mapping, selection)].map(
      (cell) => cell.value,
    ),
  ).toEqual([{ type: 'binary', base64: 'AAE=' }, '9007199254740994']);
  expect(transposeSelectionScope(result, mapping, selection)).toEqual({
    rows: [1],
    columns: [0, 2],
    rectangular: true,
  });
  expect(transposeSourceCell(mapping, 2, 0)).toBeNull();
});
test('transpose copying preserves large integers, decimal scale, NULL and binary bytes', () => {
  const mapping = { columns: [0, 1, 2], records: [0, 1] },
    selection = selectAllGridCells({ rows: 3, columns: 2 });
  const tsv = formatTransposeSelection(
    result,
    mapping,
    selection,
    '\t',
    true,
    (row) => [3, 7][row],
  );
  expect(tsv).toStartWith('字段\t第 3 行\t第 7 行\n');
  expect(tsv).toContain('9007199254740993\t9007199254740994');
  expect(tsv).toContain('0.00000000000000000001\tNULL');
  expect(tsv).toContain('AAE=');
  expect(
    formatTransposeSelection(
      result,
      mapping,
      selection,
      ',',
      true,
      (row) => row + 1,
    ),
  ).toContain('"9007199254740993"');
});
test('sparse transpose selection never copies unselected intersections or reports a rectangle', () => {
  const dimensions = { rows: 2, columns: 2 },
    mapping = { columns: [0, 1], records: [0, 1] };
  let selection = selectGridTarget(
    emptyGridSelection(),
    { kind: 'cell', rowIndex: 0, colIndex: 0 },
    {},
    dimensions,
  );
  selection = selectGridTarget(
    selection,
    { kind: 'cell', rowIndex: 1, colIndex: 1 },
    { additive: true },
    dimensions,
  );
  expect(transposeSelectionScope(result, mapping, selection)?.rectangular).toBe(
    false,
  );
  expect(
    formatTransposeSelection(
      result,
      mapping,
      selection,
      '\t',
      false,
      (row) => row + 1,
    ),
  ).toBe('9007199254740993\t\n\tNULL');
  expect(
    transposeSelectionScope(result, mapping, emptyGridSelection()),
  ).toBeNull();
});
test('horizontal transpose window bounds real records with overscan', () => {
  const window = transposeRecordWindow(500, 180 * 400, 390);
  expect(window.start).toBe(398);
  expect(window.end).toBe(405);
  expect(
    window.beforeWidth + (window.end - window.start) * 180 + window.afterWidth,
  ).toBe(500 * 180);
});
