'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import type { MongoConnectionConfig, MongoSavedConnection } from '@fouc/shared/mongo-connections'
import type { MongoSession } from '@fouc/shared/mongo'
import { backendFetch } from '@/lib/backend'
import { SqlDialog } from '../datastore/sql-library-dialog'
import styles from '../datastore/relational.module.css'
import formStyles from './mongo-dialog.module.css'

export function MongoDialog({ workspaceId, connection, intent, onClose, onSave, onConnect }: {
  workspaceId: string; connection?: MongoSavedConnection; intent: 'save' | 'connect'; onClose: () => void;
  onSave: (name: string, config: MongoConnectionConfig) => Promise<void>; onConnect: (password: string) => Promise<void>
}) {
  const previous = connection?.config
  const [name, setName] = useState(connection?.name ?? '')
  const [config, setConfig] = useState<MongoConnectionConfig>(previous ?? { provider: 'mongodb', host: '127.0.0.1', port: 27017, username: '', database: 'admin', authSource: 'admin', tls: false })
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState('')
  function update<K extends keyof MongoConnectionConfig>(key: K, value: MongoConnectionConfig[K]) { setConfig(current => ({ ...current, [key]: value })); setFeedback('') }
  async function perform(test = false) {
    setBusy(true); setError(''); setFeedback('')
    try {
      if (test) {
        const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/mongo/sessions`
        const session = await backendFetch<MongoSession>(base, { method: 'POST', body: JSON.stringify({ ...config, password }) })
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' })
        setFeedback(`连接成功 · MongoDB ${session.version ?? '版本未知'} · ${session.database}`)
      } else if (intent === 'connect') await onConnect(password)
      else await onSave(name, config)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '连接操作失败') }
    finally { setBusy(false) }
  }
  function submit(event: FormEvent) { event.preventDefault(); void perform() }
  return <SqlDialog title={intent === 'connect' ? `打开 ${connection?.name}` : connection ? '编辑 MongoDB 连接' : '新建 MongoDB 连接'} busy={busy} className={formStyles.dialog} onClose={onClose}>
    <form className={formStyles.form} onSubmit={submit}>
      <div className={`${styles.formBody} ${formStyles.body}`}>
        {intent === 'save' ? <>
          <label>连接名称<input required autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
          <div className={styles.formColumns}><label>主机<input required value={config.host} onChange={event => update('host', event.target.value)} disabled={busy} /></label><label>端口<input required type="number" min={1} max={65535} value={config.port} onChange={event => update('port', Number(event.target.value))} disabled={busy} /></label></div>
          <div className={formStyles.columns}><label>用户名<input value={config.username} autoComplete="username" onChange={event => update('username', event.target.value)} disabled={busy} /></label><label>初始数据库<input required value={config.database} onChange={event => update('database', event.target.value)} disabled={busy} /></label></div>
          <label>认证数据库<input required value={config.authSource} onChange={event => update('authSource', event.target.value)} disabled={busy} /></label>
          <label className={styles.checkbox}><input type="checkbox" checked={config.tls} onChange={event => update('tls', event.target.checked)} disabled={busy} />启用 TLS 并验证服务器证书</label>
        </> : <p className={styles.hint}>{config.host}:{config.port} · {config.database} · {config.username || '无用户名'}</p>}
        <label>连接密码<input aria-label="连接密码" type="password" autoFocus={intent === 'connect'} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setFeedback('') }} disabled={busy} /><small>密码仅用于本次连接，不保存到连接配置。</small></label>
        {error && <p className={styles.connectionError} role="alert">{error}</p>}
        {feedback && <p className={styles.success} role="status"><CheckCircle size={16} />{feedback}</p>}
      </div>
      <footer className={styles.dialogFooter}><button type="button" className={styles.secondary} disabled={busy} onClick={() => void perform(true)}>测试连接</button><span /><button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>取消</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? '处理中…' : intent === 'connect' ? '打开工作台' : '保存连接'}</button></footer>
    </form>
  </SqlDialog>
}
