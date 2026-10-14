'use client';
import { useTranslation } from '@/lib/i18n';
import type {
  MongoDocumentImportPreview,
  MongoDocumentImportStatus,
} from '@fouc/shared/mongo-document-transfer';
import { useMemo, useState } from 'react';
import { createUiMessages, uiText } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/document-transfer-import-review';
import styles from './transfer.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function MongoImportReview({
  preview,
  sourceLines,
}: {
  preview: MongoDocumentImportPreview;
  sourceLines?: number[];
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [sampleIndex, setSampleIndex] = useState(0);
  const sample = preview.samples[sampleIndex];
  const formattedSample = useMemo(
    () => (sample ? JSON.stringify(JSON.parse(sample), null, 2) : ''),
    [sample],
  );
  return (
    <div className={styles.review}>
      <div className={styles.metrics}>
        <div>
          <span>{tu('完整验证')}</span>
          <strong>
            {preview.documents.toLocaleString(locale)} <small>{tu('文档')}</small>
          </strong>
        </div>
        <div>
          <span>{tu('转换后大小')}</span>
          <strong>
            {(preview.bytes / 1024).toFixed(1)} <small>KiB</small>
          </strong>
        </div>
        <div>
          <span>{tu('新生成 _id')}</span>
          <strong>{preview.generatedIds.toLocaleString(locale)}</strong>
        </div>
      </div>
      <div className={styles.reviewColumns}>
        <div>
          <span className={styles.eyebrow}>{tu('实际字段类型 · 最多 50 个顶层字段')}</span>
          <div className={styles.fieldList}>
            {preview.fields.map((field) => (
              <div key={field.path}>
                <code>{field.path}</code>
                <span>{field.types.join(' / ')}</span>
                <small>
                  {field.present} / {preview.documents}
                </small>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className={styles.sampleLabel}>
            <span className={styles.eyebrow}>{tu('转换后文档 · 无截断')}</span>
            <select
              aria-label={tu('选择导入文档样本')}
              value={sampleIndex}
              onChange={(event) => setSampleIndex(Number(event.target.value))}
            >
              {preview.samples.map((_, index) => (
                <option key={index} value={index}>
                  {tu('样本')} {index + 1}
                  {sourceLines ? tu(' · 源行 {v0}', { v0: String(sourceLines[index]) }) : ''}
                </option>
              ))}
            </select>
          </label>
          <pre aria-label={tu('导入文档类型样本')}>{formattedSample}</pre>
          <small>
            {tu('已保存')} {preview.samples.length} {tu('个样本；预览验证全部')} {preview.documents}{' '}
            {tu('个文档。')}
          </small>
        </div>
      </div>
      {preview.warnings.map((warning) => (
        <p key={warning} className={styles.notice}>
          {uiText(warning, locale)}
        </p>
      ))}
    </div>
  );
}

const STATE_TEXT = {
  ready: '等待确认',
  running: '正在有序追加',
  complete: '追加完成',
  partial: '部分文档已成功',
  cancelled: '已停止后续批次',
  failed: '追加失败',
  unknown: '本批次结果尚无法确认',
} as const satisfies Record<MongoDocumentImportStatus['state'], keyof typeof unitMessages>;
export function MongoImportResult({
  status,
  sourceLines,
}: {
  status: MongoDocumentImportStatus;
  sourceLines?: number[];
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  return (
    <div className={styles.result} role="status">
      <strong>{uiText(uiMessage(STATE_TEXT[status.state]), locale)}</strong>
      <progress max={status.total} value={status.processed} aria-label={tu('文档追加进度')} />
      <p>
        {tu('已确认插入')} {status.inserted} / {status.total} {tu('个文档 · 已处理')}{' '}
        {status.processed} {tu('个')}
      </p>
      {status.error && (
        <p className={styles.error} role="alert">
          {status.error.row === null
            ? ''
            : tu('{v0}第 {v1} 个文档：', {
                v0: sourceLines ? tu('源物理行 {v0}，', { v0: sourceLines[status.error.row] }) : '',
                v1: String(status.error.row + 1),
              })}
          {uiText(status.error.message, locale)}
          {status.error.code !== null ? ` (${status.error.code})` : ''}
        </p>
      )}
      {!!status.uncertainDocuments && (
        <p className={styles.notice}>
          {tu('有')} {status.uncertainDocuments}{' '}
          {tu('个文档的写入结果无法确认。请核对目标集合，不要重复提交文件。')}
        </p>
      )}
      {status.state !== 'running' && status.inserted > 0 && status.state !== 'complete' && (
        <p className={styles.notice}>{tu('已经确认的写入仍保留在数据库中，未执行回滚。')}</p>
      )}
      {!!status.insertedIds.length && (
        <details>
          <summary>
            {tu('已确认插入的原生 ID (')}
            {status.insertedIds.length})
          </summary>
          <pre>
            {status.insertedIds.map((item) => `#${item.row + 1} ${item.idEjson}`).join('\n')}
          </pre>
        </details>
      )}
    </div>
  );
}
