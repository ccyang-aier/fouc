import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  expectedOnlyInsertIntoValuesWithExplicitColumn: [
    '此处需要 {p0}；仅支持显式字段列表的 INSERT INTO … VALUES。',
    'Expected {p0}; only INSERT INTO … VALUES with explicit column lists is supported.',
  ],
  sqlImportDoesNotExecuteMysqlVersionConditional: [
    'SQL 导入不执行 MySQL 版本条件注释或优化器提示，请移除后导入纯 INSERT 数据。',
    'SQL import does not execute MySQL version-conditional comments or optimizer hints. Remove them and import plain INSERT data.',
  ],
  sqlCommentsSupportAtMostNestingLevels: [
    'SQL 注释嵌套最多 64 层。',
    'SQL comments support at most 64 nesting levels.',
  ],
  sqlBlockCommentIsNotClosed: ['SQL 块注释未闭合。', 'SQL block comment is not closed.'],
  sqlQuoteIsNotClosed: ['SQL 引号未闭合。', 'SQL quote is not closed.'],
  incompleteSqlStringEscape: ['SQL 字符串转义未完成。', 'Incomplete SQL string escape.'],
  convertPostgresqlNonAsciiByteEscapesToUtf: [
    'PostgreSQL 非 ASCII 字节转义须先转换为 UTF-8 字符或 Unicode 转义，不进行有损推断。',
    'Convert PostgreSQL non-ASCII byte escapes to UTF-8 characters or Unicode escapes first; lossy inference is not performed.',
  ],
  invalidSqlStringHexadecimalEscape: [
    'SQL 字符串十六进制转义无效。',
    'Invalid SQL string hexadecimal escape.',
  ],
  sqlStringUnicodeEscapeIsNotAValid: [
    'SQL 字符串 Unicode 转义不是有效码点。',
    'SQL string Unicode escape is not a valid code point.',
  ],
  sqlImportsSupportAtMostLexicalElementsSplit: [
    'SQL 导入最多 250000 个词法元素，请拆分文件。',
    'SQL imports support at most 250,000 lexical elements. Split the file.',
  ],
  sqlDollarQuotedStringIsNotClosed: [
    'SQL dollar 字符串未闭合。',
    'SQL dollar-quoted string is not closed.',
  ],
});
