import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  selectACellOrRectangularSelectionToEdit: [
    '请选择要编辑的单元格或矩形选区',
    'Select a cell or rectangular selection to edit',
  ],
  disjointCellsCannotBeFilledOrPastedAsAMatrix: [
    '离散单元格不能作为填充或粘贴矩阵，请选择完整矩形',
    'Disjoint cells cannot be filled or pasted as a matrix. Select a complete rectangle',
  ],
  eachOperationSupportsUpToRowsAndCellsReduceThe: [
    '每次操作最多 50 行、100 个单元格，请缩小选区',
    'Each operation supports up to 50 rows and 100 cells. Reduce the selection',
  ],
  duplicateSelectionIndicesSelectAgain: [
    '选区索引重复，请重新选择',
    'Duplicate selection indices. Select again',
  ],
  theSelectionIsOutsideTheCurrentlyLoadedPageSelectAgain: [
    '选区已超出当前已加载页，请重新选择',
    'The selection is outside the currently loaded page. Select again',
  ],
  updatingRequiresACompletePrimaryKeyOrNonNullSingle: [
    '修改需要完整主键或非空单列唯一键；当前选区包含不可定位的行',
    'Updating requires a complete primary key or non-null single-column unique key; some selected rows cannot be identified',
  ],
  theSelectionIncludesGeneratedOrIdentityColumnsDeselectThoseColumns: [
    '选区包含数据库生成或 Identity 字段，请取消选择这些列',
    'The selection includes generated or identity columns. Deselect those columns',
  ],
  selectTheDestinationRectangleBeforePasting: [
    '请先选择粘贴目标矩形',
    'Select the destination rectangle before pasting',
  ],
  thePastedMatrixIsRowsColumnsAndMustMatchThe: [
    '粘贴为 {p0} 行 × {p1} 列，须与选区 {p2} 行 × {p3} 列一致；不会截断或覆盖选区外数据',
    'The pasted matrix is {p0} rows × {p1} columns and must match the {p2} rows × {p3} columns selected. Data is never truncated or written outside the selection',
  ],
  eachOperationRequiresCellsAndNoMoreThanRows: [
    '每次操作须包含 1–100 个单元格，且不超过 50 行',
    'Each operation requires 1–100 cells and no more than 50 rows',
  ],
  originalRowsOrColumnsChangedSelectAgain: [
    '原始行或列已改变，请重新选择',
    'Original rows or columns changed. Select again',
  ],
  anEditCannotAssignTheSameCellMoreThanOnce: [
    '同一次编辑不能重复指定单元格',
    'An edit cannot assign the same cell more than once',
  ],
  rowLacksACompletePrimaryKeyOrNonNullSingle: [
    '第 {p0} 行缺少完整主键或非空单列唯一键',
    'Row {p0} lacks a complete primary key or non-null single-column unique key',
  ],
  isDatabaseGeneratedAndCannotBeAssignedDirectly: [
    '{p0} 由数据库生成，不能直接赋值',
    '{p0} is database-generated and cannot be assigned directly',
  ],
  rowIsStagedForDeletionUndoThatDeletionFirst: [
    '第 {p0} 行已暂存删除，请先撤销删除',
    'Row {p0} is staged for deletion. Undo that deletion first',
  ],
  newRecordsCannotBeBoundToALoadedRowIndex: [
    '新增记录不能绑定已加载行的索引',
    'New records cannot be bound to a loaded row index',
  ],
  originalRowsInPendingChangesNoLongerMatchTheLoaded: [
    '待提交变更的原始行与当前已加载数据不一致，请先审查或放弃旧变更',
    'Original rows in pending changes no longer match the loaded data. Review or discard old changes first',
  ],
  invalidPendingRowType: ['待提交行类型无效', 'Invalid pending row type'],
  doesNotAllowNull: ['{p0} 不允许 NULL', '{p0} does not allow NULL'],
  thePendingListSupportsUpToChangesSaveOrReduce: [
    '当前待提交列表最多 100 项变更，请先保存或减少变更',
    'The pending list supports up to 100 changes. Save or reduce the changes first',
  ],
  originalRowsAndChangesExceedTheSaveProtocolSMb: [
    '原始行与变更超过当前保存协议的 1 MB 范围，请缩小批次',
    "Original rows and changes exceed the save protocol's 1 MB limit. Reduce the batch",
  ],
});
