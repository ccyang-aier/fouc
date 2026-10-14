import { describe, expect, test } from 'bun:test';
import type { DatabaseQueryResult } from '@fouc/shared';
import { formatGridSelection, rawGridCellText } from './clipboard';
import {
  adjacentDataGridDetailIndex,
  detailNavigationDelta,
  shouldIgnoreDataGridDetailNavigation,
} from './detail-navigation';
import { selectAllCellDetailText } from './detail-selection';
import { summarizeExactValues } from './exact-summary';
import {
  beginDataGridNativeSelectionBlock,
  DATA_GRID_NATIVE_SELECTION_BLOCK_CLASS,
  releaseDataGridNativeSelectionBlock,
} from './native-selection';
import {
  captureResultGridSelection,
  dragGridSelection,
  emptyGridSelection,
  gridCellSelected,
  gridSelectionCounts,
  gridSelectionFrames,
  gridSelectionScope,
  moveGridSelection,
  restoreResultGridSelection,
  selectAllGridCells,
  selectGridTarget,
} from './selection-controller';
import { dataGridSelectionEdgeMask } from './selection-frames';

function result(
  rows: DatabaseQueryResult['rows'] = [
    [1, 'A', '0.1'],
    [2, 'B', '0.2'],
    [3, 'C', '9007199254740993'],
  ],
  columns = ['id', 'label', 'amount'],
): DatabaseQueryResult {
  return {
    columns,
    rows,
    columnTypes: columns.map(() => 'text'),
    columnSortables: columns.map(() => true),
    affectedRows: 0,
    executionTimeMs: 1,
    truncated: false,
    hasMore: false,
    sessionId: null,
    messages: [],
  };
}
const dimensions = { rows: 3, columns: 3 },
  cell = (rowIndex: number, colIndex: number) => ({ kind: 'cell' as const, rowIndex, colIndex });

