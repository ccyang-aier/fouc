import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  foreignKeyManagement: ['外键管理', 'Foreign key management'],
  changingSqliteForeignKeysRequiresRebuildingTheTableAndIs: [
    'SQLite外键修改需要重建表，当前未实现',
    'Changing SQLite foreign keys requires rebuilding the table and is not supported yet',
  ],
  createAndDropRealForeignKeysReviewDdlFirst: [
    '真实外键创建与删除 · 先审查DDL',
    'Create and drop real foreign keys · Review DDL first',
  ],
  nativeDdlReview: ['原生DDL审查', 'Native DDL review'],
  actualColumnsAndReferencedKeys: ['真实字段与引用键', 'Actual columns and referenced keys'],
  reloadCatalog: ['重读目录', 'Reload catalog'],
  close: ['关闭', 'Close'],
  cancel: ['取消', 'Cancel'],
  backToEditing: ['返回编辑', 'Back to editing'],
  readOnlyReview: ['只读审查中…', 'Read-only review…'],
  reviewForeignKeyDdl: ['审查外键DDL', 'Review foreign key DDL'],
  committingNativeChanges: ['原生提交中…', 'Committing native changes…'],
  confirmForeignKeyChanges: ['确认外键变更', 'Confirm foreign key changes'],
});
