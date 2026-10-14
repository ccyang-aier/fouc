import { expect, test } from 'bun:test';
import { redisStreamDuration } from './redis-stream-model';

test('Stream idle durations retain exact milliseconds and distinguish unknown from zero', () => {
  expect(redisStreamDuration(null)).toBe('未知');
  expect(redisStreamDuration('0')).toBe('0 ms');
  expect(redisStreamDuration('1001')).toBe('1.001 s');
  expect(redisStreamDuration('61000')).toBe('1 分 1 秒');
  expect(redisStreamDuration('3661000')).toBe('1 时 1 分');
  expect(redisStreamDuration('9007199254740993')).toBe('104249991 天 8 时');
});
