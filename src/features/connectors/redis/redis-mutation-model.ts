import type { RedisMutation } from '@fouc/shared'

export type RedisByteDraft = { encoding: 'text' | 'base64'; text: string }
export type RedisEditIntent = { mutation: RedisMutation; writeVersion: string | null }
export function bytesToDraft(raw: string): RedisByteDraft {
  const bytes = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0))
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('binary')
    return { encoding: 'text', text }
  } catch { return { encoding: 'base64', text: raw } }
}
export function draftToBytes(draft: RedisByteDraft): string {
  if (draft.encoding === 'base64') {
    try {
      if (btoa(atob(draft.text)) !== draft.text) throw new Error('noncanonical')
      return draft.text
    } catch { throw new Error('请输入规范 Base64，空内容表示零字节。') }
  }
  const bytes = new TextEncoder().encode(draft.text)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  return btoa(binary)
}
export function redisMutationTitle(mutation: RedisMutation): string {
  const titles: Record<RedisMutation['kind'], string> = {
    create: '新建 Redis Key', delete: '删除 Redis Key', rename: '重命名 Redis Key', expiry: '设置过期时间',
    'string-set': '编辑 String', 'list-push': '添加 List 元素', 'list-set': '编辑 List 元素', 'list-remove': '删除 List 元素',
    'set-add': '添加 Set 成员', 'set-remove': '删除 Set 成员', 'hash-add': '添加 Hash 字段', 'hash-set': '编辑 Hash 字段',
    'hash-remove': '删除 Hash 字段', 'zset-add': '添加 ZSet 成员', 'zset-set': '编辑 ZSet 成员',
    'zset-remove': '删除 ZSet 成员', 'stream-add': '添加 Stream 消息', 'stream-remove': '删除 Stream 消息'
  }
  return titles[mutation.kind]
}
