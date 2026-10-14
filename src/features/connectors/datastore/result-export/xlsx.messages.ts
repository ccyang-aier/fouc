import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  xlsxExportsSupportUpToRowsAndCells: [
    'XLSX 导出最多 100000 行、1000000 个单元格',
    'XLSX exports support up to 100,000 rows and 1,000,000 cells',
  ],
  theExportSelectionDoesNotBelongToTheCurrentData: [
    '导出选区不属于当前数据结果',
    'The export selection does not belong to the current data results',
  ],
  data: ['数据', 'Data'],
  contentContainsControlCharactersUnsupportedByXlsxExportAsJson: [
    '内容含 XLSX 不支持的控制字符，请使用 JSON 导出',
    'Content contains control characters unsupported by XLSX. Export as JSON',
  ],
  aCellExceedsXlsxSCharacterLimitExportAsCsv: [
    '单元格超过 XLSX 的 32767 字符限制，请使用 CSV 或 JSON 导出',
    "A cell exceeds XLSX's 32,767-character limit. Export as CSV or JSON",
  ],
  contentExceedsTheXlsxExportSizeLimitUseCsvOr: [
    '当前内容超过 XLSX 导出大小限制，请使用 CSV 或 JSON',
    'Content exceeds the XLSX export size limit. Use CSV or JSON',
  ],
});
