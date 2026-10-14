import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  theRandomRangeMinimumMustNotExceedThe: [
    '随机范围的最小值不能大于最大值。',
    'The random range minimum must not exceed the maximum.',
  ],
  candidatesMustNotBeEmpty: ['候选值不能为空。', 'Candidates must not be empty.'],
  decimalPlacesMustBe: ['小数位数必须为 0–100。', 'Decimal places must be 0–100.'],
  enterAnOrdinaryDecimalWithAtMostDigits: [
    '请输入最多 100 位的普通十进制数，不使用指数或千位分隔符。',
    'Enter an ordinary decimal with at most 100 digits, without exponents or grouping separators.',
  ],
  valueExceedsDecimalPlacesTheGeneratorDoesNot: [
    '数值 {p0} 超过 {p1} 位小数，生成器不会自动舍入。',
    'Value {p0} exceeds {p1} decimal places; the generator does not round automatically.',
  ],
});
