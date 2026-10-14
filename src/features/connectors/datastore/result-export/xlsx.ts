import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './xlsx.messages';
import type { DatabaseQueryResult } from '@fouc/shared';
import { rawGridCellText } from '../grid/clipboard';
const connectorUiMessages = createUiMessages(connectorMessages);
/** Export raw loaded values; strings stay strings, including formulas and exact numeric text. */
export async function buildResultXlsx(
  result: DatabaseQueryResult,
  name: string,
  rows: readonly number[],
  columns: readonly number[],
  includeHeaders = true,
  locale?: Locale,
): Promise<Uint8Array<ArrayBuffer>> {
  const tConnector = createTranslator(connectorMessages, locale);
  if (
    !columns.length ||
    columns.length > 16384 ||
    rows.length > 100000 ||
    rows.length * columns.length > 1000000
  )
    throw connectorUiMessages.error('xlsxExportsSupportUpToRowsAndCells');
  if (
    rows.some((row) => !Number.isInteger(row) || row < 0 || row >= result.rows.length) ||
    columns.some(
      (column) => !Number.isInteger(column) || column < 0 || column >= result.columns.length,
    )
  )
    throw connectorUiMessages.error('theExportSelectionDoesNotBelongToTheCurrentData');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(
    name
      .replace(/[\\/?*:[\]]/g, '_')
      .replace(/^'+|'+$/g, '')
      .slice(0, 31) || tConnector('data'),
  );
  let characters = 0;
  const text = (value: string) => {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
      throw connectorUiMessages.error(
        'contentContainsControlCharactersUnsupportedByXlsxExportAsJson',
      );
    if (value.length > 32767)
      throw connectorUiMessages.error('aCellExceedsXlsxSCharacterLimitExportAsCsv');
    characters += value.length;
    if (characters > 20 * 1024 * 1024)
      throw connectorUiMessages.error('contentExceedsTheXlsxExportSizeLimitUseCsvOr');
    return value;
  };
  if (includeHeaders) {
    const header = sheet.addRow(columns.map((column) => text(result.columns[column])));
    header.font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }
  for (const [index, row] of rows.entries()) {
    if (index > 0 && index % 200 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    sheet.addRow(
      columns.map((column) => {
        const value = result.rows[row][column] ?? null;
        return value === null
          ? null
          : typeof value === 'number' || typeof value === 'boolean'
            ? value
            : text(typeof value === 'string' ? value : rawGridCellText(value));
      }),
    );
  }
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
