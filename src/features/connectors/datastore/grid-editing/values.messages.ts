import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  aJsonNumberExceedsTheSaveProtocolSPrecisionLimit: [
    'JSON 数字超出当前保存协议的精度范围',
    "A JSON number exceeds the save protocol's precision limit",
  ],
  theSaveProtocolCannotDistinguishJsonNullFromSqlNull: [
    '当前保存协议无法区分 JSON null 与 SQL NULL；请使用原始 SQL 审查编辑，SQL NULL 则选择空值模式',
    'The save protocol cannot distinguish JSON null from SQL NULL. Use raw SQL for reviewable JSON edits; choose null mode for SQL NULL',
  ],
  jsonContainsNumbersBeyondReliablePrecisionAndCannotBeSaved: [
    'JSON 含超出可靠精度的数字，当前保存协议无法无损表达；请使用原始 SQL 审查编辑',
    'JSON contains numbers beyond reliable precision and cannot be saved losslessly through this protocol. Use raw SQL for reviewable editing',
  ],
  binaryValuesForMustBeValidBase: [
    '{p0} 的二进制值须为有效 Base64',
    'Binary values for {p0} must be valid Base64',
  ],
  isAnArrayAndArrayAssignmentsAreUnsupportedByThe: [
    '{p0} 是数组，当前保存协议不支持数组赋值；请使用原始 SQL 审查编辑',
    '{p0} is an array and array assignments are unsupported by the save protocol. Use raw SQL for reviewable editing',
  ],
  enterTrueFalseOrFor: [
    '{p0} 请填写 true / false 或 1 / 0',
    'Enter true / false or 1 / 0 for {p0}',
  ],
  mustBeADecimalNumberExplicitlyChooseEmptyStringOr: [
    '{p0} 须为十进制数字；空字符串与 NULL 请明确选择',
    '{p0} must be a decimal number; explicitly choose empty string or NULL when needed',
  ],
  mustBeAnInteger: ['{p0} 须为整数', '{p0} must be an integer'],
  supportsUpToCharacters: ['{p0} 最多 {p1} 个字符', '{p0} supports up to {p1} characters'],
  theOriginalValueExceedsTheSaveProtocolSLevelNesting: [
    '原始值嵌套超过当前保存协议的 20 层限制',
    "The original value exceeds the save protocol's 20-level nesting limit",
  ],
  theOriginalRowContainsUnsafeNumbersReturnedByTheDriver: [
    '原始行含驱动返回的不安全数字；请先重新读取精确原始值',
    'The original row contains unsafe numbers returned by the driver. Reload exact original values first',
  ],
});
