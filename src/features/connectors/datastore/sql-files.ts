import { SQL_FILE_MAX_BYTES } from '@fouc/shared'

export type SqlFileEncoding = 'auto' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030'
export type OpenSqlFile = { name: string; sql: string; encoding: Exclude<SqlFileEncoding, 'auto'>; sourceBytes: number }

/** DBX's browser SQL-file workflow, with explicit decoding and Fouc document limits. */
export function isSqlFilePath(path: string): boolean { return /\.sql$/i.test(path.trim()) }
export function sqlFileTitleFromPath(path: string): string { return path.trim().replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || 'script.sql' }
export class ExternalSqlFileTooLargeError extends Error {
  constructor(readonly sizeBytes: number, readonly maxSizeBytes: number) {
    super(`SQL 文件 ${formatSqlFileSize(sizeBytes)} 超过 ${formatSqlFileSize(maxSizeBytes)} 上限。`)
    this.name = 'ExternalSqlFileTooLargeError'
  }
}
export function formatSqlFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes / 1024, index = 0
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++ }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[index]}`
}
export function decodeSqlFile(bytes: Uint8Array, requested: SqlFileEncoding = 'auto'): { sql: string; encoding: OpenSqlFile['encoding'] } {
  const encoding = requested !== 'auto' ? requested : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8'
  let sql: string
  try { sql = new TextDecoder(encoding, { fatal: true }).decode(bytes) }
  catch { throw new Error(`文件无法按 ${encoding.toUpperCase()} 解码。请选择原始文件编码后重试。`) }
  if (sql.includes('\0')) throw new Error('文件包含 NUL 字节，请核对编码或选择文本 SQL 文件。')
  const size = new TextEncoder().encode(sql).byteLength
  if (size > SQL_FILE_MAX_BYTES) throw new ExternalSqlFileTooLargeError(size, SQL_FILE_MAX_BYTES)
  return { sql, encoding }
}
export async function readBrowserSqlFile(file: File, encoding: SqlFileEncoding, signal: AbortSignal): Promise<OpenSqlFile> {
  if (!isSqlFilePath(file.name)) throw new Error(`请选择 .sql 文件：${file.name}`)
  if (file.size > SQL_FILE_MAX_BYTES) throw new ExternalSqlFileTooLargeError(file.size, SQL_FILE_MAX_BYTES)
  if (signal.aborted) throw new DOMException('SQL 文件读取已取消', 'AbortError')
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => reader.abort()
    const cleanup = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    reader.onload = () => { cleanup(); if (reader.result instanceof ArrayBuffer) resolve(reader.result); else reject(new Error('SQL 文件读取失败')) }
    reader.onerror = () => { cleanup(); reject(reader.error ?? new Error('SQL 文件读取失败')) }
    reader.onabort = () => { cleanup(); reject(new DOMException('SQL 文件读取已取消', 'AbortError')) }
    reader.readAsArrayBuffer(file)
  })
  if (signal.aborted) throw new DOMException('SQL 文件读取已取消', 'AbortError')
  return { name: sqlFileTitleFromPath(file.name), ...decodeSqlFile(new Uint8Array(bytes), encoding), sourceBytes: file.size }
}
export function downloadSqlFile(sql: string, title: string): void {
  const name = sqlFileTitleFromPath(title).replace(/[<>:"|?*\u0000-\u001f]/g, '_')
  const url = URL.createObjectURL(new Blob([sql], { type: 'application/sql;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = isSqlFilePath(name) ? name : name + '.sql'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
