import { useMemo, useState } from 'react';
import type { MongoDocumentImportPreview, MongoDocumentImportStatus } from '@fouc/shared/mongo-document-transfer';
import styles from './transfer.module.css';

export function MongoImportReview({ preview }: { preview: MongoDocumentImportPreview }) {
  const [sampleIndex, setSampleIndex] = useState(0);
  const sample = preview.samples[sampleIndex];
  const formattedSample = useMemo(() => sample ? JSON.stringify(JSON.parse(sample), null, 2) : '', [sample]);
  return <div className={styles.review}>
    <div className={styles.metrics}><div><span>完整验证</span><strong>{preview.documents.toLocaleString()} <small>文档</small></strong></div><div><span>转换后大小</span><strong>{(preview.bytes / 1024).toFixed(1)} <small>KiB</small></strong></div><div><span>新生成 _id</span><strong>{preview.generatedIds.toLocaleString()}</strong></div></div>
    <div className={styles.reviewColumns}>
      <div><span className={styles.eyebrow}>实际字段类型 · 最多 50 个顶层字段</span><div className={styles.fieldList}>{preview.fields.map(field => <div key={field.path}><code>{field.path}</code><span>{field.types.join(' / ')}</span><small>{field.present} / {preview.documents}</small></div>)}</div></div>
      <div><label className={styles.sampleLabel}><span className={styles.eyebrow}>转换后文档 · 无截断</span><select aria-label="选择导入文档样本" value={sampleIndex} onChange={event => setSampleIndex(Number(event.target.value))}>{preview.samples.map((_, index) => <option key={index} value={index}>样本 {index + 1}</option>)}</select></label><pre aria-label="导入文档类型样本">{formattedSample}</pre><small>已保存 {preview.samples.length} 个样本；预览验证全部 {preview.documents} 个文档。</small></div>
    </div>
    {preview.warnings.map(warning => <p key={warning} className={styles.notice}>{warning}</p>)}
  </div>;
}

const STATE_TEXT: Record<MongoDocumentImportStatus['state'], string> = {
  ready: '等待确认', running: '正在有序追加', complete: '追加完成', partial: '部分文档已成功',
  cancelled: '已停止后续批次', failed: '追加失败', unknown: '本批次结果尚无法确认',
};
export function MongoImportResult({ status }: { status: MongoDocumentImportStatus }) {
  return <div className={styles.result} role="status">
    <strong>{STATE_TEXT[status.state]}</strong>
    <progress max={status.total} value={status.processed} aria-label="文档追加进度" />
    <p>已确认插入 {status.inserted} / {status.total} 个文档 · 已处理 {status.processed} 个</p>
    {status.error && <p className={styles.error} role="alert">{status.error.row === null ? '' : `第 ${status.error.row + 1} 个文档：`}{status.error.message}{status.error.code !== null ? ` (${status.error.code})` : ''}</p>}
    {!!status.uncertainDocuments && <p className={styles.notice}>有 {status.uncertainDocuments} 个文档的写入结果无法确认。请核对目标集合，不要重复提交文件。</p>}
    {status.state !== 'running' && status.inserted > 0 && status.state !== 'complete' && <p className={styles.notice}>已经确认的写入仍保留在数据库中，未执行回滚。</p>}
    {!!status.insertedIds.length && <details><summary>已确认插入的原生 ID ({status.insertedIds.length})</summary><pre>{status.insertedIds.map(item => `#${item.row + 1} ${item.idEjson}`).join('\n')}</pre></details>}
  </div>;
}
