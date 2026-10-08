'use client'

import { useState, type FormEvent } from 'react'
import type { RelationalConnectionConfig } from '@fouc/shared'
import { resolveConnectionOptions, type DatabaseConnectionOptionsInput } from '@fouc/shared/connection-options'
import { ConnectionOptionsFields } from './connection-options/connection-options-fields'
import { SqlDialog } from './sql-library-dialog'
import common from './relational.module.css'
import styles from './connection-options/connection-dialog.module.css'

/** A transfer target needs credentials, without editing its saved connection profile. */
export function RelationalAccessDialog({ name, config, onClose, onConnect }: {
  name: string
  config: Exclude<RelationalConnectionConfig, { provider: 'sqlite' }>
  onClose: () => void
  onConnect: (password: string, options: DatabaseConnectionOptionsInput) => Promise<void>
}) {
  const [password, setPassword] = useState(''), [options, setOptions] = useState<DatabaseConnectionOptionsInput>(config.connectionOptions)
  const [valid, setValid] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !valid) return
    setBusy(true); setError('')
    try { await onConnect(password, resolveConnectionOptions(config.provider, options)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '连接目标失败') }
    finally { setBusy(false) }
  }
  return <SqlDialog title={`连接传输目标 · ${name}`} className={styles.dialog} busy={busy} onClose={onClose}>
    <form className={styles.form} onSubmit={event => { void submit(event) }} onChange={() => setError('')}>
      <div className={styles.body}>
        <p className={common.hint}>{config.host}:{config.port} · {config.database} · {config.username}</p>
        <label>连接密码<input type="password" autoFocus autoComplete="off" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
        <ConnectionOptionsFields provider={config.provider} value={options} onChange={setOptions} disabled={busy} onValidityChange={setValid} />
        {error && <p className={common.connectionError} role="alert">{error}</p>}
      </div>
      <footer className={common.dialogFooter}>
        <button type="button" className={`fouc-action ${common.secondary}`} onClick={onClose} disabled={busy}>取消</button>
        <button type="submit" className={common.primary} disabled={busy || !valid}>{busy ? '连接中…' : '连接目标'}</button>
      </footer>
    </form>
  </SqlDialog>
}
