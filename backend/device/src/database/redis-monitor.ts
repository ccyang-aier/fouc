import type Redis from 'ioredis';
import type { RedisMonitorFrame, RedisMonitorRecord } from '@fouc/shared';
import { RedisEventBuffer, RedisLiveConnection } from './redis-live';

export const REDIS_MONITOR_ROWS = 1000;
export const REDIS_MONITOR_LINE_BYTES = 16384;
export const REDIS_MONITOR_BUFFER_BYTES = 2 * 1024 * 1024;

/** DBX retains 1000 rows / 16KiB per row; live transport is bounded separately. */
export class RedisMonitorBuffer {
  private readonly buffer = new RedisEventBuffer<RedisMonitorRecord>(REDIS_MONITOR_ROWS, REDIS_MONITOR_BUFFER_BYTES);
  private sequence = 0;
  push(message: string): void {
    const input = Buffer.from(message), truncated = input.length > REDIS_MONITOR_LINE_BYTES;
    let end = Math.min(input.length, REDIS_MONITOR_LINE_BYTES);
    if (truncated) while (end > 0 && (input[end]! & 0xc0) === 0x80) end--;
    this.buffer.push({ sequence: ++this.sequence, message: input.subarray(0, end).toString(), truncated });
  }
  take(): RedisMonitorFrame | null {
    const batch = this.buffer.take();
    return batch ? { type: 'rows', records: batch.entries, dropped: batch.dropped } : null;
  }
}

/** A monitor is an owned connection, never the normal session or a broadcast hub. */
export class RedisMonitor {
  private readonly client: Redis;
  private readonly buffer = new RedisMonitorBuffer();
  private readonly live: RedisLiveConnection<RedisMonitorFrame>;
  constructor(source: Redis, onClose: () => void) {
    this.client = source.duplicate({ monitor: true, lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 0 });
    this.live = new RedisLiveConnection(this.client, 'Redis MONITOR', () => {
      this.client.removeListener('monitor', this.onRecord); this.buffer.take(); onClose();
    });
    this.client.on('monitor', this.onRecord);
  }
  private onRecord = (timestamp: string, args: string[], source: string, database: string) => {
    if (typeof timestamp !== 'string' || !/^\d+\.\d+$/.test(timestamp) || !Array.isArray(args) || !args.every((value) => typeof value === 'string')) {
      this.stop('Redis MONITOR 响应格式无效'); return;
    }
    // ioredis preserves Redis C escapes except escaped quotes; restore those.
    this.buffer.push(`${timestamp} [${database} ${source}] ${args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`);
  };
  open(signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    return this.live.open(signal, () => new Promise<void>((resolve, reject) => {
      this.client.once('monitoring', resolve); void this.client.connect().catch(reject);
    }), { type: 'ready', maxRows: REDIS_MONITOR_ROWS, lineBytes: REDIS_MONITOR_LINE_BYTES, bufferBytes: REDIS_MONITOR_BUFFER_BYTES }, () => {
      if (this.live.canSend) { const frame = this.buffer.take(); if (frame) this.live.send(frame); }
    });
  }
  stop(reason?: string): void { this.live.stop(reason); }
}
