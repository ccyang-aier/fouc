import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  invalidSchemaValue: ['配置 {path} 无效（{code}）。', 'Invalid configuration at {path} ({code}).'],
  timeMustBe: ['时间必须为 00:00:00–23:59:59.999。', 'Time must be 00:00:00–23:59:59.999.'],
  theDateMustBeAnActualCalendarDate: [
    '日期必须是真实的 1000–9999 年日历日期。',
    'The date must be an actual calendar date in years 1000–9999.',
  ],
  useAYyyyMmDdDateOrA: [
    '使用 YYYY-MM-DD 日期，或包含 Z 的 UTC 时间。',
    'Use a YYYY-MM-DD date or a UTC time ending in Z.',
  ],
  utcTimeIsOutsideTheValidRange: ['UTC 时间超出有效范围。', 'UTC time is outside the valid range.'],
  valueExceedsTheRange: ['数值 {p0} 超出 {p1} 范围。', 'Value {p0} exceeds the {p1} range.'],
  decimalPlacesExceedTheColumnSScaleOf: [
    '小数位超过字段的 {p0} 位。',
    "Decimal places exceed the column's scale of {p0}.",
  ],
  valueExceedsTheColumnSDecimalPrecision: [
    '数值 {p0} 超出字段 DECIMAL 精度。',
    "Value {p0} exceeds the column's DECIMAL precision.",
  ],
  floatingPointValuesMustBeFinite: ['浮点数必须有限。', 'Floating-point values must be finite.'],
  generatedNumbersSupportAtMostDigits: [
    '生成数值最多 100 位。',
    'Generated numbers support at most 100 digits.',
  ],
  integerColumnsMustHaveZeroDecimalPlaces: [
    '整数列的小数位数必须为零。',
    'Integer columns must have zero decimal places.',
  ],
  numericGeneratorsApplyOnlyToNumericColumns: [
    '数值生成器仅适用于数值字段。',
    'Numeric generators apply only to numeric columns.',
  ],
  textGeneratorsApplyOnlyToTextUuidColumns: [
    '文字生成器仅适用于文字 / UUID 字段。',
    'Text generators apply only to text / UUID columns.',
  ],
  chooseUuidOrAValidFixedValueFor: [
    'UUID 字段请选择 UUID 或有效的固定值。',
    'Choose UUID or a valid fixed value for UUID columns.',
  ],
  theTemporalGeneratorMustMatchTheColumnS: [
    '时间生成器须与字段的日期 / 时间类型一致。',
    "The temporal generator must match the column's date / time type.",
  ],
  sequenceIncrementsForUniqueColumnsMustNotBe: [
    '唯一字段的序列步长不能为零。',
    'Sequence increments for unique columns must not be zero.',
  ],
  theMinimumMustNotExceedTheMaximum: [
    '最小值不能大于最大值。',
    'The minimum must not exceed the maximum.',
  ],
  theNumericRangeCannotHoldAFullBatch: [
    '数值范围容纳不了整批唯一值，请扩大范围或减少行数。',
    'The numeric range cannot hold a full batch of unique values. Widen the range or reduce rows.',
  ],
  startTimeMustNotBeAfterTheEnd: [
    '开始时间不能晚于结束时间。',
    'Start time must not be after the end time.',
  ],
  theDateTimeRangeCannotHoldAFull: [
    '日期 / 时间范围容纳不了整批唯一值。',
    'The date / time range cannot hold a full batch of unique values.',
  ],
  mysqlTimestampUsesThePortableRange: [
    'MySQL TIMESTAMP 使用 1970–2038 的可移植范围。',
    'MySQL TIMESTAMP uses the portable 1970–2038 range.',
  ],
  enterAValidEmailDomainSuchAsExample: [
    '请输入有效的邮箱域名，例如 example.test。',
    'Enter a valid email domain, such as example.test.',
  ],
  fixedValueEnumCandidatesAreInsufficientForA: [
    '固定值 / 枚举的候选值数量不足以生成整批唯一值。',
    'Fixed value / enum candidates are insufficient for a full batch of unique values.',
  ],
  booleanCandidatesMustBeTrueFalse: [
    '布尔候选值只能为 true / false / 1 / 0。',
    'Boolean candidates must be true / false / 1 / 0.',
  ],
  enterAValidUuid: ['请输入有效 UUID。', 'Enter a valid UUID.'],
  theCandidateIsNotANativeDatabaseEnum: [
    '候选值不属于数据库原生 ENUM。',
    'The candidate is not a native database ENUM member.',
  ],
  fixedValueEnumExceedsTheColumnCharacterLength: [
    '固定值 / 枚举超过字段字符长度。',
    'Fixed value / enum exceeds the column character length.',
  ],
  generatedValueExceedsTheColumnSMaximumOf: [
    '生成值超过字段最大 {p0} 个字符。',
    "Generated value exceeds the column's maximum of {p0} characters.",
  ],
  uniquenessIsCheckedOnlyWithinThisGeneratedBatch: [
    '仅检查本批生成数据的唯一性；已有行、排序规则、CHECK 与触发器由原生事务审查，冲突会拒绝整批。',
    'Uniqueness is checked only within this generated batch. Existing rows, collations, CHECK constraints, and triggers are reviewed by the native transaction; conflicts reject the entire batch.',
  ],
  thisStageSupportsAppendGenerationOnlyForActual: [
    '当前阶段仅支持真实表的追加生成。',
    'This stage supports append generation only for actual tables.',
  ],
  columnConfigurationMustCorrespondOneToOneWith: [
    '字段配置必须与当前真实结构一一对应。',
    'Column configuration must correspond one-to-one with the current actual structure.',
  ],
  columnDoesNotExistOrIsDuplicated: [
    '字段不存在或重复。',
    'Column does not exist or is duplicated.',
  ],
  nonNullColumnsCannotGenerateNull: [
    '非空字段不能生成 NULL。',
    'Non-null columns cannot generate NULL.',
  ],
  nativeUniqueColumnsMustKeepUniquenessChecksEnabled: [
    '原生唯一字段必须保留唯一检查。',
    'Native unique columns must keep uniqueness checks enabled.',
  ],
  aBatchSupportsAtMostGeneratedCellsReduce: [
    '整批最多 100,000 个生成单元格，请减少行数或字段。',
    'A batch supports at most 100,000 generated cells. Reduce rows or columns.',
  ],
  foreignKeyColumnsDoNotGenerateRandomReferences: [
    '外键字段不生成随机引用：允许省略的字段使用原生默认值；必填外键需先通过普通导入提供真实引用。',
    'Foreign key columns do not generate random references. Omissible columns use native defaults; required foreign keys need actual references through ordinary import first.',
  ],
  theTableHasNativeTriggersCommittingMayCause: [
    '表包含原生触发器，提交可能产生数据库定义的附加影响。',
    'The table has native triggers; committing may cause additional database-defined effects.',
  ],
  nullSemanticsForUniqueColumnsAreDeterminedBy: [
    '唯一字段的 NULL 语义由原生约束决定，NULLS NOT DISTINCT 等约束可能拒绝重复 NULL。',
    'NULL semantics for unique columns are determined by native constraints. Constraints such as NULLS NOT DISTINCT may reject repeated NULL values.',
  ],
  timesAreGeneratedInUtcColumnsWithoutTime: [
    '时间按 UTC 生成；无时区列保存 UTC 墙上时间，数据库会话的时区规则仍适用。',
    'Times are generated in UTC. Columns without time zones store UTC wall-clock time; database session time zone rules still apply.',
  ],
  nativeFloatingPointColumnsStoreValuesUsingDatabase: [
    '原生浮点字段会按数据库浮点精度存储，精确十进制文本不代表浮点结果精确。',
    'Native floating-point columns store values using database floating-point precision. Exact decimal text does not imply exact floating-point results.',
  ],
  sqliteNumericRealAffinityMayConvertAndRound: [
    'SQLite 的 NUMERIC / REAL 亲和性可能转换并舍入小数；需要完全保留十进制词法时，请使用 TEXT 字段。',
    'SQLite NUMERIC / REAL affinity may convert and round decimals. Use TEXT to preserve decimal lexical forms completely.',
  ],
});
