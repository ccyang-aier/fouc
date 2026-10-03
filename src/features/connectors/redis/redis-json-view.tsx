"use client"
import { useEffect, useMemo, useState } from 'react'
import { Copy, MagnifyingGlass, ArrowCounterClockwise, FloppyDisk } from '@phosphor-icons/react'
import { decodeJsonUnicodeEscapes, formatJsonSource, mapDisplayToRaw } from '@fouc/shared'
import { RedisJsonEditor } from './redis-json-editor'
import styles from './redis-json.module.css'

/** Display edits map back to source escapes; numbers are never rebuilt through JS Number. */
export function RedisJsonView({ content, editable, onPreview, onDraftChange }: { content: string; editable: boolean; onPreview: (json: string) => void; onDraftChange: (dirty: boolean) => void }) {
  const baseline = useMemo(() => formatJsonSource(content, 2), [content])
  const [raw, setRaw] = useState(baseline), [decoded, setDecoded] = useState(false), [draft, setDraft] = useState(baseline)
  const [wrap, setWrap] = useState(false), [search, setSearch] = useState(0), [feedback, setFeedback] = useState(''), [error, setError] = useState('')
  function rawDraft() { return decoded ? mapDisplayToRaw(raw, draft) : draft }
  const dirty = draft !== (decoded ? decodeJsonUnicodeEscapes(baseline) : baseline)
  useEffect(() => { onDraftChange(dirty && editable); return () => onDraftChange(false) }, [dirty, editable, onDraftChange])
  function mode(next: boolean) {
    const source = rawDraft(); setRaw(source); setDraft(next ? decodeJsonUnicodeEscapes(source) : source); setDecoded(next); setFeedback('')
  }
  function format(indent?: number) {
    try { const source = formatJsonSource(rawDraft(), indent); setRaw(source); setDraft(decoded ? decodeJsonUnicodeEscapes(source) : source); setError(''); setFeedback('已格式化，数值与转义保持原样') }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  function discard() { setRaw(baseline); setDraft(decoded ? decodeJsonUnicodeEscapes(baseline) : baseline); setError(''); setFeedback('已丢弃草稿修改') }
  function preview() {
    if (!editable || !dirty) return
    try { const source = formatJsonSource(rawDraft()); if (new TextEncoder().encode(source).length > 1048576) throw new Error('RedisJSON 写入文档最多 1 MiB'); setError(''); onPreview(source) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  async function copy() { try { await navigator.clipboard.writeText(draft); setFeedback(`已复制${decoded ? 'Unicode 显示' : '原始 JSON'}草稿`) } catch { setError('复制失败，请在编辑器中选择内容复制。') } }
  return <section className={styles.view} aria-label="RedisJSON 文档">
    <div className={styles.toolbar}><div role="tablist" aria-label="RedisJSON Unicode 显示"><button type="button" role="tab" aria-selected={!decoded} onClick={() => mode(false)}>原始转义</button><button type="button" role="tab" aria-selected={decoded} onClick={() => mode(true)}>Unicode 显示</button></div>
      <label><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />自动换行</label>
      <button type="button" onClick={() => format(2)}>格式化</button><button type="button" onClick={() => format()}>压缩</button>
      <button type="button" aria-label="搜索 RedisJSON 内容" onClick={() => setSearch((current) => current + 1)}><MagnifyingGlass size={14} /></button><button type="button" aria-label="复制 RedisJSON 草稿" onClick={() => void copy()}><Copy size={14} /></button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
    <RedisJsonEditor value={draft} onChange={(value) => { setDraft(value); setFeedback(''); setError('') }} readOnly={!editable} wrap={wrap} onSave={preview} searchRevision={search} />
    <footer><span>显示 {new TextEncoder().encode(draft).length.toLocaleString()} 字节 · {editable ? '⌘ / Ctrl+S 预览变更，确认后保存' : '只读文档'}{dirty && ' · 有未保存草稿'}</span>
      {dirty && <><button type="button" onClick={discard}><ArrowCounterClockwise size={13} />丢弃修改</button><button type="button" disabled={!editable} onClick={preview}><FloppyDisk size={13} />预览变更</button></>}</footer>
  </section>
}
