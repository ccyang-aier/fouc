import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  equals: ['等于', 'Equals'],
  notEqual: ['不等于', 'Not equal'],
  isNull: ['为空', 'Is null'],
  isNotNull: ['非空', 'Is not null'],
  blankOrNull: ['空白或 NULL', 'Blank or NULL'],
  notBlank: ['非空白', 'Not blank'],
  containsLike: ['包含 (LIKE)', 'Contains (LIKE)'],
  doesNotContainNotLike: ['不包含 (NOT LIKE)', 'Does not contain (NOT LIKE)'],
  startsWith: ['开头为', 'Starts with'],
  endsWith: ['结尾为', 'Ends with'],
  lessThan: ['小于', 'Less than'],
  lessThanOrEqual: ['小于等于', 'Less than or equal'],
  greaterThan: ['大于', 'Greater than'],
  greaterThanOrEqual: ['大于等于', 'Greater than or equal'],
  inList: ['在列表中', 'In list'],
  notInList: ['不在列表中', 'Not in list'],
  withinRange: ['在区间内', 'Within range'],
  outsideRange: ['不在区间内', 'Outside range'],
  requiresValidJson: ['{p0} 需要有效 JSON', '{p0} requires valid JSON'],
  enterTrueOrFalseFor: ['{p0} 请输入 true 或 false', 'Enter true or false for {p0}'],
  conditionGroupsSupportAtMostLevels: [
    '条件分组最多 6 层',
    'Condition groups support at most 6 levels',
  ],
  addAConditionToTheGroupOrRemoveTheEmpty: [
    '请为分组添加条件，或移除空分组',
    'Add a condition to the group or remove the empty group',
  ],
  selectAValidColumn: ['请选择有效字段', 'Select a valid column'],
  theListForRequiresAJsonArray: [
    '{p0} 的列表需要 JSON 数组',
    'The list for {p0} requires a JSON array',
  ],
  aListRequiresAtLeastOneValue: ['列表至少需要一个值', 'A list requires at least one value'],
});
