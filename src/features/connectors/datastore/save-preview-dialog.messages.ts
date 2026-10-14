import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  confirmDatabaseChanges: ['确认数据库变更', 'Confirm database changes'],
  closeChangePreview: ['关闭变更预览', 'Close change preview'],
  changesOneTransaction: ['项变更 · 单个事务', ' changes · One transaction'],
  confirmationCommitsAllChangesIfATargetRecordChangedOr: [
    '确认后提交全部变更。若目标记录已变化或任一语句失败，本批次全部回滚。',
    'Confirmation commits all changes. If a target record changed or any statement fails, the entire batch rolls back.',
  ],
  added: ['新增', 'Added'],
  modified: ['修改', 'Modified'],
  delete: ['删除', 'Delete'],
  boundParameters: ['绑定参数', 'Bound parameters'],
  committingTransactionWaitForTheResult: [
    '正在提交事务，请等待结果…',
    'Committing transaction; wait for the result…',
  ],
  backToEditing: ['返回编辑', 'Back to editing'],
  cancel: ['取消', 'Cancel'],
  committing: ['提交中…', 'Committing…'],
  confirmCommit: ['确认提交', 'Confirm commit'],
});
