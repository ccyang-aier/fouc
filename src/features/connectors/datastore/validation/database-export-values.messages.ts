import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  theBinaryCellContainsInvalidBaseData: [
    '二进制单元格的 Base64 数据无效。',
    'The binary cell contains invalid Base64 data.',
  ],
  theResultContainsJavascriptNumbersThatCannotBe: [
    '结果包含无法精确表示的 JavaScript 数值；请让驱动返回原始数字文本。',
    'The result contains JavaScript numbers that cannot be represented exactly. Have the driver return original numeric text.',
  ],
  cellsAreNestedBeyondLevels: ['单元格嵌套超过 20 层。', 'Cells are nested beyond 20 levels.'],
  sqlIdentifiersMustNotBeEmptyOrContain: [
    'SQL 标识符不能是空值或含空字符。',
    'SQL identifiers must not be empty or contain NUL.',
  ],
  postgresqlTextDoesNotSupportNulExportBinary: [
    'PostgreSQL text 不支持空字符；请导出二进制列或使用其他格式。',
    'PostgreSQL text does not support NUL. Export binary columns or use another format.',
  ],
  arrayCellsAreNestedBeyondLevels: [
    '数组单元格嵌套超过 20 层。',
    'Array cells are nested beyond 20 levels.',
  ],
});
