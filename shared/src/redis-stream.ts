import type { RedisBlob } from './redis';
export interface RedisStreamGroup {
  name: RedisBlob;
  consumers: string;
  pending: string;
  lastDeliveredId: string;
  entriesRead: string | null;
  lag: string | null;
}
export interface RedisStreamConsumer {
  name: RedisBlob;
  pending: string;
  idleMs: string;
  inactiveMs: string | null;
}
export interface RedisStreamPendingEntry {
  id: string;
  consumer: RedisBlob;
  idleMs: string;
  deliveries: string;
}
export interface RedisStreamGroups { groups: RedisStreamGroup[]; fetchedAt: number }
export interface RedisStreamConsumers { consumers: RedisStreamConsumer[]; fetchedAt: number }
export interface RedisStreamPendingPage { entries: RedisStreamPendingEntry[]; nextCursor: string | null; fetchedAt: number }
