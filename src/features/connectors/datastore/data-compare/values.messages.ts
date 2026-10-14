import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  missing: ['[缺失]', '[Missing]'],
  theDecimalValueExceedsTheDigitPrecisionLimit: [
    '十进制值超过 8,192 位精度范围。',
    'The decimal value exceeds the 8,192-digit precision limit.',
  ],
  theCellIsNestedMoreThanLevelsAndCannotBe: [
    '单元格嵌套超过 32 层，无法可靠比较。',
    'The cell is nested more than 32 levels and cannot be compared reliably.',
  ],
  theDriverReturnedANonFiniteNumberOrUnsafeInteger: [
    '驱动返回了非有限数值或不安全整数；需要原始数字文本。',
    'The driver returned a non-finite number or unsafe integer. Original numeric text is required.',
  ],
  theBinaryValueContainsInvalidBase: [
    '二进制值的 Base64 内容无效。',
    'The binary value contains invalid Base64.',
  ],
  aValueExceedsTheCharacterComparisonLimit: [
    '单个值超过 1,000,000 字符的比较范围。',
    'A value exceeds the 1,000,000-character comparison limit.',
  ],
  normalizedComparisonContentExceedsCharactersReduceTheResultSet: [
    '规范化比较内容超过 32,000,000 字符的处理范围。请缩小结果。',
    'Normalized comparison content exceeds 32,000,000 characters. Reduce the result set.',
  ],
  missing766: ['缺失', 'Missing'],
  binary: ['二进制', 'Binary'],
  array: ['数组', 'Array'],
  numeric: ['数值', 'Numeric'],
  boolean: ['布尔值', 'Boolean'],
  originalDecimal: ['原始十进制', 'Original decimal'],
  text: ['文本', 'Text'],
});
