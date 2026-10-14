import type { RedisMonitorFrame, RedisMonitorRecord } from '@fouc/shared';
import { createUiMessages } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-monitor-model';
const { error: uiError } = createUiMessages(unitMessages);

export const REDIS_MONITOR_MAX_ROWS = 1000;
export function isRedisMonitorCommand(command: string): boolean {
  return /^MONITOR\s*;?$/i.test(command.trim());
}

export function redisMonitorFrame(value: unknown): RedisMonitorFrame {
  if (!value || typeof value !== 'object') throw uiError('Redis MONITOR 响应格式无效');
  const data = value as Record<string, unknown>;
  if (
    data.type === 'ready' &&
    data.maxRows === 1000 &&
    data.lineBytes === 16384 &&
    data.bufferBytes === 2097152
  )
    return data as unknown as RedisMonitorFrame;
  if (data.type === 'error' && typeof data.message === 'string')
    return data as unknown as RedisMonitorFrame;
  if (
    data.type === 'rows' &&
    Number.isSafeInteger(data.dropped) &&
    Number(data.dropped) >= 0 &&
    Array.isArray(data.records) &&
    data.records.length <= REDIS_MONITOR_MAX_ROWS &&
    data.records.every(
      (entry) =>
        entry &&
        Number.isSafeInteger(entry.sequence) &&
        entry.sequence > 0 &&
        typeof entry.message === 'string' &&
        entry.message.length <= 16384 &&
        typeof entry.truncated === 'boolean',
    )
  )
    return data as unknown as RedisMonitorFrame;
  throw uiError('Redis MONITOR 响应格式无效');
}
export function redisMonitorRows(
  current: RedisMonitorRecord[],
  incoming: RedisMonitorRecord[],
): RedisMonitorRecord[] {
  return [...current, ...incoming].slice(-REDIS_MONITOR_MAX_ROWS);
}