describe('result grid selection and scope', () => {
  test('initial state has no selected cell; first intentional arrow selects origin', () => {
    const selection = emptyGridSelection();
    expect(selection.focus).toBeNull();
    expect(gridSelectionCounts(selection, dimensions)).toEqual({ rows: 0, cells: 0 });
    expect(moveGridSelection(selection, 'ArrowDown', {}, dimensions).focus).toEqual({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(selectAllGridCells({ rows: 0, columns: 3 }).mode).toBe('none');
  });
  test('shift click and reversed drag create rectangles, keyboard extends and clamps loaded bounds', () => {
    const start = selectGridTarget(emptyGridSelection(), cell(2, 2), {}, dimensions);
    const range = selectGridTarget(start, cell(0, 0), { shift: true }, dimensions);
    expect(gridSelectionCounts(range, dimensions)).toEqual({ cells: 9, rows: 3 });
    const drag = dragGridSelection(emptyGridSelection(), cell(2, 1), cell(0, 0), {}, dimensions);
    expect(drag.range).toEqual({ startRow: 0, endRow: 2, startCol: 0, endCol: 1 });
    expect(moveGridSelection(start, 'ArrowDown', {}, dimensions).focus).toEqual({
      rowIndex: 2,
      colIndex: 2,
    });
    expect(
      moveGridSelection(start, 'Home', { control: true, shift: true }, dimensions).range,
    ).toEqual(range.range);
  });
  test('Ctrl cells toggle holes in an existing rectangle without copying them', () => {
    const all = selectAllGridCells(dimensions),
      hole = selectGridTarget(all, cell(1, 1), { additive: true }, dimensions);
    expect(gridSelectionCounts(hole, dimensions)).toEqual({ cells: 8, rows: 3 });
    expect(gridCellSelected(hole, 1, 1)).toBe(false);
    expect(hole.baseRanges).toHaveLength(1);
    expect(formatGridSelection(result(), hole, '\t')).toBe(
      '1\tA\t0.1\n2\t\t0.2\n3\tC\t9007199254740993',
    );
    expect(
      gridCellSelected(selectGridTarget(hole, cell(1, 1), { additive: true }, dimensions), 1, 1),
    ).toBe(true);
  });
  test('Ctrl drag adds a disjoint rectangle and fills previously excluded intersections', () => {
    let selection = selectGridTarget(emptyGridSelection(), cell(0, 0), {}, dimensions);
    selection = dragGridSelection(
      selection,
      cell(1, 1),
      cell(2, 2),
      { additive: true },
      dimensions,
    );
    expect(gridSelectionCounts(selection, dimensions)).toEqual({ cells: 5, rows: 3 });
    selection = selectGridTarget(selection, cell(1, 1), { additive: true }, dimensions);
    expect(gridCellSelected(selection, 1, 1)).toBe(false);
    selection = dragGridSelection(
      selection,
      cell(1, 1),
      cell(2, 2),
      { additive: true },
      dimensions,
    );
    expect(gridCellSelected(selection, 1, 1)).toBe(true);
    const extended = selectGridTarget(
      selectGridTarget(emptyGridSelection(), cell(0, 0), {}, dimensions),
      cell(2, 2),
      { additive: true, shift: true },
      dimensions,
    );
    expect(gridSelectionCounts(extended, dimensions)).toEqual({ cells: 9, rows: 3 });
  });
  test('row and column multiselections remain mutually exclusive and preserve displayed order', () => {
    let selected = selectGridTarget(
      emptyGridSelection(),
      { ...cell(2, 1), kind: 'row' },
      {},
      dimensions,
    );
    selected = selectGridTarget(
      selected,
      { ...cell(0, 0), kind: 'row' },
      { additive: true },
      dimensions,
    );
    expect(gridSelectionCounts(selected, dimensions)).toEqual({ cells: 6, rows: 2 });
    expect(formatGridSelection(result(), selected, '\t')).toBe('1\tA\t0.1\n3\tC\t9007199254740993');
    selected = selectGridTarget(selected, { ...cell(0, 0), kind: 'column' }, {}, dimensions);
    selected = selectGridTarget(
      selected,
      { ...cell(0, 2), kind: 'column' },
      { shift: true },
      dimensions,
    );
    expect(selected.rows.size).toBe(0);
    expect(gridSelectionCounts(selected, dimensions).cells).toBe(9);
  });
  test('rectangle frames paint only the outer boundary and keep adjacent row runs separate', () => {
    const range = dragGridSelection(emptyGridSelection(), cell(0, 0), cell(2, 2), {}, dimensions),
      frames = gridSelectionFrames(range, dimensions);
    expect(dataGridSelectionEdgeMask(frames.frames, 1, 1)).toBe(0);
    expect(dataGridSelectionEdgeMask(frames.frames, 0, 0)).toBe(9);
    let rows = selectGridTarget(
      emptyGridSelection(),
      { ...cell(0, 0), kind: 'row' },
      {},
      dimensions,
    );
    rows = selectGridTarget(rows, { ...cell(2, 0), kind: 'row' }, { additive: true }, dimensions);
    expect(gridSelectionFrames(rows, dimensions).frames).toHaveLength(2);
  });
  test('export scopes match real cells, allow complete row products and reject sparse holes', () => {
    expect(gridSelectionScope(emptyGridSelection(), result())).toBeNull();
    const all = selectAllGridCells(dimensions);
    expect(gridSelectionScope(all, result())).toEqual({
      rows: [0, 1, 2],
      columns: [0, 1, 2],
      rectangular: true,
    });
    const hole = selectGridTarget(all, cell(1, 1), { additive: true }, dimensions);
    expect(gridSelectionScope(hole, result())?.rectangular).toBe(false);
    let rows = selectGridTarget(
      emptyGridSelection(),
      { ...cell(0, 0), kind: 'row' },
      {},
      dimensions,
    );
    rows = selectGridTarget(rows, { ...cell(2, 0), kind: 'row' }, { additive: true }, dimensions);
    expect(gridSelectionScope(rows, result())).toEqual({
      rows: [0, 2],
      columns: [0, 1, 2],
      rectangular: true,
    });
    let cells = selectGridTarget(emptyGridSelection(), cell(0, 0), {}, dimensions);
    cells = selectGridTarget(cells, cell(2, 2), { additive: true }, dimensions);
    expect(gridSelectionScope(cells, result())).toEqual({
      rows: [0, 2],
      columns: [0, 2],
      rectangular: false,
    });
  });
  test('refresh restores exact row identity, primary keys permit value updates and unrelated rows clear', () => {
    const selection = selectGridTarget(emptyGridSelection(), cell(1, 2), {}, dimensions);
    expect(
      restoreResultGridSelection(
        captureResultGridSelection(selection, result(), ['id']),
        result([
          [2, 'Updated', '0.3'],
          [1, 'A', '0.1'],
          [3, 'C', '0.4'],
        ]),
      ).focus,
    ).toEqual({ rowIndex: 0, colIndex: 2 });
    expect(
      restoreResultGridSelection(
        captureResultGridSelection(selection, result()),
        result([[9, 'X', '9']]),
      ).mode,
    ).toBe('none');
    expect(restoreResultGridSelection(null, result()).focus).toBeNull();
  });
  test('refresh keeps duplicate row and case-sensitive duplicate column occurrence', () => {
    const source = result(
      [
        [1, { a: 1 }, 'x'],
        [1, { a: 1 }, 'x'],
      ],
      ['id', 'Name', 'name'],
    );
    const selection = selectGridTarget(
      emptyGridSelection(),
      cell(1, 2),
      {},
      { rows: 2, columns: 3 },
    );
    const next = restoreResultGridSelection(
      captureResultGridSelection(selection, source),
      result([...source.rows], source.columns),
    );
    expect(next.focus).toEqual({ rowIndex: 1, colIndex: 2 });
  });
});

describe('result grid original values', () => {
  test('CSV escapes separators, quotes, multiline, NULL and empty string distinctly', () => {
    const source = result(
      [
        [null, '', 'NULL'],
        ['a,b', 'a"b', 'a\nb'],
      ],
      ['id', 'label', 'amount'],
    );
    const all = selectAllGridCells({ rows: 2, columns: 3 });
    expect(formatGridSelection(source, all, ',', true)).toBe(
      '"id","label","amount"\nNULL,"","NULL"\n"a,b","a""b","a\nb"',
    );
    expect(formatGridSelection(source, all, '\t')).toBe('NULL\t""\t"NULL"\na,b\t"a""b"\t"a\nb"');
  });
  test('JSON and binary payloads are copied intact, sparse cells omit unselected values', () => {
    const value = { type: 'binary', encoding: 'base64', data: 'AAEC' };
    expect(rawGridCellText(value)).toBe('{"type":"binary","encoding":"base64","data":"AAEC"}');
    const source = result([
      [null, { a: 1 }, 'secret'],
      [7, 'hidden', value],
    ]);
    let selection = selectGridTarget(emptyGridSelection(), cell(0, 1), {}, { rows: 2, columns: 3 });
    selection = selectGridTarget(
      selection,
      cell(1, 2),
      { additive: true },
      { rows: 2, columns: 3 },
    );
    const text = formatGridSelection(source, selection, '\t');
    expect(text).not.toContain('hidden');
    expect(text).not.toContain('secret');
    expect(text).toContain('AAEC');
    expect(text.split('\n')).toHaveLength(2);
  });
  test('decimal fractions and bigint strings aggregate exactly, unsafe driver integers are excluded', () => {
    const summary = summarizeExactValues([
      '0.1',
      0.2,
      '9007199254740993',
      Number.MAX_SAFE_INTEGER + 1,
      null,
      '',
      true,
      { n: 1 },
    ]);
    expect(summary.sum).toBe('9007199254740993.3');
    expect(summary.numericCount).toBe(3);
    expect(summary.average).toBe('3002399751580331.1');
    expect(summary.unsafeNumericCount).toBe(1);
  });
  test('scientific notation and negative values preserve decimal precision; repeating averages are labelled', () => {
    expect(summarizeExactValues(['1e-6', '-0.000002', '2e3']).sum).toBe('1999.999999');
    expect(summarizeExactValues(['1', '0', '0'])).toMatchObject({
      sum: '1',
      average: '0.333333333333',
      averageApproximate: true,
    });
    expect(summarizeExactValues(['0', '0.00', '-0']).sum).toBe('0');
    expect(summarizeExactValues(['NaN', 'Infinity', '0x10', 'abc', '1e99999'])).toMatchObject({
      sum: null,
      numericCount: 0,
      limitedNumericCount: 1,
    });
  });
});

describe('result grid detail and native text selection', () => {
  test('detail navigation stays in loaded bounds and does not take over textarea keys', () => {
    expect(adjacentDataGridDetailIndex(0, -1, 3)).toBeNull();
    expect(adjacentDataGridDetailIndex(1, 1, 3)).toBe(2);
    expect(adjacentDataGridDetailIndex(2, 1, 3)).toBeNull();
    expect(detailNavigationDelta('ArrowDown', 'row')).toBe(1);
    expect(detailNavigationDelta('ArrowDown', 'column')).toBeNull();
    expect(
      shouldIgnoreDataGridDetailNavigation({
        defaultPrevented: false,
        target: { closest: () => ({}) } as unknown as EventTarget,
        currentTarget: null,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
    let range: unknown;
    expect(
      selectAllCellDetailText({
        state: { doc: { length: 7 } },
        dispatch: (spec) => {
          range = spec.selection;
        },
      }),
    ).toBe(true);
    expect(range).toEqual({ anchor: 0, head: 7 });
  });
  test('native text selection owners release independently and preserve editable text', () => {
    const classes = new Set<string>();
    let cleared = 0;
    const environment = {
      document: {
        documentElement: {
          classList: {
            add: (name: string) => classes.add(name),
            remove: (name: string) => classes.delete(name),
          },
        },
        activeElement: null,
      },
      getSelection: () => ({
        removeAllRanges: () => {
          cleared++;
        },
      }),
      setTimeout,
      clearTimeout,
    };
    const first = {},
      second = {};
    beginDataGridNativeSelectionBlock(first, environment);
    beginDataGridNativeSelectionBlock(second, environment);
    releaseDataGridNativeSelectionBlock(first);
    expect(classes.has(DATA_GRID_NATIVE_SELECTION_BLOCK_CLASS)).toBe(true);
    releaseDataGridNativeSelectionBlock(second);
    expect(classes.size).toBe(0);
    expect(cleared).toBe(2);
    beginDataGridNativeSelectionBlock(first, {
      ...environment,
      document: { ...environment.document, activeElement: { closest: () => ({}) } },
    });
    expect(cleared).toBe(2);
    releaseDataGridNativeSelectionBlock(first);
  });
});
