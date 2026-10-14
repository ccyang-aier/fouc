'use client';
import { useTranslation } from '@/lib/i18n';
import type { RedisBulkPreview, RedisBulkResult } from '@fouc/shared/redis-bulk';
import { createUiMessages, uiText, type UiMessage } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/bulk-review';
import styles from './bulk.module.css';
import { expiryLabel, operationLabels, stateLabels } from './model';
const { message: uiMessage } = createUiMessages(unitMessages);

export function RedisBulkReview({ preview }: { preview: RedisBulkPreview }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const present = preview.keys.filter((key) => key.type !== 'none').length;
  return (
    <section className={styles.review} aria-label={tu('Redis 批量只读预览')}>
      <div className={styles.metrics}>
        <div>
          <span>{tu('明确选择')}</span>
          <strong>
            {preview.keys.length}
            <small> {tu('个 Key')}</small>
          </strong>
        </div>
        <div>
          <span>{tu('当前存在')}</span>
          <strong>
            {present}
            <small> {tu('个')}</small>
          </strong>
        </div>
        <div>
          <span>{tu('将执行')}</span>
          <b>{uiText(operationLabels[preview.operation.kind], locale)}</b>
        </div>
      </div>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th>{tu('Key / 类型')}</th>
              <th>{tu('当前绝对期限')}</th>
              <th>{tu('原始快照')}</th>
            </tr>
          </thead>
          <tbody>
            {preview.keys.map((key) => (
              <tr key={key.key.rawBase64}>
                <td>
                  <code title={`${key.key.display}\nBase64: ${key.key.rawBase64}`}>
                    {key.key.display || tu('（空 Key）')}
                  </code>
                  <small>
                    {key.type}
                    {key.key.encoding === 'binary' ? tu(' · 二进制 Key') : ''}
                  </small>
                </td>
                <td title={key.expiresAt}>{expiryLabel(key.expiresAt, locale)}</td>
                <td>
                  <span>{key.dumpBytes.toLocaleString(locale)} B</span>
                  <small title={`SHA-256 ${key.dumpSha256}`}>{key.dumpSha256.slice(0, 12)}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={preview.dangerous ? styles.dangerNotice : styles.notice}>
        {preview.dangerous
          ? tu('此操作将删除当前存在的 Key，无法撤销。绝对期限已经过去时同样会立即删除。')
          : tu(
              '提交将重新核对所有原始 DUMP、类型和绝对期限。外部修改或自然过期会阻止整个批次写入。',
            )}
      </p>
      <details className={styles.boundary}>
        <summary>{tu('原子边界与预览限制')}</summary>
        {preview.notes.map((note) => (
          <p key={note}>{uiText(note, locale)}</p>
        ))}
        <p>
          {tu('预览有效至')} {new Date(preview.expiresAt).toLocaleTimeString(locale)}
          {tu('；解锁或重新锁定、切换数据库、断开连接均使旧计划失效。')}
        </p>
      </details>
    </section>
  );
}

export function RedisBulkOutcome({
  result,
  failure,
}: {
  result: RedisBulkResult;
  failure?: UiMessage | null;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const headline =
    result.state === 'complete'
      ? '批次执行已确认'
      : result.state === 'conflict'
        ? '检测到冲突 · 整批零写入'
        : result.state === 'unknown'
          ? '结果未确认 · 请刷新核对'
          : result.state === 'failed'
            ? '提交被拒绝 · 未开始写入'
            : '批次已停止 · 核对逐项结果';
  return (
    <section className={styles.outcome} aria-label={tu('Redis 批量操作结果')} role="status">
      <strong>{uiText(uiMessage(headline), locale)}</strong>
      <p>
        {tu('已执行')} {result.applied} {tu('· 无需更改')} {result.unchanged} {tu('· 原本缺失')}{' '}
        {result.missing} {tu('· 未确认')} {result.unknown} · {result.executionTimeMs} ms
      </p>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>{tu('实际结果')}</th>
              <th>{tu('期限 / 原因')}</th>
            </tr>
          </thead>
          <tbody>
            {result.keys.map((key) => (
              <tr key={key.key.rawBase64}>
                <td>
                  <code title={key.key.display}>{key.key.display || tu('（空 Key）')}</code>
                </td>
                <td data-state={key.state}>{uiText(stateLabels[key.state], locale)}</td>
                <td>
                  <span>{expiryLabel(key.expiresAt, locale)}</span>
                  {(failure || key.reason) && (
                    <small>{uiText(failure || key.reason, locale)}</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.state !== 'complete' && (
        <p className={styles.notice}>
          {tu(
            '列表已请求刷新；已确认的写入不会回滚，未确认结果不会自动重试。需要继续时请重新选择并生成新的只读预览。',
          )}
        </p>
      )}
    </section>
  );
}
