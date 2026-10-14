import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  selectOneInsertUpdateOrDeleteStatementToReview: [
    '请选择一条 INSERT、UPDATE 或 DELETE 语句进行审查',
    'Select one INSERT, UPDATE, or DELETE statement to review',
  ],
  sqlChangePreview: ['SQL 变更预览', 'SQL change preview'],
  readOnlyReviewOfTheSelectionOrCurrentWriteOperation: [
    '只读审查选区或当前写操作',
    'Read-only review of the selection or current write operation',
  ],
  changePreview: ['变更预览', 'Change preview'],
});
