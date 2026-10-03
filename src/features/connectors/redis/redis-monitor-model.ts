import type { RedisMonitorFrame, RedisMonitorRecord } from '@fouc/shared'

export const REDIS_MONITOR_MAX_ROWS = 1000
export function isRedisMonitorCommand(command: string): boolean { return /^MONITOR\s*;?$/i.test(command.trim()) }

function frame(value: unknown): RedisMonitorFrame {
  if (!value || typeof value !== 'object') throw new Error('Redis MONITOR 响应格式无效')
  const data = value as Record<string, unknown>
  if (data.type === 'ready' && data.maxRows === 1000 && data.lineBytes === 16384 && data.bufferBytes === 2097152)
    return data as unknown as RedisMonitorFrame
  if (data.type === 'error' && typeof data.message === 'string') return data as unknown as RedisMonitorFrame
  if (data.type === 'rows' && Number.isSafeInteger(data.dropped) && Number(data.dropped) >= 0 && Array.isArray(data.records) && data.records.length <= REDIS_MONITOR_MAX_ROWS &&
    data.records.every((entry) => entry && Number.isSafeInteger(entry.sequence) && entry.sequence > 0 && typeof entry.message === 'string' && entry.message.length <= 16384 && typeof entry.truncated === 'boolean'))
    return data as unknown as RedisMonitorFrame
  throw new Error('Redis MONITOR 响应格式无效')
}
/** Network chunks need not end on a frame or UTF-8 character boundary. */
export class RedisMonitorDecoder {
  private readonly decoder = new TextDecoder()
  private pending = ''
  feed(chunk: Uint8Array): RedisMonitorFrame[] {
    this.pending += this.decoder.decode(chunk, { stream: true })
    if (this.pending.length > 4 * 1024 * 1024) throw new Error('Redis MONITOR 帧超过传输上限')
    const lines = this.pending.split('\n')
    this.pending = lines.pop()!
    return lines.filter((line) => line.trim()).map((line) => frame(JSON.parse(line)))
  }
  finish(): void {
    this.pending += this.decoder.decode()
    if (this.pending.trim()) throw new Error('Redis MONITOR 帧未完整接收')
  }
}
export function redisMonitorRows(current: RedisMonitorRecord[], incoming: RedisMonitorRecord[]): RedisMonitorRecord[] {
  return [...current, ...incoming].slice(-REDIS_MONITOR_MAX_ROWS)
}
