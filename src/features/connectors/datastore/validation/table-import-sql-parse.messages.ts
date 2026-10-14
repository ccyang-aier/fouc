import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  sqlTableAndColumnNamesMustBeIdentifiers: [
    'SQL 表名与字段名须为标识符。',
    'SQL table and column names must be identifiers.',
  ],
  sqlIdentifiersSupportAtMostCharactersAndMust: [
    'SQL 标识符最多 1024 字符，不能为空或包含 NUL。',
    'SQL identifiers support at most 1,024 characters and must not be empty or contain NUL.',
  ],
  signsApplyOnlyToNumericLiterals: [
    '正负号只能用于数字字面量。',
    'Signs apply only to numeric literals.',
  ],
  datetimeLiteralsMustImmediatelyPrecedeAStringTime: [
    '日期时间字面量须紧跟一个字符串；不展开时区或函数。',
    'Datetime literals must immediately precede a string; time zones or functions are not expanded.',
  ],
  onlyNumberStringNullBooleanAndDatetimeLiterals: [
    '只接受数字、字符串、NULL、布尔和日期时间字面量；函数、运算、占位符、DEFAULT、类型转换与二进制字面量不导入。',
    'Only number, string, NULL, Boolean, and datetime literals are accepted. Functions, operations, placeholders, DEFAULT, casts, and binary literals are not imported.',
  ],
  chooseMysqlPostgresqlOrSqliteAsTheSource: [
    '请选择 MySQL、PostgreSQL 或 SQLite 源 SQL 方言。',
    'Choose MySQL, PostgreSQL, or SQLite as the source SQL dialect.',
  ],
  sqlUsesExplicitColumnListsTheHeaderRecord: [
    'SQL 使用显式字段列表，标题记录须为 0。',
    'SQL uses explicit column lists; the header record must be 0.',
  ],
  invalidSqlDataRecordRange: ['SQL 数据记录范围无效。', 'Invalid SQL data record range.'],
  sqlStringsAndNullRetainTheirOriginalSemantics: [
    'SQL 字符串与 NULL 使用原始语义，不支持去空白或空串转 NULL。',
    'SQL strings and NULL retain their original semantics; trimming or converting empty strings to NULL is unsupported.',
  ],
  sqlInputMustNotExceedMib: ['SQL 输入最多 5 MiB。', 'SQL input must not exceed 5 MiB.'],
  sqlInputMustNotExceedMibOfUtf: [
    'SQL 输入最多 5 MiB UTF-8 文本。',
    'SQL input must not exceed 5 MiB of UTF-8 text.',
  ],
  oneSqlImportFileMustContainOnlyOne: [
    '一个 SQL 导入文件只能包含同一个源表，不能混入其他库 / 表。',
    'One SQL import file must contain only one source table, without other databases / tables.',
  ],
  duplicateSqlColumn: ['SQL 字段列表重复：{p0}', 'Duplicate SQL column: {p0}'],
  sqlImportsSupportAtMostColumns: [
    'SQL 导入最多 256 列。',
    'SQL imports support at most 256 columns.',
  ],
  everyInsertMustProvideTheSameExplicitColumn: [
    '每条 INSERT 必须提供相同的显式字段集合；缺省字段请先统一导出。',
    'Every INSERT must provide the same explicit column set; standardize missing columns when exporting first.',
  ],
  valuesHasMoreValuesThanTheExplicitColumn: [
    'VALUES 值数量超过显式字段数。',
    'VALUES has more values than the explicit column list.',
  ],
  valuesCountDoesNotMatchTheExplicitColumn: [
    'VALUES 值数量与显式字段数不一致。',
    'VALUES count does not match the explicit column list.',
  ],
  theCompleteSqlInputSupportsAtMostValue: [
    '整个 SQL 输入最多 100000 条值记录，请拆分文件。',
    'The complete SQL input supports at most 100,000 value records. Split the file.',
  ],
  theSelectedSqlScopeSupportsAtMostRows: [
    '选定 SQL 范围最多 5000 行。',
    'The selected SQL scope supports at most 5,000 rows.',
  ],
  theSelectedSqlScopeSupportsAtMostCells: [
    '选定 SQL 范围最多 100000 个单元格。',
    'The selected SQL scope supports at most 100,000 cells.',
  ],
  noImportableInsertLiteralRecordsInTheSelected: [
    '选定 SQL 范围没有可导入的 INSERT 字面量记录。',
    'No importable INSERT literal records in the selected SQL scope.',
  ],
  sourceSqlIsParsedOnlyAsDataIt: [
    '源 SQL {p0}{p1} 仅解析为数据；实际写入当前审核的目标表，不执行脚本、DDL 或事务指令。',
    'Source SQL {p0}{p1} is parsed only as data. It writes to the currently reviewed target table without executing scripts, DDL, or transaction commands.',
  ],
  sourceStringsUseTheSpecifiedDialectMysqlUses: [
    '源字符串按明确方言解释；MySQL 使用默认反斜杠转义，PostgreSQL 普通字符串使用 standard_conforming_strings。其他会话模式请先转换数据文件。',
    'Source strings use the specified dialect. MySQL uses default backslash escaping; PostgreSQL regular strings use standard_conforming_strings. Convert data files first for other session modes.',
  ],
});
