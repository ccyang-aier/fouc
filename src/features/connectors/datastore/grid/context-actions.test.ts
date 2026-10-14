import { expect, test } from 'bun:test';
import type { DatabaseColumnInfo, DatabaseTablePage } from '@fouc/shared';
import {
  emptyGridSelection,
  gridSelectionCounts,
  selectGridContextTarget,
  selectGridTarget,
} from './selection-controller';
import { compareGridPageCells } from './context-actions';
import { stageGridSelectedRows } from '../grid-editing/context-operations';
import type { GridEditDraft } from '../grid-editing/model';

const column = (name: string, extra: Partial<DatabaseColumnInfo> = {}): DatabaseColumnInfo => ({
  name,
  dataType: 'TEXT',
  isNullable: true,
  isPrimaryKey: false,
  isUnique: false,
  columnDefault: null,
  extra: null,
  comment: null,
  numericPrecision: null,
  numericScale: null,
  characterMaximumLength: null,
  ...extra,
});
const fixture = (): DatabaseTablePage => ({
  connectionId: 'c',
  database: 'd',
  table: 'items',
  columns: [
    column('id', { dataType: 'INTEGER', isPrimaryKey: true }),
    column('name'),
    column('amount', { dataType: 'DECIMAL' }),
    column('computed', { extra: 'generated' }),
  ],
  rows: [
    [1, 'A', '9007199254740993', 'x'],
    [2, 'B', '0.1', 'y'],
  ],
  offset: 50,
  limit: 100,
  hasMore: false,
});

test('right click preserves a selected rectangle; an outside click chooses only that target', () => {
  const dimensions = { rows: 3, columns: 3 },
    start = selectGridTarget(
      emptyGridSelection(),
      { kind: 'cell', rowIndex: 0, colIndex: 0 },
      {},
      dimensions,
    ),
    rectangle = selectGridTarget(
      start,
      { kind: 'cell', rowIndex: 1, colIndex: 1 },
      { shift: true },
      dimensions,
    );
  const inside = selectGridContextTarget(
    rectangle,
    { kind: 'cell', rowIndex: 0, colIndex: 1 },
    dimensions,
  );
  expect(gridSelectionCounts(inside, dimensions)).toEqual({ rows: 2, cells: 4 });
  expect(inside.focus).toEqual({ rowIndex: 0, colIndex: 1 });
  expect(
    gridSelectionCounts(
      selectGridContextTarget(inside, { kind: 'cell', rowIndex: 2, colIndex: 2 }, dimensions),
      dimensions,
    ).cells,
  ).toBe(1);
});

test('current page sorting retains decimal precision, numeric-text identity and original text semantics', () => {
  expect(compareGridPageCells('9007199254740993', '9007199254740992', 'BIGINT')).toBeGreaterThan(0);
  expect(compareGridPageCells('0.1000000000000000001', '0.1', 'DECIMAL')).toBeGreaterThan(0);
  expect(compareGridPageCells('1.00', '1e0', 'NUMERIC')).toBe(0);
  expect(compareGridPageCells('10', '2', 'TEXT')).toBeLessThan(0);
});

test('clone stages inserts with current draft values, omits keys/generated fields, and preserves exact values', () => {
  const page = fixture(),
    scope = { rows: [1, 0], columns: [1], rectangular: true },
    drafts: GridEditDraft[] = [
      {
        id: 'old',
        row: 0,
        change: { kind: 'update', original: page.rows[0], values: { name: 'Edited' } },
      },
    ];
  const next = stageGridSelectedRows(page, drafts, scope, 'clone', () => 'new');
  expect(next[0]).toBe(drafts[0]);
  expect(next.slice(1).map((draft) => draft.change)).toEqual([
    { kind: 'insert', values: { name: 'B', amount: '0.1' } },
    { kind: 'insert', values: { name: 'Edited', amount: '9007199254740993' } },
  ]);
  expect(page.rows[0][1]).toBe('A');
});

test('delete is only staged for exact selected original rows, and unidentifiable/stale/unsafe sources are rejected', () => {
  const page = fixture(),
    scope = { rows: [1], columns: [1], rectangular: true },
    next = stageGridSelectedRows(page, [], scope, 'delete');
  expect(next[0].change).toEqual({ kind: 'delete', original: page.rows[1] });
  expect(page.rows).toHaveLength(2);
  expect(() => stageGridSelectedRows(page, [], { ...scope, rows: [2] }, 'clone')).toThrow('有效行');
  expect(() => stageGridSelectedRows(page, next, scope, 'clone')).toThrow('已暂存删除');
  page.columns[0].isPrimaryKey = false;
  expect(() => stageGridSelectedRows(page, [], scope, 'delete')).toThrow('完整主键');
  page.rows[1][2] = 9007199254740992;
  expect(() => stageGridSelectedRows(page, [], scope, 'clone')).toThrow();
});
