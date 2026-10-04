import type { RedisBulkOperation, RedisBulkKeyState } from '@fouc/shared/redis-bulk'

export const operationLabels: Record<RedisBulkOperation['kind'], string> = {
  'relative-ttl': '设置相对 TTL',
  'absolute-ttl': '设置绝对期限',
  persist: '永久保留 · PERSIST',
  delete: '删除 Key · DEL',
}

export const stateLabels: Record<RedisBulkKeyState, string> = {
  applied: '已执行', unchanged: '无需更改', missing: '原本缺失', conflict: '冲突',
  failed: '执行失败', skipped: '未执行', unknown: '结果未确认',
}

export function bulkOperation(kind: RedisBulkOperation['kind'], seconds: string, deadline: string): RedisBulkOperation {
  if (kind === 'delete' || kind === 'persist') return { kind }
  if (kind === 'absolute-ttl') {
    const milliseconds = new Date(deadline).getTime()
    if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) throw new Error('请选择有效的本地绝对过期时间')
    return { kind, milliseconds: String(milliseconds) }
  }
  if (!/^[1-9]\d{0,12}$/.test(seconds)) throw new Error('TTL 请输入正整数秒；永久保留请明确选择 PERSIST')
  const milliseconds = BigInt(seconds) * 1000n
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('TTL 超出精确时间范围')
  return { kind, milliseconds: String(milliseconds) }
}

export function expiryLabel(value: string | null): string {
  if (value === '-1') return '永久'
  if (value === '-2') return '不存在'
  if (value === null) return '未确认'
  const date = new Date(Number(value))
  return Number.isNaN(date.getTime()) ? `${value} ms` : date.toLocaleString(undefined, { hour12: false })
}
