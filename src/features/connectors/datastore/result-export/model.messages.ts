import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  commaSeparated: ['逗号分隔', 'Comma-separated'],
  tabSeparated: ['制表符分隔', 'Tab-separated'],
  structuredData: ['结构化数据', 'Structured data'],
  documentTable: ['文档表格', 'Document table'],
  nativeInsert: ['原生 INSERT', 'Native INSERT'],
  theScopeChangedSelectAgain: [
    '{p0}范围已变化，请重新选择。',
    'The {p0} scope changed. Select again.',
  ],
  resultExportIsUnavailableForTheCurrentDatabase: [
    '当前数据库暂不支持结果导出。',
    'Result export is unavailable for the current database.',
  ],
  chooseASupportedExportFormat: ['请选择支持的导出格式。', 'Choose a supported export format.'],
  columns: ['列', ' columns'],
  row: ['行', ' row'],
  selectAtLeastOneColumn: ['请至少选择一列。', 'Select at least one column.'],
  invalidExportConfiguration: ['导出配置无效。', 'Invalid export configuration.'],
  sqlBatchSizeMustBeRows: ['SQL 每批行数须为 1–1000。', 'SQL batch size must be 1–1,000 rows.'],
  nullMarkersSupportUpToCharactersAndCannotContainDelimiters: [
    'NULL 标记最多 64 个字符，且不能包含分隔符、引号或换行。',
    'NULL markers support up to 64 characters and cannot contain delimiters, quotes or line breaks.',
  ],
  enterTheInsertTargetTableName: [
    '请输入 INSERT 目标表名。',
    'Enter the INSERT target table name.',
  ],
  tableAndSchemaNamesCannotContainNullCharacters: [
    '表名或 schema 不能含空字符。',
    'Table and schema names cannot contain null characters.',
  ],
  insertDoesNotSupportDuplicateColumnNamesAdjustSelectedColumns: [
    'INSERT 不允许重复列名，请调整选列或查询别名。',
    'INSERT does not support duplicate column names. Adjust selected columns or query aliases.',
  ],
  objectJsonDoesNotSupportDuplicateColumnNamesUseMatrix: [
    '对象 JSON 不允许重复列名；请使用矩阵 JSON 保留所有列。',
    'Object JSON does not support duplicate column names. Use matrix JSON to preserve every column.',
  ],
  queryResults: ['查询结果', 'Query results'],
});
