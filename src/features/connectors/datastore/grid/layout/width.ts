import { type Locale } from '@/lib/i18n';
/** DBX percentile-based width sampling, adapted to Fouc raw cells and display-only formatters. */
import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared';
import { databaseCellText } from '../../cell-format';
import { applyColumnFormatter, type ColumnFormatter } from './formatter';
import { GRID_COLUMN_MIN_WIDTH, type GridDensity } from './model';
export function textPixelEstimate(text: string, fontSize = 13): number {
  let width = 0;
  for (const char of text) width += (char.codePointAt(0)! > 0x7e ? 2 : 1) * fontSize * 0.6;
  return width;
}
export function percentileWidth(values: readonly number[], percentile: number): number {
  if (!values.length) return 0;
  if (percentile >= 100) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length))];
}
export function sampleGridColumnValues(
  rows: readonly DatabaseCell[][],
  column: number,
  limit = 50,
): DatabaseCell[] {
  if (rows.length <= limit) return rows.map((row) => row[column] ?? null);
  const head = Math.ceil(limit / 2);
  return [...rows.slice(0, head), ...rows.slice(rows.length - (limit - head))].map(
    (row) => row[column] ?? null,
  );
}
export function fitGridColumn(
  result: Pick<DatabaseQueryResult, 'columns' | 'rows'>,
  column: number,
  options: {
    density?: GridDensity;
    fontSize?: number;
    formatter?: ColumnFormatter;
    autoFit?: boolean;
  } = {},
  locale?: Locale,
): number {
  const density = options.density ?? 'standard',
    fontSize = options.fontSize ?? 13,
    maxWidth = options.autoFit
      ? 1200
      : density === 'compact'
        ? 480
        : density === 'comfortable'
          ? 600
          : 400;
  const headerWidth = Math.min(500, textPixelEstimate(result.columns[column] ?? '', fontSize) + 78);
  if (density === 'compact' && !options.autoFit)
    return Math.max(GRID_COLUMN_MIN_WIDTH, Math.round(headerWidth));
  const limit = options.autoFit ? 160 : density === 'comfortable' ? 120 : 60;
  const widths = sampleGridColumnValues(result.rows, column, density === 'compact' ? 30 : 50)
    .filter((value) => value !== null)
    .map(
      (value) =>
        textPixelEstimate(
          applyColumnFormatter(value, options.formatter, locale).text.slice(0, limit) ||
            databaseCellText(value, locale),
          fontSize,
        ) + 32,
    );
  return Math.max(
    GRID_COLUMN_MIN_WIDTH,
    Math.round(
      Math.max(
        headerWidth,
        Math.min(
          maxWidth,
          percentileWidth(
            widths,
            options.autoFit || density === 'compact' ? 100 : density === 'comfortable' ? 95 : 90,
          ),
        ),
      ),
    ),
  );
}
export function gridColumnOffsets(widths: readonly number[], start = 0): number[] {
  const offsets: number[] = [];
  let current = start;
  for (const width of widths) {
    offsets.push(current);
    current += width;
  }
  return offsets;
}
