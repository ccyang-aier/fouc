/** Exact durations without converting potentially 64-bit milliseconds to Number. */
export function redisStreamDuration(value: string | null): string {
  if (value === null) return '未知'
  const milliseconds = BigInt(value)
  if (milliseconds < 1000n) return `${milliseconds} ms`
  const seconds = milliseconds / 1000n
  if (seconds < 60n) return `${seconds}.${String(milliseconds % 1000n).padStart(3, '0')} s`
  if (seconds < 3600n) return `${seconds / 60n} 分 ${seconds % 60n} 秒`
  if (seconds < 86400n) return `${seconds / 3600n} 时 ${seconds % 3600n / 60n} 分`
  return `${seconds / 86400n} 天 ${seconds % 86400n / 3600n} 时`
}
