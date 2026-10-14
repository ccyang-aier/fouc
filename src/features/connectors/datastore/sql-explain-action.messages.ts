import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  selectOneSelectWithQueryOrPlaceTheCursorInside: [
    '请选择一条 SELECT / WITH 查询，或将光标移到查询内。',
    'Select one SELECT / WITH query, or place the cursor inside it.',
  ],
  executionPlansSupportAtMostParameters: [
    '执行计划最多支持 128 个参数。',
    'Execution plans support at most 128 parameters.',
  ],
  viewExecutionPlan: ['查看执行计划', 'View execution plan'],
  selectionOrCurrentQueryEstimatedPlanOnly: [
    '选区或当前查询 · 仅生成估算计划',
    'Selection or current query · estimated plan only',
  ],
  executionPlan: ['执行计划', 'Execution plan'],
  resultAreaExecutionPlan: ['结果区执行计划', 'Result area execution plan'],
  viewTheCurrentSqlExecutionPlan: [
    '查看当前 SQL 的执行计划',
    'View the current SQL execution plan',
  ],
  sqlExecutionPlan: ['SQL 执行计划', 'SQL execution plan'],
  explainEstimatedPlanQueryNotExecuted: [
    'EXPLAIN · 估算计划 · 未实际运行查询',
    'EXPLAIN · estimated plan · query not executed',
  ],
  viewThisQuery: ['查看本次查询', 'View this query'],
  readingTheNativeExecutionPlan: ['正在读取原生执行计划…', 'Reading the native execution plan…'],
  msOptimizerEstimatesDoNotRepresentActualDuration: [
    '{p0} ms · 优化器估算不代表实际耗时',
    '{p0} ms · optimizer estimates do not represent actual duration',
  ],
  queryContentWasKeptCloseEditAndTryAgain: [
    '查询内容保留，可关闭后修改并重试',
    'Query content was kept. Close, edit, and try again',
  ],
  cancelAndClose: ['取消并关闭', 'Cancel and close'],
  close: ['关闭', 'Close'],
});
