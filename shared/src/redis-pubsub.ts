import type { RedisBlob } from './redis';
export type RedisPubSubAction = 'subscribe' | 'psubscribe' | 'unsubscribe' | 'punsubscribe';
export interface RedisPubSubSubscriptions { channels: RedisBlob[]; patterns: RedisBlob[]; subscriptionCount: string }
export interface RedisPubSubObservedBlob extends RedisBlob { byteLength: number; truncated: boolean }
export interface RedisPubSubMessage {
  captureId: string;
  sequence: number;
  receivedAt: number;
  channel: RedisPubSubObservedBlob;
  pattern: RedisPubSubObservedBlob | null;
  payload: RedisPubSubObservedBlob;
}
export type RedisPubSubFrame =
  | { type: 'ready'; captureId: string; maxMessages: number; messageBytes: number }
  | { type: 'messages'; entries: RedisPubSubMessage[]; dropped: number }
  | { type: 'error'; message: string };
export interface RedisPubSubPublishResult { receivers: string; publishedAt: number }
