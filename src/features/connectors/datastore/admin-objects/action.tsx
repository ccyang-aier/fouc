'use client'

import { useState } from 'react'
import { Clock } from '@phosphor-icons/react/dist/csr/Clock'
import { Package } from '@phosphor-icons/react/dist/csr/Package'
import type { RelationalSession } from '@fouc/shared'
import { SqlDialog } from '../sql-library-dialog'
import { DatabaseAdminObjectsPanel } from './panel'
import styles from './admin-objects.module.css'

export function DatabaseAdminObjectsAction({ base, session, schema, disabled }: {
  base: string; session: RelationalSession; schema: string; disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  if (session.provider === 'sqlite') return null
  const mysql = session.provider === 'mysql'
  const title = mysql ? 'MySQL 事件目录' : 'PostgreSQL 扩展目录'
  return <>
    <button type="button" className={`${styles.trigger} fouc-action`} data-surface="subtle" aria-label={`打开${title}`} disabled={disabled || mysql && !schema} onClick={() => setOpen(true)}>
      {mysql ? <Clock size={14} /> : <Package size={14} />}<span>{mysql ? '事件' : '扩展'}</span>
    </button>
    {open && <SqlDialog title={title} className={styles.dialog} onClose={() => setOpen(false)}>
      <DatabaseAdminObjectsPanel base={base} session={session} schema={schema} />
      <footer className={styles.dialogFooter}><span>当前连接 · 只读原生目录</span><button type="button" onClick={() => setOpen(false)}>关闭</button></footer>
    </SqlDialog>}
  </>
}
