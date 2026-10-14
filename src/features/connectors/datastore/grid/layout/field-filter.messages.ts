import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  columnFilter: ['字段筛选', 'Column filter'],
  searchColumns: ['搜索字段', 'Search columns'],
  searchColumns1317: ['搜索字段...', 'Search columns…'],
  columnWidth: ['列宽', 'Column width'],
  autoFitColumnWidth: ['自动适配列宽', 'Auto-fit column width'],
  columnActions: ['字段操作', 'Column actions'],
  keepAtLeastOneColumnVisibleDragToReorderColumns: [
    '至少保留一列可见。拖动可调整字段顺序。',
    'Keep at least one column visible. Drag to reorder columns.',
  ],
  invertSelection: ['反选', 'Invert selection'],
  resetOrder: ['重置顺序', 'Reset order'],
  showAll: ['显示全部', 'Show all'],
  moveColumn: ['移动字段 {p0}', 'Move column {p0}'],
  pressAndDragSpaceToSelectArrowKeysToMove: [
    '长按拖动 · 空格选择、上下键移动',
    'Press and drag · Space to select, arrow keys to move',
  ],
  noMatchingColumns: ['没有匹配字段', 'No matching columns'],
});
