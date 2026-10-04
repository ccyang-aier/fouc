import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared';
import { formatGridSelection } from '../clipboard';
import {
  emptyGridSelection,
  gridCellSelected,
  type ResultGridSelection,
  type ResultGridSelectionScope,
} from '../selection-controller';

export type TransposeMapping = {
  columns: readonly number[];
  records: readonly number[];
};
export function transposeSourceCell(
  mapping: TransposeMapping,
  field: number,
  record: number,
) {
  const rowIndex = mapping.records[record],
    columnIndex = mapping.columns[field];
  return rowIndex === undefined || columnIndex === undefined
    ? null
    : { rowIndex, columnIndex };
}
export function* selectedTransposeCells(
  result: DatabaseQueryResult,
  mapping: TransposeMapping,
  selection: ResultGridSelection,
) {
  for (let field = 0; field < mapping.columns.length; field++) {
    for (let record = 0; record < mapping.records.length; record++) {
      if (!gridCellSelected(selection, field, record)) continue;
      const source = transposeSourceCell(mapping, field, record)!;
      yield {
        ...source,
        value: result.rows[source.rowIndex]?.[source.columnIndex] ?? null,
      };
    }
  }
}
export function transposeSelectionScope(
  result: DatabaseQueryResult,
  mapping: TransposeMapping,
  selection: ResultGridSelection,
): ResultGridSelectionScope | null {
  const rows = new Set<number>(),
    columns = new Set<number>();
  let cells = 0;
  for (const cell of selectedTransposeCells(result, mapping, selection)) {
    rows.add(cell.rowIndex);
    columns.add(cell.columnIndex);
    cells++;
  }
  return cells
    ? {
        rows: [...rows].sort((a, b) => a - b),
        columns: [...columns].sort((a, b) => a - b),
        rectangular: rows.size * columns.size === cells,
      }
    : null;
}
/** Only the presentation is transposed. Raw JSON, binary payloads and decimal strings stay intact. */
export function formatTransposeSelection(
  result: DatabaseQueryResult,
  mapping: TransposeMapping,
  selection: ResultGridSelection,
  separator: ',' | '\t',
  includeHeaders: boolean,
  rowNumber: (index: number) => number,
): string {
  const fields = mapping.columns.flatMap((column, field) =>
    mapping.records.some((_, record) =>
      gridCellSelected(selection, field, record),
    )
      ? [{ column, field }]
      : [],
  );
  const records = mapping.records.flatMap((row, record) =>
    mapping.columns.some((_, field) =>
      gridCellSelected(selection, field, record),
    )
      ? [{ row, record }]
      : [],
  );
  if (!fields.length || !records.length) return '';
  const offset = includeHeaders ? 1 : 0,
    cells = new Set<string>();
  const presentation = {
    columns: [
      ...(includeHeaders ? ['字段'] : []),
      ...records.map(({ row }) => `第 ${rowNumber(row)} 行`),
    ],
    rows: fields.map(({ column, field }, fieldIndex) => {
      if (includeHeaders) cells.add(`${fieldIndex}:0`);
      return [
        ...(includeHeaders ? [result.columns[column]] : []),
        ...records.map(({ row, record }, recordIndex) => {
          if (gridCellSelected(selection, field, record))
            cells.add(`${fieldIndex}:${recordIndex + offset}`);
          return result.rows[row]?.[column] ?? null;
        }),
      ];
    }) as DatabaseCell[][],
  };
  return formatGridSelection(
    presentation,
    { ...emptyGridSelection(), mode: 'cells', cells },
    separator,
    includeHeaders,
  );
}
export function transposeRecordWindow(
  total: number,
  scrollLeft: number,
  width: number,
  fieldWidth = 190,
  recordWidth = 180,
) {
  const start = Math.max(
    0,
    Math.floor(Math.max(0, scrollLeft) / recordWidth) - 2,
  );
  const end = Math.min(
    total,
    Math.ceil(
      (Math.max(0, scrollLeft) + Math.max(0, width - fieldWidth)) / recordWidth,
    ) + 3,
  );
  return {
    start: Math.min(start, total),
    end,
    beforeWidth: Math.min(start, total) * recordWidth,
    afterWidth: Math.max(0, total - end) * recordWidth,
  };
}
