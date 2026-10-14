import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  explicitTextBinaryEncodingAppliesOnlyToTarget: [
    '显式文本 / 二进制编码只适用于目标文本类型',
    'Explicit text / binary encoding applies only to target text types',
  ],
  binaryEncodingRequiresABinarySourceColumn: [
    '二进制编码需要二进制源字段',
    'Binary encoding requires a binary source column',
  ],
  mappingBinaryToTextRequiresAnExplicitHex: [
    '二进制映射文本必须明确选择 HEX 或 Base64',
    'Mapping binary to text requires an explicit HEX or Base64 choice',
  ],
  binaryMapsDirectlyOnlyToBinaryColumnsChoose: [
    '二进制只直接映射二进制字段；文本目标可显式选择编码',
    'Binary maps directly only to binary columns; choose an explicit encoding for text targets',
  ],
  arraysMapDirectlyOnlyToSameTypePostgresql: [
    '数组只直接映射 PostgreSQL 同类型数组；其他目标请使用文本',
    'Arrays map directly only to same-type PostgreSQL arrays; use text for other targets',
  ],
  timesWithAndWithoutTimeZonesCannotConvert: [
    '带时区与不带时区时间不能隐式转换；文本映射可保留源时间表示',
    'Times with and without time zones cannot convert implicitly; text mapping preserves the source time representation',
  ],
  thisNativeTypeHasNoPreciseCrossDatabase: [
    '此原生类型暂无准确的跨库转换；可显式映射到文本',
    'This native type has no precise cross-database conversion yet; explicitly map it to text',
  ],
  sqliteNumericCannotGuaranteeArbitraryDecimalPrecisionMap: [
    'SQLite NUMERIC 不能保证任意十进制精度；请映射 TEXT 或明确的 REAL 字段',
    'SQLite NUMERIC cannot guarantee arbitrary decimal precision; map to TEXT or an explicit REAL column',
  ],
  jsonAcceptsOnlyNativeJsonOrValidJson: [
    'JSON 只接受原生 JSON 或合法 JSON 文本',
    'JSON accepts only native JSON or valid JSON text',
  ],
  jsonCannotConvertImplicitlyToNonJsonNon: [
    'JSON 不能隐式转换为非 JSON / 文本字段',
    'JSON cannot convert implicitly to non-JSON / non-text columns',
  ],
  theTargetNumericColumnDoesNotAcceptThis: [
    '目标数字字段不接受此源类型',
    'The target numeric column does not accept this source type',
  ],
  incompatibleDateTimeTypesTimesOrTimeZones: [
    '日期 / 时间类型不兼容；不会隐式裁剪时间或时区',
    'Incompatible date / time types; times or time zones will not be truncated implicitly',
  ],
  incompatibleColumnTypes: ['字段类型不兼容', 'Incompatible column types'],
});
