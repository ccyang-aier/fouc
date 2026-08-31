/**
 * 相对时间格式化：探测/会话时间戳的统一人类可读表达。
 */

export function formatRelativeTime(ts: number | null | undefined): string {
  if (!ts) return "—"
  const diff = Date.now() - ts
  if (diff < 0) return "刚刚"
  if (diff < 60_000) return "1 分钟内"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(ts).toLocaleString("zh-CN", { hour12: false })
}
