import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  failureWithExpiredPlan: [
    '{reason}\n该计划已失效。若请求连接中断，请刷新目标表确认最终状态后重新预览。',
    '{reason}\nThis plan is no longer valid. If the request connection was interrupted, refresh the target table to confirm its final state before previewing again.',
  ],
  thisPlanIsNoLongerValidIfTheRequestConnection: [
    '\n该计划已失效。若请求连接中断，请刷新目标表确认最终状态后重新预览。',
    '\nThis plan is no longer valid. If the request connection was interrupted, refresh the target table to confirm its final state before previewing again.',
  ],
  requestCancelledNoCommitOutcomeReceivedRefreshTheTargetTable: [
    '请求已取消，未收到提交结果。请刷新目标表确认最终状态；不要直接重复提交。',
    'Request cancelled; no commit outcome received. Refresh the target table to confirm its final state. Do not submit again directly.',
  ],
  generationReviewCancelledAppendCommitWasNotInitiated: [
    '已取消生成 / 审查，尚未发起追加提交。',
    'Generation / review cancelled; append commit was not initiated.',
  ],
});
