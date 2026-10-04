'use client'

import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { TableClearCommitResult } from '@fouc/shared/table-clear'
import styles from './table-clear.module.css'

export function TableClearResultContent({ result }: { result: TableClearCommitResult }) {
  const cleared = result.outcome === 'cleared'
  const title = cleared ? '原生清空已确认' : result.outcome === 'unknown' ? '提交结果未确认' : '清空未提交'

  return (
    <div className={`${styles.result} ${cleared ? styles.success : styles.blocked}`} role={cleared ? 'status' : 'alert'}>
      {cleared ? <CheckCircle size={22} /> : <Warning size={22} />}
      <div>
        <strong>{title}</strong>
        <p>{result.message}</p>
        {result.affectedRows !== null && <small>原生 DELETE 影响 {result.affectedRows} 行 · </small>}
        <small>{result.executionTimeMs.toFixed(0)} ms</small>
      </div>
    </div>
  )
}
