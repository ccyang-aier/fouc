import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  namesMustNotBeEmptyOrContainControl: [
    '名称不能为空或包含控制字符',
    'Names must not be empty or contain control characters',
  ],
  postgresqlNamesMustNotExceedUtfBytes: [
    'PostgreSQL 名称不能超过 63 UTF-8 字节',
    'PostgreSQL names must not exceed 63 UTF-8 bytes',
  ],
  mysqlNamesMustNotExceedCharacters: [
    'MySQL 名称不能超过 64 个字符',
    'MySQL names must not exceed 64 characters',
  ],
  sqliteIsAReservedSqliteObjectPrefix: [
    'sqlite_ 是 SQLite 保留对象前缀',
    'sqlite_ is a reserved SQLite object prefix',
  ],
  typesMustNotBeEmptyOrExceedCharacters: [
    '类型不能为空或超过 2048 字符',
    'Types must not be empty or exceed 2,048 characters',
  ],
  enumSetAcceptOnlySingleQuotedTextMembers: [
    'ENUM / SET 只接受单引号文本成员',
    'ENUM / SET accept only single-quoted text members',
  ],
  invalidTypeFormatTypeInputMustNotContain: [
    '类型格式不合法；类型输入不能包含 SQL 子句',
    'Invalid type format; type input must not contain SQL clauses',
  ],
  editingTypeIsNotSupportedYetTheExisting: [
    '暂不支持编辑 {p0} 类型；原有字段仍保留',
    'Editing type {p0} is not supported yet; the existing column is preserved',
  ],
  unsignedSupportsOnlyMysqlNumericTypes: [
    'UNSIGNED 只支持 MySQL 数字类型',
    'UNSIGNED supports only MySQL numeric types',
  ],
  arrayTypesSupportOnlyPostgresql: [
    '数组类型只支持 PostgreSQL',
    'Array types support only PostgreSQL',
  ],
  strictTablesAcceptOnlyIntegerIntRealText: [
    'STRICT 表只接受 INTEGER / INT / REAL / TEXT / BLOB / ANY',
    'STRICT tables accept only INTEGER / INT / REAL / TEXT / BLOB / ANY',
  ],
  sqliteTypesDoNotAcceptLengthParameters: [
    'SQLite 类型不接受长度参数',
    'SQLite types do not accept length parameters',
  ],
  typeParametersAreOutOfRange: ['类型参数超出范围', 'Type parameters are out of range'],
  precisionOrScaleExceedsTheNativeDatabaseRange: [
    '精度或小数位超出原生数据库范围',
    'Precision or scale exceeds the native database range',
  ],
  lengthParameterIsOutOfRange: ['长度参数超出范围', 'Length parameter is out of range'],
  requiresAnExplicitLength: ['{p0} 必须指定长度', '{p0} requires an explicit length'],
  mysqlCharacterOrBinaryLengthIsOutOf: [
    'MySQL 字符或二进制长度超出范围',
    'MySQL character or binary length is out of range',
  ],
  timePrecisionMustBe: ['时间精度必须为 0 到 6', 'Time precision must be 0–6'],
  doesNotAcceptTheseTypeParameters: [
    '{p0} 不接受这些类型参数',
    '{p0} does not accept these type parameters',
  ],
  expressionsMustNotBeEmptyOrExceedCharacters: [
    '表达式不能为空或超过 8192 字符',
    'Expressions must not be empty or exceed 8,192 characters',
  ],
  expressionsMustNotContainCommentsParametersUnclosedQuotes: [
    '表达式不能包含注释、参数、未闭合引号或多条语句',
    'Expressions must not contain comments, parameters, unclosed quotes, or multiple statements',
  ],
  expressionParenthesesDoNotMatch: ['表达式括号不匹配', 'Expression parentheses do not match'],
  expressionsDoNotAcceptCrossObjectOrFunction: [
    '表达式不接受跨对象或函数命名空间引用',
    'Expressions do not accept cross-object or function namespace references',
  ],
  expressionFunctionIsOutsideTheLocalEditorS: [
    '表达式函数 {p0} 未在本机编辑器支持范围内',
    "Expression function {p0} is outside the local editor's supported scope",
  ],
  generatedColumnsIndexPredicatesDoNotAcceptNon: [
    '生成列 / 索引条件不接受非确定性函数',
    'Generated columns / index predicates do not accept non-deterministic functions',
  ],
  generatedColumnsDoNotAcceptNonDeterministicTime: [
    '生成列不接受非确定性时间值',
    'Generated columns do not accept non-deterministic time values',
  ],
  theExpressionReferencesAProhibitedColumnOrKeyword: [
    '表达式引用了不允许的字段或关键字 {p0}',
    'The expression references a prohibited column or keyword {p0}',
  ],
  postgresqlTextMustNotContainNul: [
    'PostgreSQL 文本不能包含 NUL',
    'PostgreSQL text must not contain NUL',
  ],
});
