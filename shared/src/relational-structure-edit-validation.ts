import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import type { RelationalProvider } from './relational';
import { tokenizeSqlSemantic, unquoteSqlSemanticIdentifier } from './sql-semantic-tokens';
/** The picker and DDL validator share the native built-in types they actually support. */
export const structureTypeOptions: Record<RelationalProvider, readonly string[]> = {
  mysql: [
    'TINYINT',
    'SMALLINT',
    'MEDIUMINT',
    'INT',
    'BIGINT',
    'DECIMAL',
    'FLOAT',
    'DOUBLE',
    'BIT',
    'BOOLEAN',
    'CHAR',
    'VARCHAR',
    'BINARY',
    'VARBINARY',
    'TINYTEXT',
    'TEXT',
    'MEDIUMTEXT',
    'LONGTEXT',
    'TINYBLOB',
    'BLOB',
    'MEDIUMBLOB',
    'LONGBLOB',
    'DATE',
    'TIME',
    'DATETIME',
    'TIMESTAMP',
    'YEAR',
    'JSON',
    'ENUM',
    'SET',
    'GEOMETRY',
    'POINT',
    'LINESTRING',
    'POLYGON',
  ],
  postgres: [
    'SMALLINT',
    'INTEGER',
    'BIGINT',
    'NUMERIC',
    'REAL',
    'DOUBLE PRECISION',
    'BOOLEAN',
    'TEXT',
    'VARCHAR',
    'CHAR',
    'BYTEA',
    'DATE',
    'TIME',
    'TIME WITH TIME ZONE',
    'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE',
    'INTERVAL',
    'JSON',
    'JSONB',
    'UUID',
    'INET',
    'CIDR',
    'MACADDR',
    'MACADDR8',
    'BIT',
    'BIT VARYING',
    'XML',
    'POINT',
    'LINE',
    'LSEG',
    'BOX',
    'PATH',
    'POLYGON',
    'CIRCLE',
    'TSVECTOR',
    'TSQUERY',
  ],
  sqlite: ['INTEGER', 'INT', 'REAL', 'TEXT', 'BLOB', 'ANY', 'NUMERIC'],
};
const typeAliases: Record<string, string> = {
  int: 'INTEGER',
  int2: 'SMALLINT',
  int4: 'INTEGER',
  int8: 'BIGINT',
  decimal: 'NUMERIC',
  float4: 'REAL',
  float8: 'DOUBLE PRECISION',
  bool: 'BOOLEAN',
  'character varying': 'VARCHAR',
  character: 'CHAR',
  timestamptz: 'TIMESTAMP WITH TIME ZONE',
  timetz: 'TIME WITH TIME ZONE',
  varbit: 'BIT VARYING',
  'timestamp without time zone': 'TIMESTAMP',
  'time without time zone': 'TIME',
};
export function validateStructureIdentifier(
  value: string,
  provider: RelationalProvider,
): ValidationIssue | null {
  if (!value.trim() || /[\u0000-\u001f\u007f]/.test(value))
    return validationIssue(
      'relational-structure-edit-validation.namesMustNotBeEmptyOrContainControl',
      '名称不能为空或包含控制字符',
    );
  if (provider === 'postgres' && new TextEncoder().encode(value).length > 63)
    return validationIssue(
      'relational-structure-edit-validation.postgresqlNamesMustNotExceedUtfBytes',
      'PostgreSQL 名称不能超过 63 UTF-8 字节',
    );
  if (provider === 'mysql' && [...value].length > 64)
    return validationIssue(
      'relational-structure-edit-validation.mysqlNamesMustNotExceedCharacters',
      'MySQL 名称不能超过 64 个字符',
    );
  if (provider === 'sqlite' && /^sqlite_/i.test(value))
    return validationIssue(
      'relational-structure-edit-validation.sqliteIsAReservedSqliteObjectPrefix',
      'sqlite_ 是 SQLite 保留对象前缀',
    );
  return null;
}
export function validateStructureDataType(
  input: string,
  provider: RelationalProvider,
  strict = false,
): ValidationIssue | null {
  const type = input.trim();
  if (!type || type.length > 2048)
    return validationIssue(
      'relational-structure-edit-validation.typesMustNotBeEmptyOrExceedCharacters',
      '类型不能为空或超过 2048 字符',
    );
  if (provider === 'mysql' && /^(enum|set)\s*\(/i.test(type)) {
    const tokens = tokenizeSqlSemantic(type, provider),
      values = tokens.slice(2, -1);
    if (
      !['enum', 'set'].includes(tokens[0]?.normalized) ||
      tokens[1]?.text !== '(' ||
      tokens.at(-1)?.text !== ')' ||
      !values.length ||
      values.length % 2 !== 1 ||
      values.some((token, index) =>
        index % 2 === 0
          ? token.kind !== 'string' || token.quote !== "'" || !token.closed
          : token.text !== ',',
      )
    )
      return validationIssue(
        'relational-structure-edit-validation.enumSetAcceptOnlySingleQuotedTextMembers',
        'ENUM / SET 只接受单引号文本成员',
      );
    return null;
  }
  const match =
    /^([a-z ]+?)(?:\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?(\s+(?:with|without) time zone)?(\s+unsigned)?(\[\])?$/i.exec(
      type,
    );
  if (!match)
    return validationIssue(
      'relational-structure-edit-validation.invalidTypeFormatTypeInputMustNotContain',
      '类型格式不合法；类型输入不能包含 SQL 子句',
    );
  let base = `${match[1].trim()}${match[4] ?? ''}`.replace(/\s+/g, ' ').toUpperCase();
  if (provider === 'postgres') base = typeAliases[base.toLowerCase()] ?? base;
  if (provider === 'mysql' && base === 'INTEGER') base = 'INT';
  if (!structureTypeOptions[provider].includes(base))
    return validationIssue(
      'relational-structure-edit-validation.editingTypeIsNotSupportedYetTheExisting',
      '暂不支持编辑 {p0} 类型；原有字段仍保留',
      { p0: validationValue(base) },
    );
  if (
    match[5] &&
    (provider !== 'mysql' ||
      !['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(
        base,
      ))
  )
    return validationIssue(
      'relational-structure-edit-validation.unsignedSupportsOnlyMysqlNumericTypes',
      'UNSIGNED 只支持 MySQL 数字类型',
    );
  if (match[6] && provider !== 'postgres')
    return validationIssue(
      'relational-structure-edit-validation.arrayTypesSupportOnlyPostgresql',
      '数组类型只支持 PostgreSQL',
    );
  if (provider === 'sqlite')
    return strict && !['INTEGER', 'INT', 'REAL', 'TEXT', 'BLOB', 'ANY'].includes(base)
      ? validationIssue(
          'relational-structure-edit-validation.strictTablesAcceptOnlyIntegerIntRealText',
          'STRICT 表只接受 INTEGER / INT / REAL / TEXT / BLOB / ANY',
        )
      : match[2]
        ? validationIssue(
            'relational-structure-edit-validation.sqliteTypesDoNotAcceptLengthParameters',
            'SQLite 类型不接受长度参数',
          )
        : null;
  const args =
    match[2] == null ? [] : [Number(match[2]), ...(match[3] == null ? [] : [Number(match[3])])];
  if (args.some((value) => !Number.isSafeInteger(value)))
    return validationIssue(
      'relational-structure-edit-validation.typeParametersAreOutOfRange',
      '类型参数超出范围',
    );
  const numeric = base === 'NUMERIC' || base === 'DECIMAL';
  if (numeric) {
    if (
      args.length &&
      (args[0] < 1 ||
        args[0] > (provider === 'mysql' ? 65 : 1000) ||
        (args.length === 2 &&
          (args[1] > (provider === 'mysql' ? 30 : args[0]) ||
            (provider === 'mysql' && args[1] > args[0]))))
    )
      return validationIssue(
        'relational-structure-edit-validation.precisionOrScaleExceedsTheNativeDatabaseRange',
        '精度或小数位超出原生数据库范围',
      );
  } else if (['CHAR', 'VARCHAR', 'BINARY', 'VARBINARY', 'BIT', 'BIT VARYING'].includes(base)) {
    if (
      args.length > 1 ||
      (args.length &&
        (args[0] < 1 || args[0] > (base === 'BIT' && provider === 'mysql' ? 64 : 10485760)))
    )
      return validationIssue(
        'relational-structure-edit-validation.lengthParameterIsOutOfRange',
        '长度参数超出范围',
      );
    if (provider === 'mysql' && ['VARCHAR', 'VARBINARY'].includes(base) && !args.length)
      return validationIssue(
        'relational-structure-edit-validation.requiresAnExplicitLength',
        '{p0} 必须指定长度',
        { p0: validationValue(base) },
      );
    if (
      provider === 'mysql' &&
      args.length &&
      args[0] > (['CHAR', 'BINARY'].includes(base) ? 255 : 65535)
    )
      return validationIssue(
        'relational-structure-edit-validation.mysqlCharacterOrBinaryLengthIsOutOf',
        'MySQL 字符或二进制长度超出范围',
      );
  } else if (
    ['TIME', 'TIME WITH TIME ZONE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'DATETIME'].includes(
      base,
    )
  ) {
    if (args.length > 1 || (args.length && args[0] > 6))
      return validationIssue(
        'relational-structure-edit-validation.timePrecisionMustBe',
        '时间精度必须为 0 到 6',
      );
  } else if (
    args.length &&
    !(
      provider === 'mysql' &&
      ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'].includes(base) &&
      args.length === 1 &&
      args[0] >= 1 &&
      args[0] <= 255
    )
  )
    return validationIssue(
      'relational-structure-edit-validation.doesNotAcceptTheseTypeParameters',
      '{p0} 不接受这些类型参数',
      { p0: validationValue(base) },
    );
  return null;
}
const expressionWords = new Set(
  'null true false case when then else end and or not is distinct from between in like escape collate as current_timestamp current_date current_time localtimestamp localtime interval year month day hour minute second'.split(
    ' ',
  ),
);
const functions: Record<RelationalProvider, Set<string>> = {
  mysql: new Set(
    'abs ceil ceiling floor round truncate mod pow power sqrt sign lower upper length char_length character_length concat concat_ws coalesce ifnull nullif if greatest least trim ltrim rtrim substring substr replace left right reverse ascii ord hex unhex date year month day hour minute second date_add date_sub timestampadd json_extract json_unquote json_object json_array cast convert current_timestamp now uuid'.split(
      ' ',
    ),
  ),
  postgres: new Set(
    'abs ceil ceiling floor round trunc mod power sqrt sign lower upper length char_length character_length concat concat_ws coalesce nullif greatest least trim ltrim rtrim substring substr replace left right reverse ascii chr btrim date_part date_trunc extract json_build_object jsonb_build_object json_build_array jsonb_build_array to_json to_jsonb array_length cardinality cast current_timestamp now'.split(
      ' ',
    ),
  ),
  sqlite: new Set(
    'abs ceil ceiling floor round mod pow power sqrt sign lower upper length concat concat_ws coalesce ifnull nullif trim ltrim rtrim substr substring replace hex unhex unicode char typeof iif json json_extract json_object json_array json_quote cast'.split(
      ' ',
    ),
  ),
};
/** Expressions are a bounded scalar subset, not a SQL execution textbox. */
export function validateStructureExpression(
  value: string,
  provider: RelationalProvider,
  columns: readonly string[],
  purpose: 'default' | 'generated' | 'predicate',
): ValidationIssue | null {
  if (!value.trim() || value.length > 8192)
    return validationIssue(
      'relational-structure-edit-validation.expressionsMustNotBeEmptyOrExceedCharacters',
      '表达式不能为空或超过 8192 字符',
    );
  const tokens = tokenizeSqlSemantic(value, provider);
  let nesting = 0;
  const names = new Set(
    columns.map((name) => (provider === 'postgres' ? name : name.toLowerCase())),
  );
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i],
      next = tokens[i + 1];
    if (
      token.kind === 'comment' ||
      token.kind === 'parameter' ||
      token.closed === false ||
      token.text === ';'
    )
      return validationIssue(
        'relational-structure-edit-validation.expressionsMustNotContainCommentsParametersUnclosedQuotes',
        '表达式不能包含注释、参数、未闭合引号或多条语句',
      );
    if (token.text === '(') nesting++;
    if (token.text === ')' && --nesting < 0)
      return validationIssue(
        'relational-structure-edit-validation.expressionParenthesesDoNotMatch',
        '表达式括号不匹配',
      );
    if (token.text === '.')
      return validationIssue(
        'relational-structure-edit-validation.expressionsDoNotAcceptCrossObjectOrFunction',
        '表达式不接受跨对象或函数命名空间引用',
      );
    if (token.kind === 'word' || token.kind === 'quoted_identifier') {
      const name = unquoteSqlSemanticIdentifier(token),
        normalized = token.normalized.toLowerCase();
      if (token.kind === 'word' && next?.text === '(') {
        if (!functions[provider].has(normalized))
          return validationIssue(
            'relational-structure-edit-validation.expressionFunctionIsOutsideTheLocalEditorS',
            '表达式函数 {p0} 未在本机编辑器支持范围内',
            { p0: validationValue(name) },
          );
        if (purpose !== 'default' && ['now', 'current_timestamp', 'uuid'].includes(normalized))
          return validationIssue(
            'relational-structure-edit-validation.generatedColumnsIndexPredicatesDoNotAcceptNon',
            '生成列 / 索引条件不接受非确定性函数',
          );
      } else if (
        token.kind === 'word' &&
        (expressionWords.has(normalized) ||
          (provider === 'postgres' && normalized === 'e' && next?.kind === 'string') ||
          structureTypeOptions[provider].includes(normalized.toUpperCase()))
      ) {
        if (purpose === 'generated' && /^(current_|local)/.test(normalized))
          return validationIssue(
            'relational-structure-edit-validation.generatedColumnsDoNotAcceptNonDeterministicTime',
            '生成列不接受非确定性时间值',
          );
      } else if (
        purpose === 'default' ||
        !names.has(provider === 'postgres' ? name : name.toLowerCase())
      )
        return validationIssue(
          'relational-structure-edit-validation.theExpressionReferencesAProhibitedColumnOrKeyword',
          '表达式引用了不允许的字段或关键字 {p0}',
          { p0: validationValue(name) },
        );
    }
  }
  return nesting
    ? validationIssue(
        'relational-structure-edit-validation.expressionParenthesesDoNotMatch',
        '表达式括号不匹配',
      )
    : null;
}
export function structureSqlLiteral(value: string, provider: RelationalProvider): string {
  if (value.includes('\0') && provider === 'postgres')
    throw new ValidationError(
      validationIssue(
        'relational-structure-edit-validation.postgresqlTextMustNotContainNul',
        'PostgreSQL 文本不能包含 NUL',
      ),
    );
  // Commit normalizes NO_BACKSLASH_ESCAPES on its checked-out connection and restores it.
  if (provider === 'mysql')
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\0/g, '\\0').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;
  if (provider === 'postgres')
    return `E'${value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;
  return `'${value.replace(/'/g, "''")}'`;
}
