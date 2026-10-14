import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  windowFunctions: ['窗口函数', 'Window functions'],
  builtInFunctions: ['内置函数', 'Built-in functions'],
  returnsTheByteLengthOfAStringUseCharLength: [
    '返回字符串的字节长度；字符数量可使用 CHAR_LENGTH。',
    'Returns the byte length of a string; use CHAR_LENGTH for the character count.',
  ],
  returnsTheCharacterCountOfAStringOrByteLength: [
    '返回字符串的字符数量；二进制值返回字节长度。',
    'Returns the character count of a string, or byte length for a binary value.',
  ],
  formatsANumberToTheSpecifiedDecimalPlacesWithGrouping: [
    '按指定小数位数格式化数值，并生成包含分组符号的字符串。',
    'Formats a number to the specified decimal places with grouping separators.',
  ],
  sqlFunctionParameters: ['SQL 函数参数', 'SQL function parameters'],
  sqlFunctionHelp: ['SQL 函数说明', 'SQL function help'],
  tabSwitchesParameterFields: ['Tab 切换参数字段', 'Tab switches parameter fields'],
  noParameters: ['无参数', 'No parameters'],
  documentation: ['参考文档 ↗', 'Documentation ↗'],
  documentation2648: ['{p0} {p1} 参考文档', '{p0} {p1} documentation'],
});
