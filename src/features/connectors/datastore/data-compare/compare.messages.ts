import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  comparisonCancelled: ['比较已取消', 'Comparison cancelled'],
  theMatchingKeyContainsMissingValuesSoReliableMatchingIs: [
    '匹配键包含缺失值，无法建立可靠对应。',
    'The matching key contains missing values, so reliable matching is impossible.',
  ],
  duplicateLeftSideMatchingKeysRows: [
    '左侧匹配键重复，共 {p0} 行。',
    'Duplicate left-side matching keys: {p0} rows.',
  ],
  duplicateRightSideMatchingKeysRows: [
    '右侧匹配键重复，共 {p0} 行。',
    'Duplicate right-side matching keys: {p0} rows.',
  ],
});
