import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  resultsNestedBeyondLevelsCannotBePinned: [
    '结果嵌套超过 64 层，无法固定',
    'Results nested beyond 64 levels cannot be pinned',
  ],
  pinnedResultsMustTotalNoMoreThanMibReturnLess: [
    '固定结果总大小不能超过 8 MiB，请减少返回数据',
    'Pinned results must total no more than 8 MiB. Return less data',
  ],
  atMostResultsCanBePinnedUnpinOneFirst: [
    '最多固定 5 份结果，请先取消固定一份结果',
    'At most 5 results can be pinned. Unpin one first',
  ],
  eachPinnedResultSupportsAtMostCellsNarrowTheQuery: [
    '单份固定结果最多 50,000 个单元格，请缩小查询范围',
    'Each pinned result supports at most 50,000 cells. Narrow the query scope',
  ],
  pinnedResultsMustTotalNoMoreThanMibUnpinA: [
    '固定结果总大小不能超过 8 MiB，请先取消固定或缩小查询范围',
    'Pinned results must total no more than 8 MiB. Unpin a result or narrow the query scope',
  ],
});
