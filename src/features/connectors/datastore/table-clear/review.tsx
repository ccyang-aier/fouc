import type { TableClearReview } from '@fouc/shared/table-clear'
import styles from './table-clear.module.css'

export function TableClearReviewContent({ review }: { review: TableClearReview }) {
  return <>
    <div className={styles.stats}>
      <div><small>当时可见行数</small><strong>{review.visibleRowCount}</strong><span>{new Date(review.countedAt).toLocaleTimeString()} · 当前角色 COUNT</span></div>
      <div><small>原生操作</small><strong>{review.operation === 'delete' ? 'DELETE' : 'TRUNCATE'}</strong><span>{review.transaction === 'atomic' ? '单事务执行' : '隐式提交 · 无法回滚'}</span></div>
      <div><small>Identity / Sequence</small><strong>{review.identity === 'preserved' ? '保留' : review.identity === 'reset' ? '重置' : '不适用'}</strong><span>依据当前原生字段</span></div>
    </div>
    <div className={styles.sectionTitle}><strong>完整受控 SQL</strong><span>仅当前目标 · 无 CASCADE</span></div>
    <pre className={styles.sql} aria-label="完整表清空 SQL">{review.sql}</pre>
    <div className={styles.permission}><span data-state={review.permission}>{review.permission === 'allowed' ? '权限已读取' : review.permission === 'denied' ? '权限不足' : '执行时原生验证'}</span><p>{review.permissionDetail}</p></div>
    <div className={styles.sectionTitle}><strong>引用与触发器</strong><span>{review.incomingReferences.length} 条引用 · {review.triggers.length} 个执行触发器</span></div>
    <p className={styles.caption}>{review.referenceCoverage}</p>
    {review.incomingReferences.length ? <div className={styles.dependencies}>{review.incomingReferences.map(item => <div key={JSON.stringify([item.schema, item.table, item.constraint])}><strong>{item.schema}.{item.table}</strong><code>{item.constraint}</code><span>{item.columns.join(', ')} → {item.referencedColumns.join(', ')} · {item.onDelete}</span></div>)}</div> : <p className={styles.empty}>当前读取范围内没有引用目标表的外键。</p>}
    {review.triggers.map(trigger => <details className={styles.trigger} key={trigger.name}><summary>{trigger.name} · {trigger.timing} {trigger.events.join(' / ')}</summary><pre>{trigger.definition}</pre></details>)}
    <div className={styles.warnings}><strong>影响审查</strong><ul>{review.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>
    {review.blockedReasons.length > 0 && <div className={styles.blocked} role="alert"><strong>当前计划不能执行</strong><ul>{review.blockedReasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
  </>
}
