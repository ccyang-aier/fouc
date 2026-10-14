import { getLocale, type Locale } from '@/lib/i18n';
import type { RedisBulkOperation } from '@fouc/shared/redis-bulk';
import { createUiMessages, uiText } from '../../i18n/ui-message';
import { messages as unitMessages } from '../i18n/bulk-model';
const { message: uiMessage, error: uiError } = createUiMessages(unitMessages);

export const operationLabels = {
  'relative-ttl': uiMessage('设置相对 TTL'),
  'absolute-ttl': uiMessage('设置绝对期限'),
  persist: uiMessage('永久保留 · PERSIST'),
  delete: uiMessage('删除 Key · DEL'),
};

export const stateLabels = {
  applied: uiMessage('已执行'),
  unchanged: uiMessage('无需更改'),
  missing: uiMessage('原本缺失'),
  conflict: uiMessage('冲突'),
  failed: uiMessage('执行失败'),
  skipped: uiMessage('未执行'),
  unknown: uiMessage('结果未确认'),
};

export function bulkOperation(
  kind: RedisBulkOperation['kind'],
  seconds: string,
  deadline: string,
): RedisBulkOperation {
  if (kind === 'delete' || kind === 'persist') return { kind };
  if (kind === 'absolute-ttl') {
    const milliseconds = new Date(deadline).getTime();
    if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0)
      throw uiError('请选择有效的本地绝对过期时间');
    return { kind, milliseconds: String(milliseconds) };
  }
  if (!/^[1-9]\d{0,12}$/.test(seconds))
    throw uiError('TTL 请输入正整数秒；永久保留请明确选择 PERSIST');
  const milliseconds = BigInt(seconds) * 1000n;
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) throw uiError('TTL 超出精确时间范围');
  return { kind, milliseconds: String(milliseconds) };
}

export function expiryLabel(value: string | null, locale: Locale = getLocale()): string {
  if (value === '-1') return uiText(uiMessage('永久'), locale);
  if (value === '-2') return uiText(uiMessage('不存在'), locale);
  if (value === null) return uiText(uiMessage('未确认'), locale);
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime())
    ? `${value} ms`
    : date.toLocaleString(locale, { hour12: false });
}
