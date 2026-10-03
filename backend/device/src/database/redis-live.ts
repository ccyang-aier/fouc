import type { EventEmitter } from 'node:events';

/** Both live Redis features bound records before transport backpressure can grow memory. */
export class RedisEventBuffer<T> {
  private entries: T[] = [];
  private sizes: number[] = [];
  private bytes = 0;
  private dropped = 0;
  constructor(private readonly maxRows: number, private readonly maxBytes: number) {}
  push(entry: T): void {
    const size = Buffer.byteLength(JSON.stringify(entry)) + 1;
    this.entries.push(entry); this.sizes.push(size); this.bytes += size;
    while (this.entries.length > this.maxRows || this.bytes > this.maxBytes) {
      this.entries.shift(); this.bytes -= this.sizes.shift()!; this.dropped++;
    }
  }
  take(): { entries: T[]; dropped: number } | null {
    if (!this.entries.length && !this.dropped) return null;
    const batch = { entries: this.entries, dropped: this.dropped };
    this.entries = []; this.sizes = []; this.bytes = 0; this.dropped = 0;
    return batch;
  }
}
type Client = Pick<EventEmitter, 'on'> & { disconnect(): void };

/** Owns setup, request cancellation, client lifetime and the per-request stream. */
export class RedisLiveConnection<T> {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private rejectSetup: ((error: Error) => void) | null = null;
  private detachAbort: (() => void) | null = null;
  private closed = false;
  private ready = false;
  constructor(private readonly client: Client, private readonly label: string, private readonly onClose: () => void) {
    client.on('error', (error: Error) => this.stop(error.message));
    client.on('end', () => this.stop(`${label} 连接已断开`));
  }
  get isReady(): boolean { return this.ready && !this.closed; }
  get canSend(): boolean { return !this.closed && this.controller !== null && (this.controller.desiredSize ?? 0) > 0; }
  async open(signal: AbortSignal, connect: () => Promise<unknown>, ready: T, flush: () => void): Promise<ReadableStream<Uint8Array>> {
    const abort = () => this.stop();
    signal.addEventListener('abort', abort, { once: true });
    this.detachAbort = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { this.stop(); throw new Error(`${this.label} 已取消`); }
    try {
      const cancelled = new Promise<never>((_, reject) => { this.rejectSetup = reject; });
      this.timeout = setTimeout(() => this.stop(`${this.label} 连接超时`), 10000);
      await Promise.race([connect(), cancelled]);
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = null; this.rejectSetup = null;
      if (this.closed) throw new Error(`${this.label} 已取消`);
      this.ready = true;
      return new ReadableStream<Uint8Array>({
        start: (controller) => { this.controller = controller; this.send(ready); this.timer = setInterval(flush, 100); },
        pull: flush,
        cancel: () => { this.controller = null; this.stop(); },
      });
    } catch (error) { this.stop(); throw error; }
  }
  send(frame: T | { type: 'error'; message: string }): void { this.controller?.enqueue(Buffer.from(JSON.stringify(frame) + '\n')); }
  stop(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.rejectSetup?.(new Error(reason ?? `${this.label} 已取消`)); this.rejectSetup = null;
    if (this.timeout) clearTimeout(this.timeout);
    if (this.timer) clearInterval(this.timer);
    this.timeout = null; this.timer = null;
    this.detachAbort?.(); this.detachAbort = null;
    this.client.disconnect();
    if (this.controller) {
      if (reason) this.send({ type: 'error', message: reason });
      this.controller.close(); this.controller = null;
    }
    this.onClose();
  }
}
