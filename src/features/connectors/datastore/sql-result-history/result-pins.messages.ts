import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  unpinCurrentResult: ['取消固定当前结果', 'Unpin current result'],
  pinnedResult: ['{p0} · 固定结果', '{p0} · pinned result'],
  pinnedSnapshotRows: ['{p0}\n固定快照 · {p1} 行\n{p2}', '{p0}\nPinned snapshot · {p1} rows\n{p2}'],
  unpin: ['取消固定 {p0}', 'Unpin {p0}'],
  compareWithCurrent: ['与当前比较', 'Compare with current'],
  comparePinnedSnapshotWithCurrentResult: [
    '比较固定快照与当前结果',
    'Compare pinned snapshot with current result',
  ],
  pinnedAndCurrentResultComparison: [
    '固定结果与当前结果比较',
    'Pinned and current result comparison',
  ],
  pinnedSnapshot: ['{p0} · 固定快照', '{p0} · pinned snapshot'],
  currentExecution: ['{p0} · 当前执行', '{p0} · current execution'],
  comparesOnlyTheTwoSnapshotsLoadedWhenOpened: [
    '仅比较打开时两份已加载快照',
    'Compares only the two snapshots loaded when opened',
  ],
  closeComparison: ['关闭比较', 'Close comparison'],
});
