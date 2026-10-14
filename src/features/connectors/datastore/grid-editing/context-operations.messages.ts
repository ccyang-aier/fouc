import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  selectUpToValidRowsOnTheCurrentPage: [
    '请选择当前页最多 50 个有效行',
    'Select up to 50 valid rows on the current page',
  ],
  theSelectionIncludesRowsStagedForDeletionUndoThoseDeletions: [
    '选区包含已暂存删除的行，请先撤销删除',
    'The selection includes rows staged for deletion. Undo those deletions first',
  ],
  deletingRequiresACompletePrimaryKeyOrNonNullUnique: [
    '删除需要完整主键或非空唯一键',
    'Deleting requires a complete primary key or non-null unique key',
  ],
  pendingChangesExceedItemsOrMbReduceTheBatch: [
    '待提交变更超过 100 项或 1 MB，请缩小批次',
    'Pending changes exceed 100 items or 1 MB. Reduce the batch',
  ],
});
