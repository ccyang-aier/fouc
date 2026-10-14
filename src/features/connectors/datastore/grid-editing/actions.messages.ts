import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  unlockTableWritesToEdit: ['解锁表格写入后可编辑', 'Unlock table writes to edit'],
  unlockTableWritesBeforePasting: ['解锁表格写入后可粘贴', 'Unlock table writes before pasting'],
  theClipboardContainsNoTextUseThePasteToolTo: [
    '剪贴板未提供文本，可使用粘贴工具手动输入',
    'The clipboard contains no text. Use the paste tool to enter it manually',
  ],
  restoreOriginalSelectionValues: ['恢复选区原值', 'Restore original selection values'],
  stagedChangesForSelectedFieldsWereRemovedOriginalDataIs: [
    '已移除选区字段的暂存变更，原始数据保持完整',
    'Staged changes for selected fields were removed; original data is intact',
  ],
  couldNotRestoreOriginalValues: ['无法恢复原值', 'Could not restore original values'],
  copiedCurrentSelectionValuesTsvIncludesStagedEditsLiteralNull: [
    '已复制选区当前值 · TSV · 包含暂存编辑；NULL 文字与空值分别编码',
    'Copied current selection values · TSV · Includes staged edits; literal NULL and null values are encoded separately',
  ],
  copyFailedCheckBrowserClipboardPermissions: [
    '复制失败，请检查浏览器剪贴板权限',
    'Copy failed. Check browser clipboard permissions',
  ],
  editTheCurrentCellOrCompleteSelection: [
    '编辑当前单元格或完整选区',
    'Edit the current cell or complete selection',
  ],
  editSelection: ['编辑选区', 'Edit selection'],
  pasteAMatrixOrASingleFillValue: ['粘贴矩阵或单个填充值', 'Paste a matrix or a single fill value'],
  paste: ['粘贴', 'Paste'],
  setSelectedFieldsToNullReviewThePreviewFirst: [
    '所选字段设为 NULL，先查看预览',
    'Set selected fields to NULL; review the preview first',
  ],
  removeStagedAssignmentsForSelectedFields: [
    '移除选中字段的暂存赋值',
    'Remove staged assignments for selected fields',
  ],
  restoreOriginalValues: ['恢复原值', 'Restore original values'],
  undoCtrlZToolbarFocus: [
    '撤销{p0} · Ctrl / ⌘ Z（工具栏焦点）',
    'Undo {p0} · Ctrl / ⌘ Z (toolbar focus)',
  ],
  undoPendingChanges: ['撤销待提交变更', 'Undo pending changes'],
  redoCtrlShiftZToolbarFocus: [
    '重做{p0} · Ctrl / ⌘ Shift Z（工具栏焦点）',
    'Redo {p0} · Ctrl / ⌘ Shift Z (toolbar focus)',
  ],
  redoPendingChanges: ['重做待提交变更', 'Redo pending changes'],
  copyCurrentSelectionValuesIncludingStagedEditsWithoutDisplayFormatting: [
    '复制选区当前值（包含暂存变更），不使用显示格式',
    'Copy current selection values including staged edits, without display formatting',
  ],
  copyStagedValues: ['复制暂存值', 'Copy staged values'],
  disjointSelection: [' · 离散选区', ' · Disjoint selection'],
  rowsColumns: ['{p0} 行 × {p1} 列{p2}', '{p0} rows × {p1} columns{p2}'],
  selectACellOrRectangleToEdit: ['选择单元格或矩形以编辑', 'Select a cell or rectangle to edit'],
  gridStagedEditingTools: ['网格暂存编辑工具', 'Grid staged editing tools'],
  theSourceChangedYourInputIsRetainedCloseAndReopen: [
    '来源已改变，保留当前输入；请关闭后重新打开选区编辑',
    'The source changed; your input is retained. Close and reopen selection editing',
  ],
  stagedCellsOneUndoStepNotWrittenToTheDatabase: [
    '已暂存 {p0} 个单元格 · 单次撤销 · 尚未写入数据库',
    'Staged {p0} cells · One undo step · Not written to the database',
  ],
  valuesMatchNoNewPendingChanges: [
    '当前值一致，没有新增待提交变更',
    'Values match; no new pending changes',
  ],
  couldNotAddPendingChanges: ['无法加入待提交变更', 'Could not add pending changes'],
});
