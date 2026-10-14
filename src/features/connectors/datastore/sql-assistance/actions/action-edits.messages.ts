import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  listContentMustNotExceedMib: ['列表内容最多 1 MiB。', 'List content must not exceed 1 MiB.'],
  aListCanContainAtMostValues: [
    '列表最多 10,000 个值。',
    'A list can contain at most 10,000 values.',
  ],
  separateValuesWithNewlinesCommasOrTabsEncloseASingle: [
    '请使用多行、逗号或 Tab 分隔的值；单个值请加括号。',
    'Separate values with newlines, commas, or tabs; enclose a single value in parentheses.',
  ],
  theListContainsNoUsableValues: ['列表没有可用的值。', 'The list contains no usable values.'],
});
