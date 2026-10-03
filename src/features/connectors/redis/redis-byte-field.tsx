"use client"

import { useState } from 'react'
import { bytesToDraft, draftToBytes, type RedisByteDraft } from './redis-mutation-model'
import styles from './redis-editing.module.css'

export function RedisByteField({ label, value, onChange, multiline = false }: {
  label: string; value: RedisByteDraft; onChange: (value: RedisByteDraft) => void; multiline?: boolean
}) {
  const [error, setError] = useState('')
  function changeEncoding(encoding: RedisByteDraft['encoding']) {
    try {
      const raw = draftToBytes(value)
      const converted = bytesToDraft(raw)
      if (encoding === 'text' && converted.encoding !== 'text') throw new Error('此值包含二进制字节，请使用 Base64 编辑。')
      onChange(encoding === 'base64' ? { encoding, text: raw } : converted)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  return <div className={styles.byteField}>
    <div className={styles.fieldHead}>
      <span>{label}</span>
      <select aria-label={`${label}编码`} value={value.encoding} onChange={(event) => changeEncoding(event.target.value as RedisByteDraft['encoding'])}>
        <option value="text">UTF-8 文本</option><option value="base64">Base64 字节</option>
      </select>
    </div>
    {multiline ? <textarea aria-label={label} rows={8} value={value.text} spellCheck={false}
      onChange={(event) => { setError(''); onChange({ ...value, text: event.target.value }) }} /> :
      <input aria-label={label} value={value.text} spellCheck={false}
        onChange={(event) => { setError(''); onChange({ ...value, text: event.target.value }) }} />}
    {error && <small role="alert" className={styles.error}>{error}</small>}
  </div>
}
