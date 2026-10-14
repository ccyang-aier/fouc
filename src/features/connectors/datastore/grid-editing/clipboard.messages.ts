import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  pastedContentSupportsUpToCharacters: [
    '粘贴内容最多 1,000,000 字符',
    'Pasted content supports up to 1,000,000 characters',
  ],
  aQuotedFieldIsNotClosed: ['带引号字段未闭合', 'A quoted field is not closed'],
  onlyADelimiterOrLineBreakMayFollowTheClosing: [
    '结束引号后只能是分隔符或换行',
    'Only a delimiter or line break may follow the closing quote',
  ],
  fieldsContainingDoubleQuotesRequireCsvTsvDoubleQuoteEscaping: [
    '含双引号的字段须使用 CSV / TSV 双引号转义',
    'Fields containing double quotes require CSV / TSV double-quote escaping',
  ],
  pasteUpToCellsAtATime: ['每次粘贴最多 100 个单元格', 'Paste up to 100 cells at a time'],
  pasteUpToRowsAndCellsAtATime: [
    '每次粘贴最多 50 行、100 个单元格',
    'Paste up to 50 rows and 100 cells at a time',
  ],
  everyMatrixRowMustHaveTheSameNumberOfColumns: [
    '粘贴矩阵每行列数须一致，不会补齐或截断原始数据',
    'Every matrix row must have the same number of columns; original data is never padded or truncated',
  ],
});
