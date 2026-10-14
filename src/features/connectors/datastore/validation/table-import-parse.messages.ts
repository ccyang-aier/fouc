import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  tooManyIssues: [
    '错误较多，仅显示前 100 项；修正后请重新预览。',
    'Too many issues; only the first 100 are shown. Correct them and preview again.',
  ],
  invalidJsonStringEscape: ['JSON 字符串转义无效。', 'Invalid JSON string escape.'],
  jsonStringContainsAnUnescapedControlCharacter: [
    'JSON 字符串含未转义的控制字符。',
    'JSON string contains an unescaped control character.',
  ],
  jsonStringIsNotClosed: ['JSON 字符串未闭合。', 'JSON string is not closed.'],
  jsonStructureExceedsTheCurrentImportLimitOf: [
    'JSON 结构超过当前导入的 250000 个值限制。',
    'JSON structure exceeds the current import limit of 250,000 values.',
  ],
  jsonSupportsAtMostNestingLevels: [
    'JSON 嵌套最多 64 层。',
    'JSON supports at most 64 nesting levels.',
  ],
  jsonObjectFieldNamesRequireDoubleQuotes: [
    'JSON 对象字段名须使用双引号。',
    'JSON object field names require double quotes.',
  ],
  sourceFieldNamesSupportAtMostCharactersAnd: [
    '源字段名最多 1024 个字符，不能含 NUL。',
    'Source field names support at most 1,024 characters and must not contain NUL.',
  ],
  missingColonAfterJsonFieldName: [
    'JSON 字段名后缺少冒号。',
    'Missing colon after JSON field name.',
  ],
  duplicateJsonFieldName: ['JSON 对象字段重复：{p0}', 'Duplicate JSON field name: {p0}'],
  importsSupportAtMostColumns: ['导入最多 256 列。', 'Imports support at most 256 columns.'],
  missingCommaBetweenJsonElements: [
    'JSON 元素之间缺少逗号。',
    'Missing comma between JSON elements.',
  ],
  jsonDoesNotAllowTrailingCommas: ['JSON 不允许尾随逗号。', 'JSON does not allow trailing commas.'],
  invalidJsonValue: ['JSON 值无效。', 'Invalid JSON value.'],
  extraContentAfterTheJsonValue: ['JSON 值后存在额外内容。', 'Extra content after the JSON value.'],
  invalidImportFormat: ['导入格式无效。', 'Invalid import format.'],
  theHeaderRowMustPrecedeTheFirstData: [
    '标题行须在数据起始行之前，结束行须为 0 或不小于起始行。',
    'The header row must precede the first data row. The last row must be 0 or not precede the first row.',
  ],
  jsonDataUsesItsOwnFieldNamesThe: [
    'JSON 数据使用自身字段名，标题行须为 0。',
    'JSON data uses its own field names; the header row must be 0.',
  ],
  invalidParsingOptions: ['解析选项无效。', 'Invalid parsing options.'],
  invalidJsonRowStructure: ['JSON 行结构无效。', 'Invalid JSON row structure.'],
  nullMarkersSupportAtMostCharacters: [
    'NULL 标记最多 64 个字符。',
    'NULL markers support at most 64 characters.',
  ],
  theDelimiterMustBeOneCharacterAndCannot: [
    '分隔符须为单个字符，不能为引号或换行。',
    'The delimiter must be one character and cannot be a quote or newline.',
  ],
  importContentMustNotExceedMib: ['导入内容最多 5 MiB。', 'Import content must not exceed 5 MiB.'],
  importContentMustNotExceedMibOfUtf: [
    '导入内容最多 5 MiB UTF-8 文本。',
    'Import content must not exceed 5 MiB of UTF-8 text.',
  ],
  importsSupportAtMostRowsReduceTheData: [
    '导入最多 5000 行；请缩小数据范围或拆分文件。',
    'Imports support at most 5,000 rows. Reduce the data scope or split the file.',
  ],
  importsSupportAtMostColumnsAndCells: [
    '导入最多 256 列、100000 个单元格。',
    'Imports support at most 256 columns and 100,000 cells.',
  ],
  jsonImportsRequireAnArrayOfObjectRows: [
    'JSON 导入须为对象行或数组行组成的数组。',
    'JSON imports require an array of object rows or array rows.',
  ],
  eachJsonRowMustBeAnObjectOr: [
    'JSON 每行须为对象或数组。',
    'Each JSON row must be an object or array.',
  ],
  jsonRowsDoNotMatchTheSelectedStructure: [
    'JSON 行与选定结构不一致。',
    'JSON rows do not match the selected structure.',
  ],
  jsonObjectRowsAndArrayRowsCannotBe: [
    'JSON 对象行与数组行不能混用。',
    'JSON object rows and array rows cannot be mixed.',
  ],
  quotedFieldIsNotClosed: ['带引号字段未闭合。', 'Quoted field is not closed.'],
  onlyADelimiterOrNewlineMayFollowA: [
    '字段结束引号后只能是分隔符或换行。',
    "Only a delimiter or newline may follow a field's closing quote.",
  ],
  anUnquotedFieldContainsADoubleQuote: [
    '未加引号的字段中出现双引号。',
    'An unquoted field contains a double quote.',
  ],
  thisRecordHasColumnsTheHeaderDefinesColumns: [
    '此记录有 {p0} 列，标题定义了 {p1} 列。',
    'This record has {p0} columns; the header defines {p1} columns.',
  ],
  noColumnsInTheSelectedScope: ['选定范围中没有字段。', 'No columns in the selected scope.'],
  noDataRowsInTheSelectedScope: ['选定范围中没有数据行。', 'No data rows in the selected scope.'],
  someFieldsAreMissingImportsOmitThoseFields: [
    '部分字段缺失；导入时会省略该字段并使用目标默认值。显式 NULL 会写入 NULL。',
    'Some fields are missing. Imports omit those fields and use target defaults; explicit NULL writes NULL.',
  ],
});
