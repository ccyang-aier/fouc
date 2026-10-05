export type ConnectionBatchAction = 'tags' | 'delete' | 'test'
export type ConnectionBatchProgress = { action: ConnectionBatchAction; completed: number; total: number }
export type ConnectionBatchResult = ConnectionBatchProgress & {
  succeeded: string[]
  failed: { id: string; name: string; message: string }[]
  stopped: boolean
}

/** Additive tagging never overwrites another connection's existing tags. */
export function appendConnectionTags(current: readonly string[], added: readonly string[]) {
  const tags = [...new Set([...current, ...added].map(tag => tag.trim()).filter(Boolean))]
  if (tags.length > 12) throw new Error('最多添加 12 个标签')
  if (tags.some(tag => tag.length > 32)) throw new Error('每个标签最多 32 个字符')
  return tags
}

/** Sequential native requests bound connection pressure and report every actual outcome. */
export async function runConnectionBatch<T extends { id: string; name: string }>(items: readonly T[], action: ConnectionBatchAction,
  perform: (item: T) => Promise<unknown>, onProgress: (progress: ConnectionBatchProgress) => void, isActive: () => boolean) {
  const result: ConnectionBatchResult = { action, completed: 0, total: items.length, succeeded: [], failed: [], stopped: false }
  for (const item of items) {
    if (!isActive()) { result.stopped = true; break }
    try { await perform(item); result.succeeded.push(item.id) }
    catch (error) { result.failed.push({ id: item.id, name: item.name, message: error instanceof Error ? error.message : '操作失败' }) }
    result.completed++
    if (isActive()) onProgress({ action, completed: result.completed, total: result.total })
  }
  return result
}
