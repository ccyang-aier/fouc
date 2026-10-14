import type { RedisPubSubFrame, RedisPubSubMessage } from '@fouc/shared';
import { createUiMessages } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-pubsub-model';
const { error: uiError } = createUiMessages(unitMessages);

const MAX_MESSAGES = 500,
  MAX_BYTES = 2 * 1024 * 1024;
const uuid = (value: unknown) =>
  typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(value);
function blob(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.rawBase64 === 'string' &&
    data.rawBase64.length <= 87384 &&
    typeof data.display === 'string' &&
    data.display.length <= 131074 &&
    (data.encoding === 'utf8' || data.encoding === 'binary') &&
    Number.isSafeInteger(data.byteLength) &&
    Number(data.byteLength) >= 0 &&
    typeof data.truncated === 'boolean'
  );
}
export function redisPubSubFrame(value: unknown): RedisPubSubFrame {
  if (!value || typeof value !== 'object') throw uiError('Pub/Sub 响应格式无效');
  const data = value as Record<string, unknown>;
  if (
    data.type === 'ready' &&
    uuid(data.captureId) &&
    data.maxMessages === 500 &&
    data.messageBytes === 65536
  )
    return data as unknown as RedisPubSubFrame;
  if (data.type === 'error' && typeof data.message === 'string')
    return data as unknown as RedisPubSubFrame;
  if (
    data.type === 'messages' &&
    Number.isSafeInteger(data.dropped) &&
    Number(data.dropped) >= 0 &&
    Array.isArray(data.entries) &&
    data.entries.length <= MAX_MESSAGES &&
    data.entries.every(
      (entry) =>
        entry &&
        uuid(entry.captureId) &&
        Number.isSafeInteger(entry.sequence) &&
        entry.sequence > 0 &&
        Number.isSafeInteger(entry.receivedAt) &&
        entry.receivedAt > 0 &&
        blob(entry.channel) &&
        (entry.pattern === null || blob(entry.pattern)) &&
        blob(entry.payload),
    )
  )
    return data as unknown as RedisPubSubFrame;
  throw uiError('Pub/Sub 响应格式无效');
}
/** Keep distinct channel/pattern deliveries and distinct capture sequences. */
export function redisPubSubMessages(
  current: RedisPubSubMessage[],
  incoming: RedisPubSubMessage[],
): RedisPubSubMessage[] {
  const entries = [...current, ...incoming],
    sizes = entries.map((entry) => new TextEncoder().encode(JSON.stringify(entry)).length + 1);
  let bytes = sizes.reduce((total, size) => total + size, 0),
    offset = 0;
  while (entries.length - offset > MAX_MESSAGES || bytes > MAX_BYTES) bytes -= sizes[offset++]!;
  return entries.slice(offset);
}
export function redisPubSubSearch(entry: RedisPubSubMessage, filter: string): boolean {
  const query = filter.toLowerCase();
  return [entry.channel, entry.pattern, entry.payload].some(
    (value) =>
      value &&
      (value.display.toLowerCase().includes(query) ||
        value.rawBase64.toLowerCase().includes(query)),
  );
}
