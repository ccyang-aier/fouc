import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  cancellationRequestUnconfirmedYouCanRetryCancellation: [
    '取消请求未确认：{p0}。可重试取消。',
    'Cancellation request unconfirmed: {p0}. You can retry cancellation.',
  ],
  theDeviceSessionOrExecutionRecordWasReleasedSoThis: [
    '设备会话或执行记录已释放，无法确认此查询的最终结果。已返回的结果仍保留，请重新连接后执行。',
    "The device session or execution record was released, so this query's final result cannot be confirmed. Returned results are kept. Reconnect before executing.",
  ],
  executionStateTemporarilyUnavailableReconnectingQueryCompletionIsNotYe: [
    '执行状态暂不可用：{p0}。正在重连，尚未确认查询结束。',
    'Execution state temporarily unavailable: {p0}. Reconnecting; query completion is not yet confirmed.',
  ],
  queryRequestFailed: ['查询请求失败', 'Query request failed'],
});
