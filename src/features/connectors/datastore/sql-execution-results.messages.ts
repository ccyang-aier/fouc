import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  executing: ['正在执行', 'Executing'],
  stopping: ['正在停止', 'Stopping'],
  executionComplete: ['执行完成', 'Execution complete'],
  executionInterrupted: ['执行中断', 'Execution interrupted'],
  cancelled: ['已取消', 'Cancelled'],
  queryResults: ['查询结果', 'Query results'],
  runTheCurrentStatementOrAllStatementsToViewSeparate: [
    '运行当前语句或全部语句，在这里查看独立结果。',
    'Run the current statement or all statements to view separate results here.',
  ],
  run: ['运行 ·', 'Run ·'],
  runAll: ['全部运行', 'Run all'],
  queryRequestCouldNotComplete: ['查询请求未能完成', 'Query request could not complete'],
  yourEditsWereKeptModifyTheSqlAndRunIt: [
    '编辑内容已保留，可修改 SQL 后重新运行。',
    'Your edits were kept. Modify the SQL and run it again.',
  ],
  submittingQuery: ['正在提交查询', 'Submitting query'],
  preparingTargetContextAndExecutionRecord: [
    '准备目标上下文和执行记录…',
    'Preparing target context and execution record…',
  ],
  result: ['结果 {p0}', 'Result {p0}'],
  closeResult: ['关闭结果 {p0}', 'Close result {p0}'],
  pinCurrentResult: ['固定当前结果', 'Pin current result'],
  currentResultPinned: ['当前结果已固定', 'Current result pinned'],
  pinTheCurrentResultSoRunningAgainDoesNotReplace: [
    '固定当前结果，再次运行不会覆盖',
    'Pin the current result so running again does not replace it',
  ],
  executionStateLost: ['执行状态已丢失', 'Execution state lost'],
  cancelQuery: ['取消查询', 'Cancel query'],
  sqlExecutionProgress: ['SQL 执行进度', 'SQL execution progress'],
  retryCancellation: ['重试取消', 'Retry cancellation'],
  thisResultWasClosed: ['本次结果已关闭', 'This result was closed'],
  runTheQueryAgainToViewTheResult: [
    '重新运行查询即可查看结果。',
    'Run the query again to view the result.',
  ],
  statement: ['语句', 'Statement'],
  executionFailed: ['执行失败', 'Execution failed'],
  goToSql: ['定位到 SQL', 'Go to SQL'],
  viewSqlForThisExecution: ['查看本次执行的 SQL', 'View SQL for this execution'],
  previouslyCompletedResultsRemainAvailableSubsequentStatementsWereNotEx: [
    '前面已完成的结果仍可查看，后续语句未执行。',
    'Previously completed results remain available. Subsequent statements were not executed.',
  ],
  unableToConfirmThisStatementSResult: [
    '无法确认此语句的结果',
    "Unable to confirm this statement's result",
  ],
  executingThisStatement: ['正在执行此语句', 'Executing this statement'],
  thisStatementWasCancelled: ['此语句已取消', 'This statement was cancelled'],
  thisStatementWasNotExecuted: ['此语句未执行', 'This statement was not executed'],
  waitingForPrecedingStatementsToFinish: [
    '等待前面的语句完成',
    'Waiting for preceding statements to finish',
  ],
  yourEditsAndCompletedResultsWereKeptYouCanRun: [
    '编辑内容和已完成的结果已保留，可重新运行。',
    'Your edits and completed results were kept. You can run the query again.',
  ],
  viewCompletedResultsOrSwitchToAnotherQueryTab: [
    '可查看已完成的结果或切换其他查询标签。',
    'View completed results or switch to another query tab.',
  ],
});
