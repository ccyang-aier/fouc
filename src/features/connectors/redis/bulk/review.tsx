import type { RedisBulkPreview, RedisBulkResult } from '@fouc/shared/redis-bulk'
import { expiryLabel, operationLabels, stateLabels } from './model'
import styles from './bulk.module.css'

export function RedisBulkReview({ preview }: { preview: RedisBulkPreview }) {
  const present = preview.keys.filter(key => key.type !== 'none').length
  return <section className={styles.review} aria-label="Redis 批量只读预览">
    <div className={styles.metrics}>
      <div><span>明确选择</span><strong>{preview.keys.length}<small> 个 Key</small></strong></div>
      <div><span>当前存在</span><strong>{present}<small> 个</small></strong></div>
      <div><span>将执行</span><b>{operationLabels[preview.operation.kind]}</b></div>
    </div>
    <div className={styles.tableScroll}>
      <table><thead><tr><th>Key / 类型</th><th>当前绝对期限</th><th>原始快照</th></tr></thead>
        <tbody>{preview.keys.map(key => <tr key={key.key.rawBase64}>
          <td><code title={`${key.key.display}\nBase64: ${key.key.rawBase64}`}>{key.key.display || '（空 Key）'}</code><small>{key.type}{key.key.encoding === 'binary' ? ' · 二进制 Key' : ''}</small></td>
          <td title={key.expiresAt}>{expiryLabel(key.expiresAt)}</td>
          <td><span>{key.dumpBytes.toLocaleString()} B</span><small title={`SHA-256 ${key.dumpSha256}`}>{key.dumpSha256.slice(0, 12)}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className={preview.dangerous ? styles.dangerNotice : styles.notice}>
      {preview.dangerous ? '此操作将删除当前存在的 Key，无法撤销。绝对期限已经过去时同样会立即删除。' : '提交将重新核对所有原始 DUMP、类型和绝对期限。外部修改或自然过期会阻止整个批次写入。'}
    </p>
    <details className={styles.boundary}><summary>原子边界与预览限制</summary>{preview.notes.map(note => <p key={note}>{note}</p>)}
      <p>预览有效至 {new Date(preview.expiresAt).toLocaleTimeString()}；解锁或重新锁定、切换数据库、断开连接均使旧计划失效。</p>
    </details>
  </section>
}

export function RedisBulkOutcome({ result }: { result: RedisBulkResult }) {
  const headline = result.state === 'complete' ? '批次执行已确认' : result.state === 'conflict' ? '检测到冲突 · 整批零写入' : result.state === 'unknown' ? '结果未确认 · 请刷新核对' : result.state === 'failed' ? '提交被拒绝 · 未开始写入' : '批次已停止 · 核对逐项结果'
  return <section className={styles.outcome} aria-label="Redis 批量操作结果" role="status">
    <strong>{headline}</strong>
    <p>已执行 {result.applied} · 无需更改 {result.unchanged} · 原本缺失 {result.missing} · 未确认 {result.unknown} · {result.executionTimeMs} ms</p>
    <div className={styles.tableScroll}><table><thead><tr><th>Key</th><th>实际结果</th><th>期限 / 原因</th></tr></thead>
      <tbody>{result.keys.map(key => <tr key={key.key.rawBase64}>
        <td><code title={key.key.display}>{key.key.display || '（空 Key）'}</code></td>
        <td data-state={key.state}>{stateLabels[key.state]}</td>
        <td><span>{expiryLabel(key.expiresAt)}</span>{key.reason && <small>{key.reason}</small>}</td>
      </tr>)}</tbody></table></div>
    {result.state !== 'complete' && <p className={styles.notice}>列表已请求刷新；已确认的写入不会回滚，未确认结果不会自动重试。需要继续时请重新选择并生成新的只读预览。</p>}
  </section>
}
