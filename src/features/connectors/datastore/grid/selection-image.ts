import { createUiMessages } from '../../i18n/ui-message';
import { type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './selection-image.messages';
import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared';
import { applyColumnFormatter } from './layout/formatter';
import type { GridLayout } from './layout/model';
import {
  gridCellSelected,
  gridSelectionScope,
  type ResultGridSelection,
} from './selection-controller';
const connectorUiMessages = createUiMessages(connectorMessages);
/** Render only the selected, already loaded cells; no hidden/unselected values enter the PNG. */
export async function downloadGridSelectionImage(
  result: DatabaseQueryResult,
  displayRows: DatabaseCell[][] | undefined,
  selection: ResultGridSelection,
  visible: readonly number[],
  keys: readonly string[],
  layout: GridLayout,
  widths: readonly number[],
  rowHeight: number,
  host: HTMLElement,
  locale?: Locale,
) {
  const scope = gridSelectionScope(selection, result, visible);
  if (!scope) return;
  const selectedColumns = scope.columns.map((column) => visible.indexOf(column)),
    width = selectedColumns.reduce((sum, index) => sum + widths[index], 0),
    height = scope.rows.length * rowHeight;
  if (width > 8192 || height > 8192 || width * height > 16000000)
    throw connectorUiMessages.error('theSelectionImageIsTooLargeSelectASmallerRegion');
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const context = canvas.getContext('2d')!;
  const style = getComputedStyle(host),
    panel = style.getPropertyValue('--panel'),
    ink = style.getPropertyValue('--ink-soft'),
    border = style.getPropertyValue('--line');
  context.fillStyle = panel;
  context.fillRect(0, 0, width, height);
  context.font = `${layout.fontSize}px ${layout.font === 'mono' ? style.getPropertyValue('--font-code') : style.fontFamily}`;
  context.textBaseline = 'middle';
  scope.rows.forEach((row, y) => {
    let left = 0;
    selectedColumns.forEach((index) => {
      const column = visible[index],
        cellWidth = widths[index];
      if (gridCellSelected(selection, row, index)) {
        const value = (displayRows ?? result.rows)[row][column] ?? null,
          text = applyColumnFormatter(value, layout.formatters[keys[column]], locale).text;
        context.save();
        context.beginPath();
        context.rect(left + 1, y * rowHeight + 1, cellWidth - 2, rowHeight - 2);
        context.clip();
        context.fillStyle = ink;
        context.fillText(text, left + 9, y * rowHeight + rowHeight / 2);
        context.restore();
      }
      context.strokeStyle = border;
      context.strokeRect(left, y * rowHeight, cellWidth, rowHeight);
      left += cellWidth;
    });
  });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(connectorUiMessages.error('couldNotGenerateTheSelectionImage')),
      'image/png',
    ),
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'grid-selection.png';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
