import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  statementRows: ['{p0} · 语句 {p1} · {p2} 行', '{p0} · Statement {p1} · {p2} rows'],
  compareQueryResults: ['比较查询结果', 'Compare query results'],
  leftReferenceResults: ['左侧参考结果', 'Left reference results'],
  compareLeftQueryResults: ['比较左侧查询结果', 'Compare left query results'],
  rightTargetResults: ['右侧目标结果', 'Right target results'],
  compareRightQueryResults: ['比较右侧查询结果', 'Compare right query results'],
  theQueryResultListHasChangedThisReviewContinuesTo: [
    '查询结果列表已更新；当前审查继续使用打开时的快照。',
    'The query result list has changed. This review continues to use the snapshot captured when opened.',
  ],
  successfulResultSnapshotsFromTheCurrentConnectionSubsequentQueriesDo: [
    '当前连接内的已成功结果快照；继续执行查询不会改变本次审查。',
    'Successful result snapshots from the current connection. Subsequent queries do not change this review.',
  ],
  reopenTheLatestSources: ['重新打开最新来源', 'Reopen the latest sources'],
  sqlCandidatesCanBeSentToANewQueryTab: [
    'SQL 候选可放入新查询标签审查',
    'SQL candidates can be sent to a new query tab for review',
  ],
  closeComparison: ['关闭比较', 'Close comparison'],
});
