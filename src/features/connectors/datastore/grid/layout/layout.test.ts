import { describe, expect, test } from 'bun:test';
import type { DatabaseQueryResult } from '@fouc/shared';
import { formatGridSelection } from '../clipboard';
import {
  captureResultGridSelection,
  emptyGridSelection,
  gridSelectionScope,
  restoreResultGridSelection,
  selectGridTarget,
} from '../selection-controller';
import { applyColumnFormatter, validateColumnFormatter } from './formatter';
import {
  allNullGridColumns,
  defaultGridLayout,
  displayedGridColumns,
  gridColumnKeys,
  hideGridColumns,
  loadGridLayout,
  moveGridColumn,
  reorderGridFields,
  saveGridLayout,
  setGridColumnVisible,
  visibleGridColumns,
} from './model';
import { remapGridColumnSelection } from './selection-map';
import { fitGridColumn, percentileWidth } from './width';

const result: DatabaseQueryResult = {
  columns: ['id', 'amount', 'label'],
  rows: [
    [1, '9007199254740993', 'Alice'],
    [2, '0.1', 'Bob'],
  ],
  columnTypes: ['int', 'decimal', 'text'],
  columnSortables: [true, true, true],
  affectedRows: 0,
  executionTimeMs: 1,
  truncated: false,
  hasMore: false,
  sessionId: null,
  messages: [],
};
describe('grid layout and raw source mapping', () => {
  test('field ordering includes hidden fields and crossing frozen groups adopts the destination', () => {
    const keys = gridColumnKeys(result.columns),
      original = {
        ...defaultGridLayout(),
        hidden: [keys[1]],
        pins: { [keys[0]]: 'left' as const },
      };
    const moved = reorderGridFields(original, keys, 0, 2);
    expect(moved.order).toEqual([keys[1], keys[2], keys[0]]);
    expect(moved.hidden).toEqual([keys[1]]);
    expect(moved.pins).toEqual({});
    expect(visibleGridColumns(keys, moved)).toEqual([2, 0]);
    expect(original.pins).toEqual({ [keys[0]]: 'left' });
  });
  test('NULL visibility is derived from loaded rows and never overwrites saved explicit visibility', () => {
    const source = {
        ...result,
        rows: [
          [null, null, 'x'],
          [null, null, 'y'],
        ],
      },
      keys = gridColumnKeys(source.columns);
    const layout = { ...defaultGridLayout(), hideNullColumns: true };
    expect(displayedGridColumns(source, keys, layout)).toEqual([2]);
    expect(layout.hidden).toEqual([]);
    expect(displayedGridColumns({ ...source, rows: [[null, 1, 'x']] }, keys, layout)).toEqual([
      1, 2,
    ]);
    expect(
      displayedGridColumns({ ...source, rows: [[null, null, null]] }, keys, layout),
    ).toHaveLength(1);
    const saved = new Map<string, string>(),
      storage = {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => {
          saved.set(key, value);
        },
        removeItem: (key: string) => {
          saved.delete(key);
        },
      };
    const preferences = {
      ...layout,
      widthMode: 'fill' as const,
      searchMode: 'highlight' as const,
      rowNumberMode: 'source' as const,
      transposeMode: 'multiple' as const,
      booleanMode: 'checkbox' as const,
      numericAlign: 'left' as const,
      typeColors: true,
      copyMode: 'json' as const,
      copyHeaders: true,
    };
    saveGridLayout(storage, 'A', preferences);
    expect(loadGridLayout(storage, 'A')).toEqual(preferences);
    expect(loadGridLayout(storage, 'B')).toEqual(defaultGridLayout());
  });
  test('case and repeated columns stay unique, unknown columns append, hiding keeps one visible', () => {
    const keys = gridColumnKeys(['id', 'ID', 'id']);
    expect(new Set(keys).size).toBe(3);
    const layout = { ...defaultGridLayout(), order: [keys[2], keys[0]], hidden: [keys[0]] };
    expect(visibleGridColumns(keys, layout)).toEqual([2, 1]);
    expect(visibleGridColumns(keys, hideGridColumns(layout, keys, [0, 1, 2]))).toHaveLength(1);
    const last = hideGridColumns(defaultGridLayout(), keys, [1, 2]);
    expect(setGridColumnVisible(last, keys, keys[0], false)).toBe(last);
    expect(
      allNullGridColumns({
        columns: ['null', 'missing', 'value'],
        rows: [
          [null, undefined as never, 1],
          [null, undefined as never, null],
        ],
      }),
    ).toEqual([0]);
  });
  test('reordering a rectangle never adds a formerly unselected column; copy and export use raw original indexes', () => {
    const keys = gridColumnKeys(result.columns),
      layout = moveGridColumn(defaultGridLayout(), keys, 1, 2),
      visible = visibleGridColumns(keys, layout);
    expect(visible).toEqual([0, 2, 1]);
    const dimensions = { rows: 2, columns: 3 };
    const start = selectGridTarget(
      emptyGridSelection(),
      { kind: 'cell', rowIndex: 0, colIndex: 0 },
      {},
      dimensions,
    );
    const old = selectGridTarget(
      start,
      { kind: 'cell', rowIndex: 1, colIndex: 1 },
      { shift: true },
      dimensions,
    );
    const mapped = remapGridColumnSelection(old, [0, 1, 2], visible);
    expect(gridSelectionScope(mapped, result, visible)).toEqual({
      rows: [0, 1],
      columns: [0, 1],
      rectangular: true,
    });
    expect(formatGridSelection(result, mapped, '\t', true, visible)).toBe(
      'id\tamount\n1\t9007199254740993\n2\t0.1',
    );
    const allVisible = selectGridTarget(
      emptyGridSelection(),
      { kind: 'row', rowIndex: 0, colIndex: 0 },
      {},
      dimensions,
    );
    expect(formatGridSelection(result, allVisible, '\t', true, visible)).toBe(
      'id\tlabel\tamount\n1\tAlice\t9007199254740993',
    );
    const restored = restoreResultGridSelection(
      captureResultGridSelection(mapped, result, ['id'], visible),
      { ...result, rows: [...result.rows].reverse() },
      visible,
    );
    expect(gridSelectionScope(restored, result, visible)?.columns).toEqual([0, 1]);
    const hidden = remapGridColumnSelection(mapped, visible, [2, 1]);
    expect(gridSelectionScope(hidden, result, [2, 1])).toEqual({
      rows: [0, 1],
      columns: [1],
      rectangular: true,
    });
  });
  test('connection scopes restore layout independently and no scope never persists', () => {
    const entries = new Map<string, string>(),
      storage = {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
          entries.set(key, value);
        },
        removeItem: (key: string) => {
          entries.delete(key);
        },
      };
    const keys = gridColumnKeys(result.columns),
      layout = {
        ...defaultGridLayout(),
        order: [keys[2], keys[0], keys[1]],
        hidden: [keys[1]],
        pins: { [keys[2]]: 'left' as const },
        widths: { [keys[0]]: 233 },
        density: 'comfortable' as const,
        formatters: { [keys[2]]: { type: 'mask' as const, prefix: 1, suffix: 0 } },
      };
    expect(saveGridLayout(storage, 'connection-A:table', layout)).toBe(true);
    expect(loadGridLayout(storage, 'connection-A:table')).toEqual(layout);
    expect(loadGridLayout(storage, 'connection-B:table')).toEqual(defaultGridLayout());
    expect(saveGridLayout(storage, undefined, layout)).toBe(false);
    expect(loadGridLayout(storage, undefined)).toEqual(defaultGridLayout());
  });
  test('width samples ignore outliers by percentile and fit allows the real long value', () => {
    expect(percentileWidth([10, 30, 20], 100)).toBe(30);
    expect(fitGridColumn(result, 1, { autoFit: true })).toBeGreaterThan(130);
  });
});
describe('display-only formatters', () => {
  test('JSON source retains exact numeric tokens and never evaluates a path', () => {
    const source = '{"count":9007199254740993,"nested":{"items":[null,{"名字":"结果"}]}}';
    expect(applyColumnFormatter(source, { type: 'json-path', path: '$.count' }).text).toBe(
      '9007199254740993',
    );
    expect(
      applyColumnFormatter(source, { type: 'json-path', path: '$.nested.items[1]["名字"]' }).text,
    ).toBe('结果');
    expect(
      applyColumnFormatter(source, { type: 'json-path', path: '$.nested.items[0]' }).text,
    ).toBe('NULL');
    expect(
      applyColumnFormatter(
        { raw: [true, { value: 'a' }] },
        { type: 'json-path', path: '$.raw[1].value' },
      ).text,
    ).toBe('a');
    expect(applyColumnFormatter(source, { type: 'json-path', path: '$.missing' }).text).toBe('');
    expect(validateColumnFormatter({ type: 'json-path', path: '$[*]' })).not.toBeNull();
  });
  test('timestamp unit and timezone are explicit, invalid or ambiguous dates keep raw value', () => {
    const formatter = {
      type: 'datetime' as const,
      unit: 'auto' as const,
      timeZone: 'Asia/Shanghai',
      pattern: 'YYYY-MM-DD HH:mm:ss.SSS Z',
    };
    expect(applyColumnFormatter('1704067200', formatter).text).toBe(
      '2024-01-01 08:00:00.000 +08:00',
    );
    expect(applyColumnFormatter('2024-01-01T00:00:00.123Z', formatter).text).toBe(
      '2024-01-01 08:00:00.123 +08:00',
    );
    expect(applyColumnFormatter('2024-02-30', formatter).error).toBeTruthy();
    expect(applyColumnFormatter('2024-01-01 12:00:00', formatter).text).toBe('2024-01-01 12:00:00');
    expect(applyColumnFormatter(9007199254740992, formatter).error).toBeTruthy();
    expect(validateColumnFormatter({ ...formatter, timeZone: 'Unknown/Zone' })).not.toBeNull();
  });
  test('mask respects Unicode and template is a literal replacement only; NULL stays NULL', () => {
    expect(applyColumnFormatter('😀abcd🌏', { type: 'mask', prefix: 1, suffix: 1 }).text).toBe(
      '😀****🌏',
    );
    expect(applyColumnFormatter('ab', { type: 'mask', prefix: 2, suffix: 0 }).text).toBe('**');
    expect(
      applyColumnFormatter('Ab', {
        type: 'template',
        template: '${upper}/${lower}/${length}/${value}',
      }).text,
    ).toBe('AB/ab/2/Ab');
    expect(applyColumnFormatter(null, { type: 'template', template: '${value} kg' }).text).toBe(
      'NULL',
    );
    expect(validateColumnFormatter({ type: 'template', template: '${eval(1)}' })).not.toBeNull();
    expect(result.rows[0][1]).toBe('9007199254740993');
  });
});
