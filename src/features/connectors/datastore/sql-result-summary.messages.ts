import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  executing: ['正在执行', 'Executing'],
  stopping: ['正在停止', 'Stopping'],
  executionComplete: ['执行完成', 'Execution complete'],
  executionInterrupted: ['执行中断', 'Execution interrupted'],
  cancelled: ['已取消', 'Cancelled'],
  waitingToExecute: ['等待执行', 'Waiting to execute'],
  executing3177: ['执行中', 'Executing'],
  succeeded: ['成功', 'succeeded'],
  failed: ['失败', 'Failed'],
  notExecuted: ['未执行', 'Not executed'],
  sqlExecutionSummary: ['SQL 执行摘要', 'SQL execution summary'],
  executionStateLost: ['执行状态已丢失', 'Execution state lost'],
  statementExecutionCompletionRatio: ['语句执行完成比例', 'Statement execution completion ratio'],
  statement: ['语句', 'Statement'],
  status: ['状态', 'Status'],
  returnedRows: ['返回行', 'Returned rows'],
  duration: ['耗时', 'Duration'],
  unknownStatus: ['状态未知', 'Unknown status'],
  includesOnlyRowsReturnedInThisExecution: [
    '仅包含本次已返回行',
    'Includes only rows returned in this execution',
  ],
});
