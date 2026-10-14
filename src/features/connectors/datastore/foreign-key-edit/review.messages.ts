import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  create: ['创建', 'Create'],
  delete: ['删除', 'Delete'],
  planAlreadyConsumed: ['计划已消费', 'Plan already consumed'],
  secondsRemaining: ['剩余 {p0} 秒', '{p0} seconds remaining'],
  reviewExpired: ['审查已过期', 'Review expired'],
  implicitCommit: ['隐式提交', 'Implicit commit'],
  nativeTransaction: ['原生事务', 'Native transaction'],
  copyForeignKeyDdl: ['复制外键DDL', 'Copy foreign key DDL'],
  completeForeignKeyDdl: ['完整外键DDL', 'Complete foreign key DDL'],
  foreignKeyChangesConfirmed: ['外键变更已确认', 'Foreign key changes confirmed'],
  resultUnconfirmed: ['结果未确认', 'Result unconfirmed'],
  foreignKeyChangesNotApplied: ['外键变更未应用', 'Foreign key changes not applied'],
  theCurrentSessionIsReadOnlyReviewTheCompleteDdl: [
    '当前会话只读，先审查完整DDL再解锁。',
    'The current session is read-only. Review the complete DDL before unlocking.',
  ],
  unlocking: ['解锁中…', 'Unlocking…'],
  unlockForeignKeyWrites: ['解锁外键写入', 'Unlock foreign key writes'],
  confirmForeignKeyChangesHaveBeenReviewed: [
    '确认已审查外键变更',
    'Confirm foreign key changes have been reviewed',
  ],
  iHaveReviewedTheRelationshipDirectionAndCompleteDdlAnd: [
    '我已审查关系方向与完整DDL，确认',
    'I have reviewed the relationship direction and complete DDL, and confirm ',
  ],
  foreignKeys: ['外键', 'Foreign keys'],
  iUnderstandThatMysqlDdlCannotBeUndoneThroughA: [
    '理解MySQL DDL不能通过事务撤销。',
    'I understand that MySQL DDL cannot be undone through a transaction.',
  ],
});
