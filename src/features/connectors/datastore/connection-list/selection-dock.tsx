import { CheckCircle, SpinnerGap, Tag, Trash, X } from '@phosphor-icons/react'
import type { ConnectionBatchProgress, ConnectionBatchResult } from './batch'
import styles from './selection-dock.module.css'

const actionNames = { tags: '标签更新', delete: '删除', test: '连接测试' }

export function ConnectionSelectionDock({ count, progress, result, onTags, onTest, onDelete, onClear, onDismiss }: {
  count: number
  progress: ConnectionBatchProgress | null
  result: ConnectionBatchResult | null
  onTags: () => void
  onTest: () => void
  onDelete: () => void
  onClear: () => void
  onDismiss: () => void
}) {
  if (!count && !result && !progress) return null
  return <div className={styles.host}>
    <div className={styles.dock} role="region" aria-label="连接批量操作">
      {count > 0 && <>
        <strong className={styles.count}>已选 <b>{count}</b> 项</strong>
        <span className={styles.divider} aria-hidden />
        <div className={styles.actions} role="group" aria-label="批量操作">
          <button type="button" disabled={Boolean(progress)} onClick={onTags}><Tag size={17} weight="bold" />打标签</button>
          <button type="button" disabled={Boolean(progress)} onClick={onTest}><CheckCircle size={17} weight="bold" />测试连接</button>
          <button type="button" className={styles.danger} disabled={Boolean(progress)} onClick={onDelete}><Trash size={17} weight="bold" />删除</button>
        </div>
        <button type="button" className={styles.close} aria-label="清除连接选择" title="清除选择" disabled={Boolean(progress)} onClick={onClear}><X size={15} weight="bold" /></button>
      </>}
      <div className={styles.feedback} aria-live="polite" aria-atomic="true">
        {progress ? <span><SpinnerGap className={styles.spinner} size={15} />{actionNames[progress.action]} {progress.completed} / {progress.total}</span>
          : result && <>
            <span data-failed={result.failed.length > 0}>{actionNames[result.action]}完成 · {result.succeeded.length} 成功{result.failed.length > 0 && ` · ${result.failed.length} 失败`}</span>
            {result.failed.length > 0 && <details><summary>查看失败</summary><ul>{result.failed.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.message}</span></li>)}</ul></details>}
            <button type="button" className={styles.close} aria-label="关闭批量操作结果" onClick={onDismiss}><X size={14} /></button>
          </>}
      </div>
    </div>
  </div>
}
