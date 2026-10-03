import { expect, test } from 'bun:test'
import { RedisMonitorDecoder, isRedisMonitorCommand, redisMonitorRows } from './redis-monitor-model'

test('MONITOR detection does not permit extra arguments or command batches', () => {
  for (const command of ['monitor', ' MONITOR; ', 'MONITOR ;']) expect(isRedisMonitorCommand(command)).toBe(true)
  for (const command of ['MONITOR extra', 'MONITOR; FLUSHALL', 'MONITOR;;', 'PING']) expect(isRedisMonitorCommand(command)).toBe(false)
})
test('MONITOR decoder handles fragmented UTF-8 and multiple frames, rejecting corrupt or incomplete data', () => {
  const decoder = new RedisMonitorDecoder(), value = { type: 'rows', records: [{ sequence: 1, message: '消息', truncated: false }], dropped: 0 }
  const bytes = new TextEncoder().encode(JSON.stringify(value) + '\n' + JSON.stringify({ type: 'error', message: 'NOPERM' }) + '\n')
  const frames = []
  for (const byte of bytes) frames.push(...decoder.feed(new Uint8Array([byte])))
  decoder.finish(); expect(frames).toEqual([value, { type: 'error', message: 'NOPERM' }])
  expect(() => new RedisMonitorDecoder().feed(new TextEncoder().encode('{"type":"rows","records":[],"dropped":-1}\n'))).toThrow()
  const incomplete = new RedisMonitorDecoder(); incomplete.feed(new TextEncoder().encode('{"type":"ready"')); expect(() => incomplete.finish()).toThrow()
  expect(redisMonitorRows([], Array.from({ length: 1005 }, (_, index) => ({ sequence: index + 1, message: String(index), truncated: false })))[0]!.sequence).toBe(6)
})
