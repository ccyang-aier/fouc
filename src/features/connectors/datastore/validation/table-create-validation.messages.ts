import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  columnValidation: ['字段 {p0}：{p1}', 'Column {p0}: {p1}'],
  namesMustNotBeEmptyOrContainSurrounding: [
    '名称不能为空、含首尾空白、控制字符或无效 Unicode。',
    'Names must not be empty or contain surrounding whitespace, control characters, or invalid Unicode.',
  ],
  mysqlNamesSupportAtMostBmpCharacters: [
    'MySQL 名称最多 64 个 BMP 字符。',
    'MySQL names support at most 64 BMP characters.',
  ],
  mysqlDatabaseTableNamesMustNotContainDots: [
    'MySQL 数据库 / 表名不能包含点或路径分隔符。',
    'MySQL database / table names must not contain dots or path separators.',
  ],
  tablesCannotBeCreatedInMysqlSystemDatabases: [
    '不能在 MySQL 系统数据库中创建表。',
    'Tables cannot be created in MySQL system databases.',
  ],
  postgresqlNamesSupportAtMostUtfBytes: [
    'PostgreSQL 名称最多 63 个 UTF-8 字节。',
    'PostgreSQL names support at most 63 UTF-8 bytes.',
  ],
  tablesCannotBeCreatedInPostgresqlSystemSchemas: [
    '不能在 PostgreSQL 系统 Schema 中创建表。',
    'Tables cannot be created in PostgreSQL system schemas.',
  ],
  thisNameIsAPostgresqlSystemColumn: [
    '此名称属于 PostgreSQL 系统字段。',
    'This name is a PostgreSQL system column.',
  ],
  sqliteSupportsOnlyTheCurrentMainDatabase: [
    'SQLite 仅支持当前 main 数据库。',
    'SQLite supports only the current main database.',
  ],
  sqliteIsAReservedSqliteObjectPrefix: [
    'sqlite_ 是 SQLite 保留对象前缀。',
    'sqlite_ is a reserved SQLite object prefix.',
  ],
  thisDesignerLimitsSqliteNamesToUtfBytes: [
    '当前设计器将 SQLite 名称限制为 255 个 UTF-8 字节。',
    'This designer limits SQLite names to 255 UTF-8 bytes.',
  ],
  defaultValuesMustNotContainNulOrInvalid: [
    '默认值不能包含 NUL 或无效 Unicode。',
    'Default values must not contain NUL or invalid Unicode.',
  ],
  integerDefaultsMustBeDecimalIntegerLiterals: [
    '整数默认值必须是十进制整数字面量。',
    'Integer defaults must be decimal integer literals.',
  ],
  theDefaultExceedsTheNativeSignedIntegerRange: [
    '默认值超出原生有符号整数范围。',
    'The default exceeds the native signed integer range.',
  ],
  exactNumericDefaultsMustBeBoundedDecimalLiterals: [
    '精确数值默认值必须是有界十进制字面量。',
    'Exact numeric defaults must be bounded decimal literals.',
  ],
  theDefaultExceedsColumnPrecisionOrScaleSilent: [
    '默认值超出字段精度或小数位；不会静默舍入。',
    'The default exceeds column precision or scale; silent rounding is not performed.',
  ],
  floatingPointDefaultsMustBeFiniteNumericLiterals: [
    '浮点默认值必须是有限数字面量。',
    'Floating-point defaults must be finite numeric literals.',
  ],
  booleanDefaultsAcceptOnlyTrueOrFalse: [
    '布尔默认值仅接受 true 或 false。',
    'Boolean defaults accept only true or false.',
  ],
  binaryDefaultsUseAnEvenNumberOfHexadecimal: [
    '二进制默认值使用偶数长度的十六进制字节。',
    'Binary defaults use an even number of hexadecimal byte digits.',
  ],
  theCurrentMysqlDesignerDoesNotSetBlob: [
    '当前 MySQL 设计器不设置 BLOB 默认字面量。',
    'The current MySQL designer does not set BLOB default literals.',
  ],
  theCurrentMysqlDesignerDoesNotSetJson: [
    '当前 MySQL 设计器不设置 JSON 默认字面量。',
    'The current MySQL designer does not set JSON default literals.',
  ],
  theJsonDefaultIsNotValidJson: [
    'JSON 默认值不是合法 JSON。',
    'The JSON default is not valid JSON.',
  ],
  invalidUuidDefaultFormat: ['UUID 默认值格式无效。', 'Invalid UUID default format.'],
  theCurrentMysqlDesignerDoesNotSetText: [
    '当前 MySQL 设计器不设置 TEXT 默认字面量。',
    'The current MySQL designer does not set TEXT default literals.',
  ],
  defaultTextExceedsTheColumnLength: [
    '默认文本超过字段长度。',
    'Default text exceeds the column length.',
  ],
  timestampDefaultsRequireACompleteUtcTimeEnding: [
    '时间戳默认值须使用包含 Z 的完整 UTC 时间。',
    'Timestamp defaults require a complete UTC time ending in Z.',
  ],
  mysqlTimestampDefaultsUseThePortableRange: [
    'MySQL TIMESTAMP 默认值使用 1970–2038 的可移植范围。',
    'MySQL TIMESTAMP defaults use the portable 1970–2038 range.',
  ],
  invalidTableCreationParametersNamesColumnsTypeParameters: [
    '建表参数无效：名称、字段、类型参数或默认值不符合设计器契约。',
    'Invalid table creation parameters: names, columns, type parameters, or defaults violate the designer contract.',
  ],
  mysqlSqliteSupportOnlyOneAutoIncrementColumn: [
    'MySQL / SQLite 仅支持一个自增字段。',
    'MySQL / SQLite support only one auto-increment column.',
  ],
  duplicateColumnIdOrName: ['字段 ID 或名称重复。', 'Duplicate column ID or name.'],
  thisTypeIsOutsideTheCurrentDriverS: [
    '类型不在当前驱动支持的建表范围内。',
    "This type is outside the current driver's supported table creation scope.",
  ],
  invalidLengthParameter: ['长度参数无效。', 'Invalid length parameter.'],
  invalidNumericPrecisionScale: ['数值精度 / 小数位无效。', 'Invalid numeric precision / scale.'],
  thisTypeDoesNotSupportLengthOrPrecision: [
    '此类型不支持长度或精度参数。',
    'This type does not support length or precision parameters.',
  ],
  primaryKeyColumnsMustBeNotNull: [
    '主键字段必须为 NOT NULL。',
    'Primary key columns must be NOT NULL.',
  ],
  autoIncrementIdentityRequiresANonNullInteger: [
    '自增 / Identity 必须为非空整数，不能另设默认值。',
    'Auto-increment / Identity requires a non-null integer without a separate default.',
  ],
  postgresqlUsesByDefaultAlwaysIdentity: [
    'PostgreSQL 使用 BY DEFAULT / ALWAYS Identity。',
    'PostgreSQL uses BY DEFAULT / ALWAYS Identity.',
  ],
  thisDriverAcceptsOnlyAutoAutoIncrement: [
    '此驱动只接受 AUTO 自增。',
    'This driver accepts only AUTO auto-increment.',
  ],
  aMysqlAutoIncrementColumnMustBeThe: [
    'MySQL 自增字段必须是主键的第一个字段。',
    'A MySQL auto-increment column must be the first primary key column.',
  ],
  sqliteAutoincrementSupportsOnlyASingleIntegerPrimary: [
    'SQLite AUTOINCREMENT 只支持单一 INTEGER PRIMARY KEY。',
    'SQLite AUTOINCREMENT supports only a single INTEGER PRIMARY KEY.',
  ],
  nonNullColumnsCannotDefaultToNull: [
    '非空字段不能默认 NULL。',
    'Non-null columns cannot default to NULL.',
  ],
  thisTypeDoesNotAcceptTheSelectedDefault: [
    '此类型不接受所选默认函数；禁止任意 SQL 表达式。',
    'This type does not accept the selected default function; arbitrary SQL expressions are prohibited.',
  ],
  mysqlTextBlobJsonDoNotSupportThis: [
    'MySQL TEXT / BLOB / JSON 不支持本设计器的完整列主键 / 唯一约束。',
    "MySQL TEXT / BLOB / JSON do not support this designer's full-column primary key / unique constraints.",
  ],
  untitledColumn: ['未命名字段', 'Untitled column'],
  tableDesignExceedsTheKibLimit: [
    '建表设计超过 128 KiB 上限。',
    'Table design exceeds the 128 KiB limit.',
  ],
});
