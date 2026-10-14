import { defineMessages, type Locale } from '@/lib/i18n';
import type { DtsSeverity } from '@fouc/shared';
import { createUiMessages, uiText } from '../../i18n/ui-message';

const messages = defineMessages({
  待处理: ['待处理', 'Pending'],
  处理中: ['处理中', 'In progress'],
  完成: ['完成', 'Done'],
  关闭: ['关闭', 'Closed'],
  验证: ['验证', 'Verifying'],
  阻塞: ['阻塞', 'Blocked'],
  失败: ['失败', 'Failed'],
  已取消: ['已取消', 'Canceled'],
  致命: ['致命', 'Fatal'],
  严重: ['严重', 'Critical'],
  一般: ['一般', 'Normal'],
  提示: ['提示', 'Notice'],
});
const { message } = createUiMessages(messages);

/** DTS status is a domain field; unknown provider states keep their original label. */
export function dtsStatusLabel(status: string, locale: Locale): string {
  switch (status) {
    case '待处理':
    case '处理中':
    case '完成':
    case '关闭':
    case '验证':
    case '阻塞':
    case '失败':
    case '已取消':
      return uiText(message(status), locale);
    default:
      return status;
  }
}
export function dtsSeverityLabel(severity: DtsSeverity, locale: Locale): string {
  return uiText(message(severity), locale);
}
