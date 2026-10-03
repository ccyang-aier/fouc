import type Redis from 'ioredis';
import type { RedisMonitorFrame, RedisMonitorRecord } from '@fouc/shared';

export const REDIS_MONITOR_ROWS = 1000;
export const REDIS_MONITOR_LINE_BYTES = 16384;
export const REDIS_MONITOR_BUFFER_BYTES = 2 * 1024 * 1024;

/** DBX retains 1000 rows / 16KiB per row. Bound the pending transport too. */
export class RedisMonitorBuffer {
  private rows: RedisMonitorRecord[] = [];
  private sizes: number[] = [];
  private bytes = 0;
  private sequence = 0;
  private dropped = 0;
  push(message: string): void {
    const input = Buffer.from(message);
    const truncated = input.length > REDIS_MONITOR_LINE_BYTES;
    // MONITOR byte escapes are ASCII; also retain UTF-8 boundaries for alternate servers.
    let end = Math.min(input.length, REDIS_MONITOR_LINE_BYTES);
    if (truncated) while (end > 0 && (input[end]! & 0xc0) === 0x80) end--;
    const record = { sequence: ++this.sequence, message: input.subarray(0, end).toString(), truncated };
    const size = Buffer.byteLength(JSON.stringify(record)) + 1;
    this.rows.push(record); this.sizes.push(size); this.bytes += size;
    while (this.rows.length > REDIS_MONITOR_ROWS || this.bytes > REDIS_MONITOR_BUFFER_BYTES) {
      this.rows.shift(); this.bytes -= this.sizes.shift()!; this.dropped++;
    }
  }
  take(): RedisMonitorFrame | null {
    if (!this.rows.length && !this.dropped) return null;
    const frame: RedisMonitorFrame = { type: 'rows', records: this.rows, dropped: this.dropped };
    this.rows = []; this.sizes = []; this.bytes = 0; this.dropped = 0;
    return frame;
  }
}

/** A monitor is an owned connection, never the normal session or a broadcast hub. */
export class RedisMonitor {
  private readonly client: Redis;
  private readonly buffer = new RedisMonitorBuffer();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private pendingReject: ((error: Error) => void) | null = null;
  private detachAbort: (() => void) | null = null;
  constructor(source: Redis, private readonly onClose: () => void) {
    this.client = source.duplicate({ monitor: true, lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 0 });
    this.client.on('error', this.onError);
    this.client.on('end', this.onEnd);
    this.client.on('monitor', this.onRecord);
  }
  private onError = (error: Error) => this.stop(error.message);
  private onEnd = () => this.stop('Redis MONITOR 连接已断开');
  private onRecord = (timestamp: string, args: string[], source: string, database: string) => {
    if (this.closed) return;
    if (typeof timestamp !== 'string' || !/^\d+\.\d+$/.test(timestamp) || !Array.isArray(args) || !args.every((value) => typeof value === 'string')) {
      this.stop('Redis MONITOR 响应格式无效'); return;
    }
    // ioredis leaves Redis C escapes intact, except escaped quotes. Restore those.
    const line = `${timestamp} [${database} ${source}] ${args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`;
    this.buffer.push(line);
  };
  async open(signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const abort = () => this.stop();
    signal.addEventListener('abort', abort, { once: true });
    this.detachAbort = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { this.stop(); throw new Error('Redis MONITOR 已取消'); }
    try {
      await new Promise<void>((resolve, reject) => {
        this.pendingReject = reject;
        this.client.once('monitoring', () => { this.pendingReject = null; resolve(); });
        this.timeout = setTimeout(() => this.stop('Redis MONITOR 连接超时'), 10000);
        void this.client.connect().catch(this.onError);
      });
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = null;
      if (this.closed) throw new Error('Redis MONITOR 已取消');
      return new ReadableStream<Uint8Array>({
        start: (controller) => {
          this.controller = controller;
          this.send({ type: 'ready', maxRows: REDIS_MONITOR_ROWS, lineBytes: REDIS_MONITOR_LINE_BYTES, bufferBytes: REDIS_MONITOR_BUFFER_BYTES });
          this.timer = setInterval(() => this.flush(), 100);
        },
        pull: () => this.flush(),
        cancel: () => { this.controller = null; this.stop(); },
      });
    } catch (error) { this.stop(); throw error; }
  }
  private send(frame: RedisMonitorFrame): void {
    this.controller?.enqueue(Buffer.from(JSON.stringify(frame) + '\n'));
  }
  private flush(): void {
    if (!this.controller || this.closed || (this.controller.desiredSize ?? 0) <= 0) return;
    const frame = this.buffer.take();
    if (frame) this.send(frame);
  }
  stop(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.pendingReject?.(new Error(reason ?? 'Redis MONITOR 已取消')); this.pendingReject = null;
    if (this.timeout) clearTimeout(this.timeout);
    if (this.timer) clearInterval(this.timer);
    this.timeout = null; this.timer = null;
    this.detachAbort?.(); this.detachAbort = null;
    this.client.removeListener('monitor', this.onRecord);
    this.client.removeListener('end', this.onEnd);
    // Keep the error listener until the socket is closed to consume late transport errors.
    this.client.disconnect();
    if (this.controller) {
      if (reason) this.send({ type: 'error', message: reason });
      this.controller.close(); this.controller = null;
    }
    this.buffer.take();
    this.onClose();
  }
}
