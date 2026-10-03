import { EventEmitter } from 'node:events';
import { connect as netConnect, isIP, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import type { RedisOptions } from 'ioredis';
import RedisParser from 'redis-parser';

interface PendingReply {
  remaining: number;
  replies: unknown[];
  resolve: (replies: unknown[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
export function redisRespCommand(name: string, args: Buffer[]): Buffer {
  const parts = [Buffer.from(name), ...args];
  return Buffer.concat([Buffer.from(`*${parts.length}\r\n`), ...parts.flatMap((part) => [Buffer.from(`$${part.length}\r\n`), part, Buffer.from('\r\n')])]);
}

/** RESP2 subscription replies retain pattern bytes that ioredis pmessageBuffer decodes. */
export class RedisPubSubWire extends EventEmitter {
  private socket: Socket | TLSSocket | null = null;
  private closed = false;
  private readonly pending: PendingReply[] = [];
  constructor(private readonly options: RedisOptions) { super(); }
  async connect(): Promise<void> {
    if (this.closed) throw new Error('Redis Pub/Sub 已断开');
    const parser = new RedisParser({ returnBuffers: true, stringNumbers: true,
      returnReply: (reply) => this.reply(reply), returnError: (error) => this.replyError(error), returnFatalError: (error) => this.emit('error', error) });
    await new Promise<void>((resolve, reject) => {
      const host = this.options.host!, port = this.options.port!;
      const socket = this.options.tls ? tlsConnect({ ...this.options.tls, host, port, servername: this.options.tls.servername ?? (isIP(host) ? undefined : host) }) : netConnect({ host, port });
      this.socket = socket; socket.setNoDelay(true);
      socket.once(this.options.tls ? 'secureConnect' : 'connect', resolve);
      socket.once('error', reject);
      socket.on('error', (error) => this.emit('error', error));
      socket.on('close', () => {
        this.rejectPending(new Error('Redis Pub/Sub 连接已断开'));
        // Also settle TCP/TLS setup if cancellation happened before connect.
        reject(new Error('Redis Pub/Sub 连接已断开')); this.emit('end');
      });
      socket.on('data', (bytes) => parser.execute(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)));
    });
    const username = this.options.username, password = this.options.password;
    if (username || password) await this.command('AUTH', username ? [Buffer.from(username), Buffer.from(password ?? '')] : [Buffer.from(password!)]);
    await this.command('SELECT', [Buffer.from(String(this.options.db ?? 0))]);
    await this.command('PING', []);
  }
  command(name: string, args: Buffer[]): Promise<unknown[]> {
    if (this.closed || !this.socket || this.socket.destroyed) return Promise.reject(new Error('Redis Pub/Sub 已断开'));
    const remaining = /^(?:P?SUBSCRIBE|P?UNSUBSCRIBE)$/.test(name) ? args.length : 1;
    if (!remaining) return Promise.reject(new Error('订阅操作需要明确的名称列表'));
    return new Promise((resolve, reject) => {
      const pending: PendingReply = { remaining, replies: [], resolve, reject,
        timer: setTimeout(() => this.emit('error', new Error('Redis Pub/Sub 命令确认超时，已关闭连接')), 10000) };
      this.pending.push(pending);
      this.socket!.write(redisRespCommand(name, args));
    });
  }
  private reply(reply: unknown): void {
    if (this.closed) return;
    if (Array.isArray(reply) && Buffer.isBuffer(reply[0])) {
      const kind = reply[0].toString();
      if (kind === 'message' || kind === 'pmessage') {
        const expected = kind === 'message' ? 3 : 4;
        if (reply.length !== expected || !reply.every((part) => Buffer.isBuffer(part))) { this.emit('error', new Error('Redis Pub/Sub 消息格式无效')); return; }
        this.emit('message', kind === 'pmessage' ? reply[1] : null, reply[expected - 2], reply[expected - 1]); return;
      }
    }
    const pending = this.pending[0];
    if (!pending) { this.emit('error', new Error('Redis Pub/Sub 收到未匹配的确认')); return; }
    pending.replies.push(reply);
    if (--pending.remaining === 0) { this.pending.shift(); clearTimeout(pending.timer); pending.resolve(pending.replies); }
  }
  private replyError(error: Error): void {
    const pending = this.pending.shift();
    if (pending) { clearTimeout(pending.timer); pending.reject(error); }
    else this.emit('error', error);
  }
  private rejectPending(error: Error): void {
    for (const pending of this.pending.splice(0)) { clearTimeout(pending.timer); pending.reject(error); }
  }
  disconnect(): void {
    if (this.closed) return;
    this.closed = true; this.rejectPending(new Error('Redis Pub/Sub 已取消')); this.socket?.destroy();
  }
}
