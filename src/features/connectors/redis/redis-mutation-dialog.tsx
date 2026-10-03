"use client"

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X, ArrowLeft, FileCode, Plus, Trash } from '@phosphor-icons/react'
import { formatJsonSource, type RedisJsonCapability, type RedisMutation, type RedisMutationPreview, type RedisMutationResult } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { RedisByteField } from './redis-byte-field'
import { bytesToDraft, draftToBytes, redisMutationTitle, type RedisByteDraft, type RedisEditIntent } from './redis-mutation-model'
import common from '../datastore/relational.module.css'
import styles from './redis-editing.module.css'
import jsonStyles from './redis-json.module.css'
import { RedisJsonEditor } from './redis-json-editor'

type NewType = Extract<RedisMutation, { kind: 'create' }>['type']
type DraftFields = { field: RedisByteDraft; value: RedisByteDraft }[]
const empty = () => bytesToDraft('')

export function RedisMutationDialog({ base, intent, onClose, onSaved }: {
  base: string; intent: RedisEditIntent; onClose: () => void; onSaved: (result: RedisMutationResult) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const initial = intent.mutation
  const [newType, setNewType] = useState<NewType>(initial.kind === 'create' ? initial.type : 'string')
  const [key, setKey] = useState(() => bytesToDraft(initial.key))
  const [value, setValue] = useState(() => bytesToDraft('value' in initial ? initial.value : ''))
  const [field, setField] = useState(() => bytesToDraft('field' in initial ? initial.field : ''))
  const [member, setMember] = useState(() => bytesToDraft('member' in initial ? initial.member : ''))
  const [destination, setDestination] = useState(() => bytesToDraft('destination' in initial ? initial.destination : ''))
  const [score, setScore] = useState('score' in initial ? initial.score : '0')
  const [side, setSide] = useState<'left' | 'right'>('right')
  const [entryId, setEntryId] = useState('entryId' in initial ? initial.entryId : '*')
  const [fields, setFields] = useState<DraftFields>(() => 'fields' in initial ?
    initial.fields.map((item) => ({ field: bytesToDraft(item.field), value: bytesToDraft(item.value) })) : [{ field: empty(), value: empty() }])
  const [expiryMode, setExpiryMode] = useState<'persist' | 'relative' | 'absolute'>('relative')
  const [seconds, setSeconds] = useState('3600')
  const [date, setDate] = useState('')
  const [preview, setPreview] = useState<RedisMutationPreview | null>(null)
  const [busy, setBusy] = useState(initial.kind === 'json-set')
  const [error, setError] = useState('')
  const [json, setJson] = useState('json' in initial ? initial.json : '{}')
  const [jsonCapability, setJsonCapability] = useState<RedisJsonCapability | null>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const kind = initial.kind
  const type = kind === 'create' ? newType : kind.split('-')[0]
  const checkingJson = kind === 'create' && newType === 'json' && jsonCapability === null
  useEffect(() => {
    if (kind !== 'create' || newType !== 'json') return
    const controller = new AbortController()
    void backendFetch<RedisJsonCapability>(`${base}/json-capability`, { signal: controller.signal })
      .then((capability) => { if (!controller.signal.aborted) setJsonCapability(capability) })
      .catch((reason) => { if (!controller.signal.aborted) setJsonCapability({ available: null, reason: reason.message }) })
    return () => controller.abort()
  }, [base, kind, newType])
  useEffect(() => {
    if (initial.kind !== 'json-set') return
    const controller = new AbortController()
    void backendFetch<RedisMutationPreview>(`${base}/mutations/preview`, { method: 'POST', signal: controller.signal,
      body: JSON.stringify({ mutation: initial, writeVersion: intent.writeVersion }) })
      .then((result) => { if (!controller.signal.aborted) setPreview(result) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [base, initial, intent.writeVersion])
  const removing = kind === 'delete' || kind.endsWith('-remove')
  const rawFields = () => fields.map((item) => ({ field: draftToBytes(item.field), value: draftToBytes(item.value) }))
  function mutation(): RedisMutation {
    if (kind === 'create') {
      const rawKey = draftToBytes(key)
      switch (newType) {
        case 'json': return { kind, key: rawKey, type: 'json', json: formatJsonSource(json) }
        case 'string': case 'list': return { kind, key: rawKey, type: newType, value: draftToBytes(value) }
        case 'set': return { kind, key: rawKey, type: 'set', value: draftToBytes(member) }
        case 'hash': return { kind, key: rawKey, type: 'hash', field: draftToBytes(field), value: draftToBytes(value) }
        case 'zset': return { kind, key: rawKey, type: 'zset', member: draftToBytes(member), score }
        case 'stream': return { kind, key: rawKey, type: 'stream', entryId, fields: rawFields() }
      }
    }
    const rawKey = initial.key
    switch (kind) {
      case 'delete': case 'list-remove': case 'set-remove': case 'hash-remove': case 'zset-remove': case 'stream-remove': return initial
      case 'rename': return { kind, key: rawKey, destination: draftToBytes(destination) }
      case 'expiry': case 'hash-expiry': {
        const target = kind === 'hash-expiry' ? { kind, key: rawKey, field: initial.field } : { kind, key: rawKey }
        if (expiryMode === 'persist') return { ...target, mode: 'persist' }
        if (expiryMode === 'absolute') {
          const milliseconds = new Date(date).getTime()
          if (!Number.isFinite(milliseconds) || milliseconds <= Date.now()) throw new Error('请选择未来的过期时间。')
          return { ...target, mode: 'absolute', milliseconds: String(milliseconds) }
        }
        if (!/^[1-9]\d*$/.test(seconds)) throw new Error('TTL 秒数必须为正整数。')
        return { ...target, mode: 'relative', milliseconds: (BigInt(seconds) * 1000n).toString() }
      }
      case 'string-set': return { kind, key: rawKey, value: draftToBytes(value) }
      case 'json-set': return { kind, key: rawKey, json: formatJsonSource(json) }
      case 'list-push': return { kind, key: rawKey, side, value: draftToBytes(value) }
      case 'list-set': return { kind, key: rawKey, index: initial.index, value: draftToBytes(value) }
      case 'set-add': return { kind, key: rawKey, member: draftToBytes(member) }
      case 'hash-add': return { kind, key: rawKey, field: draftToBytes(field), value: draftToBytes(value) }
      case 'hash-set': return { kind, key: rawKey, field: initial.field, destination: draftToBytes(destination), value: draftToBytes(value) }
      case 'zset-add': return { kind, key: rawKey, member: draftToBytes(member), score }
      case 'zset-set': return { kind, key: rawKey, member: initial.member, destination: draftToBytes(destination), score }
      case 'stream-add': return { kind, key: rawKey, entryId, fields: rawFields() }
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || (type === 'json' && (checkingJson || jsonCapability?.available === false))) return
    setError('')
    setBusy(true)
    try {
      const result = await backendFetch<RedisMutationPreview>(`${base}/mutations/preview`, {
        method: 'POST', body: JSON.stringify({ mutation: mutation(), writeVersion: intent.writeVersion })
      })
      setPreview(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  async function commit() {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const result = await backendFetch<RedisMutationResult>(`${base}/mutations/commit`, {
        method: 'POST', body: JSON.stringify({ planId: preview.id, confirmed: true })
      })
      onSaved(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className={`${common.dialog} ${styles.dialog}`} aria-labelledby="redis-mutation-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={(event) => { if (preview) { event.preventDefault(); if (!busy && !error) void commit() } else void submit(event) }}>
      <header className={common.dialogHead}>
        <div><FileCode size={18} /><h2 id="redis-mutation-title">{preview ? '确认 Redis 变更' : redisMutationTitle(initial)}</h2></div>
        <button type="button" aria-label="关闭 Redis 变更" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      <div className={styles.body}>
        {preview ? <>
          <div className={styles.summary}><strong>{preview.key.display || '（空 Key）'}</strong><span>DB 会话中的单项变更</span></div>
          {preview.notes.map((note) => <p className={styles.hint} key={note}>{note}</p>)}
          {preview.commands.map((command, index) => <article className={styles.command} key={index}>
            <strong>{command.command}</strong>
            <ol>{command.arguments.map((argument, position) => <li key={position}>
              <span>{argument.encoding === 'binary' ? '二进制 · Base64' : 'UTF-8'}</span>
              <pre>{argument.encoding === 'binary' ? argument.rawBase64 : argument.display || '（零字节）'}</pre>
            </li>)}</ol>
          </article>)}
          <small className={styles.hint}>预览在 {new Date(preview.expiresAt).toLocaleTimeString()} 失效；确认后只执行一次。</small>
        </> : <>
          {kind === 'create' ? <>
            <RedisByteField label="Key" value={key} onChange={setKey} />
            <label className={styles.field}>数据类型<select aria-label="新 Key 类型" value={newType} onChange={(event) => { setNewType(event.target.value as NewType); setJsonCapability(null) }}>
              {(['string', 'list', 'set', 'hash', 'zset', 'stream', 'json'] as const).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
            </select></label>
          </> : <div className={styles.summary}><strong>{bytesToDraft(initial.key).text || '（空 Key）'}</strong>
            <span>{'index' in initial ? `List 索引 ${initial.index}` : 'entryId' in initial && removing ? `消息 ${initial.entryId}` : '保留原始 Key 字节'}</span></div>}
          {removing ? <p className={styles.danger}>确认后删除{kind === 'delete' ? '整个 Key 及其全部内容' : '所选项'}。请核对下一步的精确参数。</p> : <>
            {type === 'json' && <>
              {checkingJson && <p role="status" className={styles.hint}>正在确认 RedisJSON 命令…</p>}
              {jsonCapability?.reason && <p role="status" className={styles.hint}>{jsonCapability.reason}</p>}
              <div className={jsonStyles.creation}><RedisJsonEditor value={json} onChange={setJson} readOnly={busy} wrap onSave={() => { if (!busy && !checkingJson && jsonCapability?.available !== false) dialog.current?.querySelector('form')?.requestSubmit() }} label="RedisJSON 新建或修改文档" /></div>
              <p className={styles.hint}>完整 JSON 文档最多 1 MiB；原始数值不经过 JavaScript Number 转换。</p>
            </>}
            {kind === 'rename' && <RedisByteField label="新 Key" value={destination} onChange={setDestination} />}
            {(kind === 'expiry' || kind === 'hash-expiry') && <>
              {kind === 'hash-expiry' && <div className={styles.summary}><strong>{bytesToDraft(initial.field).text || '（空字段）'}</strong><span>只修改所选字段的期限；保留 Key TTL</span></div>}
              <label className={styles.field}>过期方式<select aria-label="过期方式" value={expiryMode} onChange={(event) => setExpiryMode(event.target.value as typeof expiryMode)}>
                <option value="relative">相对 TTL</option><option value="absolute">指定时间</option><option value="persist">永久</option>
              </select></label>
              {expiryMode === 'relative' && <label className={styles.field}>TTL 秒数<input aria-label="TTL 秒数" inputMode="numeric" value={seconds} onChange={(event) => setSeconds(event.target.value)} /></label>}
              {expiryMode === 'absolute' && <label className={styles.field}>本地过期时间<input aria-label="本地过期时间" type="datetime-local" step="1" value={date} onChange={(event) => setDate(event.target.value)} /></label>}
              <p className={styles.hint}>相对 TTL 从确认时起算；指定时间使用当前设备的本地时区。</p>
            </>}
            {type === 'hash' && kind !== 'hash-expiry' && <RedisByteField label={kind === 'hash-set' ? '字段名称' : '字段'} value={kind === 'hash-set' ? destination : field} onChange={kind === 'hash-set' ? setDestination : setField} />}
            {(type === 'set' || type === 'zset') && <RedisByteField label="成员" value={kind === 'zset-set' ? destination : member} onChange={kind === 'zset-set' ? setDestination : setMember} />}
            {type === 'zset' && <label className={styles.field}>分数<input aria-label="分数" value={score} spellCheck={false} onChange={(event) => setScore(event.target.value)} /></label>}
            {(type === 'string' || type === 'list' || (type === 'hash' && kind !== 'hash-expiry')) && <RedisByteField label="值" value={value} onChange={setValue} multiline />}
            {kind === 'list-push' && <label className={styles.field}>插入位置<select aria-label="插入位置" value={side} onChange={(event) => setSide(event.target.value as typeof side)}>
              <option value="right">尾部 RPUSH</option><option value="left">头部 LPUSH</option>
            </select></label>}
            {type === 'stream' && <>
              <label className={styles.field}>消息 ID<input aria-label="消息 ID" value={entryId} onChange={(event) => setEntryId(event.target.value)} /></label>
              <p className={styles.hint}>使用 * 自动生成，或输入两个 64 位整数构成的 ID。</p>
              {fields.map((item, index) => <div className={styles.streamField} key={index}>
                <RedisByteField label={`字段 ${index + 1}`} value={item.field} onChange={(next) => setFields((current) => current.map((entry, position) => position === index ? { ...entry, field: next } : entry))} />
                <RedisByteField label={`值 ${index + 1}`} value={item.value} onChange={(next) => setFields((current) => current.map((entry, position) => position === index ? { ...entry, value: next } : entry))} />
                <button type="button" aria-label={`移除字段 ${index + 1}`} disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, position) => position !== index))}><Trash size={15} /></button>
              </div>)}
              <button className={styles.addField} type="button" disabled={fields.length >= 100} onClick={() => setFields((current) => [...current, { field: empty(), value: empty() }])}><Plus size={14} />添加字段</button>
            </>}
          </>}
          {type !== 'json' && <p className={styles.hint}>编辑文本使用 UTF-8；二进制使用 Base64。当前单 Key 编辑上限为 1 MiB，List 索引上限为 9999。</p>}
        </>}
        {error && <p role="alert" className={common.error}>{error}</p>}
        {busy && <p role="status" className={styles.hint}>{preview ? '正在执行，请等待明确结果…' : '正在检查 Key 并生成预览…'}</p>}
      </div>
      <footer className={common.dialogFooter}>
        <button type="button" className={common.secondary} disabled={busy} onClick={() => { if (preview) { setPreview(null); setError('') } else onClose() }}>
          {preview ? <><ArrowLeft size={13} /> 返回编辑</> : '取消'}
        </button><span />
        <button type="submit" className={common.primary} disabled={busy || Boolean(preview && error) || (!preview && type === 'json' && (checkingJson || jsonCapability?.available === false))}>{busy ? '处理中…' : preview ? '确认执行' : '预览变更'}</button>
      </footer>
    </form>
  </dialog>
}
