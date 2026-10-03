import type Redis from 'ioredis';
import type { RedisPubSubAction, RedisPubSubFrame, RedisPubSubMessage, RedisPubSubSubscriptions } from '@fouc/shared';
import { RedisPubSubWire } from './redis-pubsub-wire';
import { RedisEventBuffer, RedisLiveConnection } from './redis-live';
import { redisBlob } from './redis-blob';
import { redisKey } from './redis-input';
import { redisUnsigned } from './redis-protocol';
import { DatabaseInputError } from './input-error';

export const REDIS_PUBSUB_MESSAGES = 500;
export const REDIS_PUBSUB_MESSAGE_BYTES = 65536;
const BUFFER_BYTES = 2 * 1024 * 1024;
const MAX_SUBSCRIPTIONS = 1024;
export function redisPubSubBytes(value: unknown, maxBytes = REDIS_PUBSUB_MESSAGE_BYTES): Buffer {
  if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4) throw new DatabaseInputError(`Pub/Sub 单项不得超过 ${maxBytes} 字节`);
  const bytes = maxBytes === REDIS_PUBSUB_MESSAGE_BYTES ? redisKey(value) : Buffer.from(value, 'base64');
  if (bytes.length > maxBytes || bytes.toString('base64') !== value) throw new DatabaseInputError('Pub/Sub 参数必须为规范 Base64');
  return bytes;
}
export function redisPubSubChange(input: unknown): { kind: RedisPubSubAction; names: Buffer[] } {
  if (!input || typeof input !== 'object') throw new DatabaseInputError('Pub/Sub 订阅参数无效');
  const value = input as Record<string, unknown>;
  if (!['subscribe', 'psubscribe', 'unsubscribe', 'punsubscribe'].includes(String(value.kind)) || !Array.isArray(value.names) || !value.names.length || value.names.length > 100)
    throw new DatabaseInputError('Pub/Sub 操作需要 1–100 个频道或模式名称');
  const names = value.names.map((name) => redisPubSubBytes(name));
  return { kind: value.kind as RedisPubSubAction, names: [...new Map(names.map((bytes) => [bytes.toString('base64'), bytes])).values()] };
}
export function redisPubSubObserved(bytes: Buffer) {
  return { ...redisBlob(bytes.subarray(0, REDIS_PUBSUB_MESSAGE_BYTES)), byteLength: bytes.length, truncated: bytes.length > REDIS_PUBSUB_MESSAGE_BYTES };
}

export class RedisPubSub {
  readonly id = crypto.randomUUID();
  private readonly wire: RedisPubSubWire;
  private readonly live: RedisLiveConnection<RedisPubSubFrame>;
  private readonly buffer = new RedisEventBuffer<RedisPubSubMessage>(REDIS_PUBSUB_MESSAGES, BUFFER_BYTES);
  private readonly channels = new Map<string, Buffer>();
  private readonly patterns = new Map<string, Buffer>();
  private serial: Promise<unknown> = Promise.resolve();
  private sequence = 0;
  constructor(source: Redis, onClose: () => void) {
    this.wire = new RedisPubSubWire(source.options);
    this.live = new RedisLiveConnection(this.wire, 'Redis Pub/Sub', () => {
      this.wire.removeListener('message', this.onMessage); this.buffer.take(); onClose();
    });
    this.wire.on('message', this.onMessage);
  }
  private onMessage = (pattern: Buffer | null, channel: Buffer, payload: Buffer) => {
    this.buffer.push({ captureId: this.id, sequence: ++this.sequence, receivedAt: Date.now(), channel: redisPubSubObserved(channel),
      pattern: pattern === null ? null : redisPubSubObserved(pattern), payload: redisPubSubObserved(payload) });
  };
  open(signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    return this.live.open(signal, () => this.wire.connect(), { type: 'ready', captureId: this.id, maxMessages: REDIS_PUBSUB_MESSAGES, messageBytes: REDIS_PUBSUB_MESSAGE_BYTES }, () => {
      if (this.live.canSend) { const batch = this.buffer.take(); if (batch) this.live.send({ type: 'messages', ...batch }); }
    });
  }
  subscriptions(): RedisPubSubSubscriptions {
    if (!this.live.isReady) throw new DatabaseInputError('当前 Pub/Sub 连接未就绪或已断开');
    return { channels: [...this.channels.values()].map(redisBlob), patterns: [...this.patterns.values()].map(redisBlob), subscriptionCount: String(this.channels.size + this.patterns.size) };
  }
  change(input: unknown): Promise<RedisPubSubSubscriptions> {
    const change = redisPubSubChange(input);
    const result = this.serial.then(async () => {
      this.subscriptions();
      const target = change.kind === 'psubscribe' || change.kind === 'punsubscribe' ? this.patterns : this.channels;
      const adding = change.kind === 'subscribe' || change.kind === 'psubscribe';
      if (adding) {
        const newNames = change.names.filter((bytes) => !target.has(bytes.toString('base64')));
        if (this.channels.size + this.patterns.size + newNames.length > MAX_SUBSCRIPTIONS ||
          [...this.channels.values(), ...this.patterns.values(), ...newNames].reduce((total, bytes) => total + bytes.length, 0) > BUFFER_BYTES)
          throw new DatabaseInputError('当前连接最多 1024 个订阅，名称合计不超过 2 MiB');
      }
      // Remember every server ACK. A later denied name must not hide earlier accepted names.
      for (const bytes of change.names) {
        const replies = await this.wire.command(change.kind.toUpperCase(), [bytes]);
        const ack = replies[0];
        if (!Array.isArray(ack) || ack.length !== 3 || !Buffer.isBuffer(ack[0]) || ack[0].toString() !== change.kind ||
          !Buffer.isBuffer(ack[1]) || !ack[1].equals(bytes)) { this.stop('Redis Pub/Sub 订阅确认格式无效'); throw new Error('Redis Pub/Sub 订阅确认格式无效'); }
        if (adding) target.set(bytes.toString('base64'), bytes); else target.delete(bytes.toString('base64'));
        const count = redisUnsigned(ack[2]);
        if (count !== String(this.channels.size + this.patterns.size)) { this.stop('Redis Pub/Sub 订阅计数不一致'); throw new Error('Redis Pub/Sub 订阅计数不一致'); }
      }
      return this.subscriptions();
    });
    this.serial = result.catch(() => {});
    return result;
  }
  stop(reason?: string): void { this.live.stop(reason); }
}
