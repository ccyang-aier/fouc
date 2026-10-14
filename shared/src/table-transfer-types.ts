import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import type { DatabaseColumnInfo } from './database';
import type { RelationalProvider } from './relational';
import type { RelationalTableStructure } from './relational-structure';
import type { TableTransferMapping } from './table-transfer';
export type TableTransferTypeFamily =
  | 'integer'
  | 'decimal'
  | 'float'
  | 'boolean'
  | 'text'
  | 'binary'
  | 'json'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'instant'
  | 'array'
  | 'other';
export function tableTransferTypeFamily(
  type: string,
  provider: RelationalProvider,
): TableTransferTypeFamily {
  const value = type.trim().toLowerCase();
  if (provider === 'postgres' && /\[\]$/.test(value)) return 'array';
  if (/^(jsonb?)(?:\b|$)/.test(value)) return 'json';
  if (/^(bool|boolean)\b/.test(value)) return 'boolean';
  if (
    /^(tinyint|smallint|mediumint|int|integer|bigint|int2|int4|int8|smallserial|serial|bigserial)\b/.test(
      value,
    )
  )
    return 'integer';
  if (/^(decimal|numeric|number)\b/.test(value)) return 'decimal';
  if (/^(float|real|double|float4|float8)\b/.test(value)) return 'float';
  if (
    (/^(bytea|(?:tiny|medium|long)?blob|binary|varbinary|bit)\b/.test(value) &&
      provider === 'mysql') ||
    /^(bytea|(?:tiny|medium|long)?blob|binary|varbinary)\b/.test(value)
  )
    return 'binary';
  if (
    /^(text|(?:tiny|medium|long)text|char|varchar|character|clob|enum|set|uuid|inet|cidr|macaddr|macaddr8|xml|tsvector|tsquery)\b/.test(
      value,
    ) ||
    (provider === 'sqlite' && value === '')
  )
    return 'text';
  if (/^(timestamptz|timestamp.*with time zone)\b/.test(value)) return 'instant';
  if (/^(datetime|timestamp)\b/.test(value)) return 'timestamp';
  if (/^(timetz|time.*with time zone)\b/.test(value)) return 'other';
  if (/^time\b/.test(value)) return 'time';
  if (/^date\b/.test(value)) return 'date';
  return 'other';
}
export function tableTransferColumnOmittable(
  column: DatabaseColumnInfo,
  table: RelationalTableStructure,
): boolean {
  if (
    column.isNullable ||
    column.columnDefault !== null ||
    /generated|identity|auto_increment/i.test(column.extra ?? '')
  )
    return true;
  return (
    table.provider === 'sqlite' &&
    /^integer$/i.test(column.dataType.trim()) &&
    column.isPrimaryKey &&
    table.columns.filter((entry) => entry.isPrimaryKey).length === 1 &&
    table.properties.withoutRowid !== 'true'
  );
}
export function validateTableTransferMapping(
  source: DatabaseColumnInfo,
  sourceProvider: RelationalProvider,
  target: DatabaseColumnInfo,
  targetProvider: RelationalProvider,
  mapping: TableTransferMapping,
): ValidationIssue | null {
  const from = tableTransferTypeFamily(source.dataType, sourceProvider),
    to = tableTransferTypeFamily(target.dataType, targetProvider);
  if (mapping.conversion !== 'native') {
    if (to !== 'text')
      return validationIssue(
        'table-transfer-types.explicitTextBinaryEncodingAppliesOnlyToTarget',
        '显式文本 / 二进制编码只适用于目标文本类型',
      );
    if (mapping.conversion.startsWith('binary-') && from !== 'binary')
      return validationIssue(
        'table-transfer-types.binaryEncodingRequiresABinarySourceColumn',
        '二进制编码需要二进制源字段',
      );
    if (mapping.conversion === 'text' && from === 'binary')
      return validationIssue(
        'table-transfer-types.mappingBinaryToTextRequiresAnExplicitHex',
        '二进制映射文本必须明确选择 HEX 或 Base64',
      );
    return null;
  }
  if (from === 'binary' || to === 'binary')
    return from === to
      ? null
      : validationIssue(
          'table-transfer-types.binaryMapsDirectlyOnlyToBinaryColumnsChoose',
          '二进制只直接映射二进制字段；文本目标可显式选择编码',
        );
  if (from === 'array' || to === 'array')
    return from === to &&
      sourceProvider === 'postgres' &&
      targetProvider === 'postgres' &&
      source.dataType.toLowerCase() === target.dataType.toLowerCase()
      ? null
      : validationIssue(
          'table-transfer-types.arraysMapDirectlyOnlyToSameTypePostgresql',
          '数组只直接映射 PostgreSQL 同类型数组；其他目标请使用文本',
        );
  if (from === 'instant' || to === 'instant')
    return from === to
      ? null
      : validationIssue(
          'table-transfer-types.timesWithAndWithoutTimeZonesCannotConvert',
          '带时区与不带时区时间不能隐式转换；文本映射可保留源时间表示',
        );
  if (to === 'text') return null;
  if (from === 'other' || to === 'other')
    return validationIssue(
      'table-transfer-types.thisNativeTypeHasNoPreciseCrossDatabase',
      '此原生类型暂无准确的跨库转换；可显式映射到文本',
    );
  if (targetProvider === 'sqlite' && to === 'decimal' && from !== 'integer' && from !== 'boolean')
    return validationIssue(
      'table-transfer-types.sqliteNumericCannotGuaranteeArbitraryDecimalPrecisionMap',
      'SQLite NUMERIC 不能保证任意十进制精度；请映射 TEXT 或明确的 REAL 字段',
    );
  if (to === 'json')
    return ['json', 'text'].includes(from)
      ? null
      : validationIssue(
          'table-transfer-types.jsonAcceptsOnlyNativeJsonOrValidJson',
          'JSON 只接受原生 JSON 或合法 JSON 文本',
        );
  if (from === 'json')
    return validationIssue(
      'table-transfer-types.jsonCannotConvertImplicitlyToNonJsonNon',
      'JSON 不能隐式转换为非 JSON / 文本字段',
    );
  if (['integer', 'decimal', 'float', 'boolean'].includes(to))
    return ['integer', 'decimal', 'float', 'boolean', 'text'].includes(from)
      ? null
      : validationIssue(
          'table-transfer-types.theTargetNumericColumnDoesNotAcceptThis',
          '目标数字字段不接受此源类型',
        );
  if (['date', 'time', 'timestamp'].includes(to))
    return from === to || from === 'text'
      ? null
      : validationIssue(
          'table-transfer-types.incompatibleDateTimeTypesTimesOrTimeZones',
          '日期 / 时间类型不兼容；不会隐式裁剪时间或时区',
        );
  return from === to
    ? null
    : validationIssue('table-transfer-types.incompatibleColumnTypes', '字段类型不兼容');
}
