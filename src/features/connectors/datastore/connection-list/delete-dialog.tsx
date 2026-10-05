import { SqlDialog } from '../sql-library-dialog'
import type { SavedDatastoreConnection } from './provider-model'
import common from '../relational.module.css'
import styles from './batch-dialog.module.css'

export function ConnectionDeleteDialog({ connections, busy, error, onDelete, onClose }: {
  connections: readonly SavedDatastoreConnection[]
  busy: boolean
  error?: string
  onDelete: () => void
  onClose: () => void
}) {
  return <SqlDialog title={connections.length === 1 ? '删除连接' : `删除 ${connections.length} 个连接`} role="alertdialog" busy={busy} onClose={onClose} className={styles.dialog}>
    <div className={styles.body}><ul className={styles.names}>{connections.map(connection => <li key={connection.id}>{connection.name}</li>)}</ul><p className={styles.note}>仅删除连接配置，数据库及其内容不受影响。</p>{error && <p className={styles.error} role="alert">{error}</p>}</div>
    <footer className={`${common.dialogFooter} ${styles.footer}`}><button type="button" className={common.secondary} disabled={busy} onClick={onClose}>取消</button><button type="button" className={common.danger} disabled={busy} onClick={onDelete}>{busy ? '删除中…' : '确认删除'}</button></footer>
  </SqlDialog>
}
