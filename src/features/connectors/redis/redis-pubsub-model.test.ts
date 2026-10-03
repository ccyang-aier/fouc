import { expect, test } from 'bun:test'
import type { RedisPubSubMessage } from '@fouc/shared'
import { RedisNdjsonDecoder } from './redis-live-stream'
import { redisPubSubFrame, redisPubSubMessages, redisPubSubSearch } from './redis-pubsub-model'

const captureId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const blob = (display: string) => ({ display, rawBase64: Buffer.from(display).toString('base64'), encoding: 'utf8' as const, byteLength: Buffer.byteLength(display), truncated: false })
const entry = (sequence: number): RedisPubSubMessage => ({ captureId, sequence, receivedAt: 1700000000000, channel: blob('频道'), payload: blob('消息'), pattern: null })

test('Pub/Sub fragmented frames preserve Chinese text and reject malformed records and incomplete streams', () => {
  const value = { type: 'messages', entries: [entry(1)], dropped: 0 }, decoder = new RedisNdjsonDecoder(redisPubSubFrame)
  const frames = []
  for (const byte of new TextEncoder().encode(JSON.stringify(value) + '\n')) frames.push(...decoder.feed(new Uint8Array([byte])))
  decoder.finish(); expect(frames).toEqual([value])
  for (const invalid of [{ ...value, dropped: -1 }, { ...value, entries: [{ ...entry(1), captureId: 'other' }] }, { ...value, entries: [{ ...entry(1), payload: { ...blob(''), byteLength: -1 } }] }])
    expect(() => redisPubSubFrame(invalid)).toThrow()
  const broken = new RedisNdjsonDecoder(redisPubSubFrame); broken.feed(new TextEncoder().encode('{"type":')); expect(() => broken.finish()).toThrow()
})

test('Channel and pattern deliveries and restarted capture sequences remain distinct within count and byte caps', () => {
  const duplicate = { ...entry(2), pattern: blob('*') }, restart = { ...entry(1), captureId: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee' }
  expect(redisPubSubMessages([entry(1)], [duplicate, restart])).toEqual([entry(1), duplicate, restart])
  const retained = redisPubSubMessages([], Array.from({ length: 510 }, (_, index) => entry(index + 1)))
  expect(retained).toHaveLength(500); expect(retained[0]!.sequence).toBe(11)
  const large = Array.from({ length: 100 }, (_, index) => ({ ...entry(index + 1), payload: blob('中'.repeat(20000)) }))
  const bounded = redisPubSubMessages([], large)
  expect(bounded.length).toBeLessThan(100); expect(bounded.at(-1)!.sequence).toBe(100)
  expect(bounded.reduce((size, record) => size + Buffer.byteLength(JSON.stringify(record)) + 1, 0)).toBeLessThanOrEqual(2 * 1024 * 1024)
  expect(redisPubSubSearch(duplicate, '频道')).toBe(true); expect(redisPubSubSearch(duplicate, 'Kg==')).toBe(true)
  expect(redisPubSubSearch(duplicate, 'absent')).toBe(false)
})
