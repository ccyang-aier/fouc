import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  cloneSelectedRows: ['克隆所选行', 'Clone selected rows'],
  deleteSelectedRows: ['删除所选行', 'Delete selected rows'],
  unableToStageSelectedRowAction: ['无法暂存所选行操作', 'Unable to stage selected row action'],
  unableToGeneratePreview: ['无法生成预览', 'Unable to generate preview'],
  committedChangesMs: ['已提交 {p0} 项变更 · {p1} ms', 'Committed {p0} changes · {p1} ms'],
  commitFailedRefreshAndCheckTheData: [
    '提交失败，请刷新后检查数据',
    'Commit failed. Refresh and check the data',
  ],
  addRow: ['新增行', 'Add row'],
  editRow: ['编辑行', 'Edit row'],
  deleteRows: ['删除行', 'Delete rows'],
  commit: ['提交', 'Commit'],
  rollBack: ['回滚', 'Roll back'],
  changesAwaitingCommit: ['项待提交变更', 'changes awaiting commit'],
  discardAll: ['放弃全部', 'Discard all'],
  generatingPreview: ['生成预览…', 'Generating preview…'],
  previewAndCommit: ['预览并提交', 'Preview and commit'],
  addRecord: ['新增记录', 'Add record'],
  delete: ['删除', 'Delete'],
  modified: ['修改', 'Modified'],
  row: ['第 {p0} 行', 'Row {p0}'],
  editNewChange: ['编辑新增变更 {p0}', 'Edit new change {p0}'],
  removeChange: ['移除变更 {p0}', 'Remove change {p0}'],
});
