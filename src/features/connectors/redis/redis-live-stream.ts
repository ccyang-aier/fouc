"use client"
import { getBackendEndpoint } from '@/lib/backend'

/** A chunk can contain partial UTF-8 characters, partial frames or several frames. */
export class RedisNdjsonDecoder<T> {
  private readonly decoder = new TextDecoder()
  private pending = ''
  constructor(private readonly validate: (value: unknown) => T) {}
  feed(chunk: Uint8Array): T[] {
    this.pending += this.decoder.decode(chunk, { stream: true })
    if (this.pending.length > 4 * 1024 * 1024) throw new Error('Redis 实时响应帧超过传输上限')
    const lines = this.pending.split('\n'); this.pending = lines.pop()!
    return lines.filter((line) => line.trim()).map((line) => this.validate(JSON.parse(line)))
  }
  finish(): void { this.pending += this.decoder.decode(); if (this.pending.trim()) throw new Error('Redis 实时响应帧未完整接收') }
}
export async function readRedisFrames<T>(path: string, signal: AbortSignal, validate: (value: unknown) => T, onFrame: (frame: T) => void | Promise<void>): Promise<never> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    const endpoint = await getBackendEndpoint()
    const response = await fetch(`${endpoint.baseUrl}${path}`, { method: 'POST', signal, headers: {
      'content-type': 'application/json', ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}) }, body: '{}' })
    if (!response.ok) { const result = await response.json(); throw new Error(result.error?.message ?? `Redis 实时连接失败 (${response.status})`) }
    if (!response.body || !response.headers.get('content-type')?.startsWith('application/x-ndjson')) throw new Error('Redis 实时响应流不可用')
    reader = response.body.getReader()
    const decoder = new RedisNdjsonDecoder(validate)
    while (!signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) { decoder.finish(); throw new Error('Redis 实时连接已结束') }
      for (const frame of decoder.feed(chunk.value)) { if (signal.aborted) break; await onFrame(frame) }
    }
    throw new Error('Redis 实时读取已取消')
  } finally { await reader?.cancel().catch(() => {}); reader?.releaseLock() }
}
