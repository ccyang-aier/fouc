import { createUiMessages } from '../../i18n/ui-message';
import { messages as connectorMessages } from './clipboard.messages';
import type { DatabaseCell } from '@fouc/shared';
import { GRID_EDIT_LIMITS, type GridEditValue } from './model';
const connectorUiMessages = createUiMessages(connectorMessages);
export type GridClipboardOptions = {
  separator: ',' | '\t';
  nullToken?: string;
  emptyStringAsNull?: boolean;
};
/** DBX keeps external NULL text literal. A selected marker affects only unquoted fields. */
export function parseGridEditClipboard(
  text: string,
  options: GridClipboardOptions,
): GridEditValue[][] {
  if (text.length > GRID_EDIT_LIMITS.characters)
    throw connectorUiMessages.error('pastedContentSupportsUpToCharacters');
  const rows: GridEditValue[][] = [];
  let row: GridEditValue[] = [],
    index = text.startsWith('\uFEFF') ? 1 : 0;
  while (index <= text.length) {
    let value = '',
      quoted = false;
    if (text[index] === '"') {
      quoted = true;
      index++;
      let closed = false;
      while (index < text.length) {
        if (text[index] === '"') {
          if (text[index + 1] === '"') {
            value += '"';
            index += 2;
          } else {
            index++;
            closed = true;
            break;
          }
        } else value += text[index++];
      }
      if (!closed) throw connectorUiMessages.error('aQuotedFieldIsNotClosed');
      if (index < text.length && text[index] !== options.separator && !/[\r\n]/.test(text[index]))
        throw connectorUiMessages.error('onlyADelimiterOrLineBreakMayFollowTheClosing');
    } else {
      while (
        index < text.length &&
        text[index] !== options.separator &&
        !/[\r\n]/.test(text[index])
      ) {
        if (text[index] === '"')
          throw connectorUiMessages.error(
            'fieldsContainingDoubleQuotesRequireCsvTsvDoubleQuoteEscaping',
          );
        value += text[index++];
      }
    }
    row.push(
      (!quoted && options.nullToken !== undefined && value === options.nullToken) ||
        (options.emptyStringAsNull && value === '')
        ? { mode: 'null' }
        : { mode: 'value', text: value },
    );
    if (row.length > GRID_EDIT_LIMITS.cells)
      throw connectorUiMessages.error('pasteUpToCellsAtATime');
    if (text[index] === options.separator) {
      index++;
      continue;
    }
    rows.push(row);
    row = [];
    if (
      rows.length > GRID_EDIT_LIMITS.rows ||
      rows.reduce((count, item) => count + item.length, 0) > GRID_EDIT_LIMITS.cells
    )
      throw connectorUiMessages.error('pasteUpToRowsAndCellsAtATime');
    if (index >= text.length) break;
    if (text[index] === '\r') index++;
    if (text[index] === '\n') index++;
    if (index >= text.length) break;
  }
  if (rows.some((item) => item.length !== rows[0].length))
    throw connectorUiMessages.error('everyMatrixRowMustHaveTheSameNumberOfColumns');
  return rows;
}
/** Raw typed values, never column display formats. NULL and the literal text NULL are distinguishable. */
export function formatGridEditClipboard(
  rows: readonly (readonly DatabaseCell[])[],
  separator: ',' | '\t',
  columns?: readonly string[],
): string {
  function cell(value: DatabaseCell): string {
    if (value === null) return 'NULL';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (typeof value === 'string' && separator === ',') ||
      !text ||
      text === 'NULL' ||
      /["\r\n]/.test(text) ||
      text.includes(separator)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  }
  return [
    ...(columns ? [columns.map(cell).join(separator)] : []),
    ...rows.map((row) => row.map(cell).join(separator)),
  ].join('\n');
}
