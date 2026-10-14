'use client';
import { useTranslation } from '@/lib/i18n';
import type { MongoDocumentExportProgress } from '@fouc/shared/mongo-document-transfer';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { useEffect, useRef, useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/document-transfer-export';
import { downloadMongoDocuments } from './download';
import styles from './transfer.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function MongoDocumentExportView({
  base,
  database,
  collection,
  filter,
  sort,
  onBusyChange,
}: {
  base: string;
  database: string;
  collection: string;
  filter: string;
  sort: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [scope, setScope] = useState<'all' | 'first'>('all');
  const [limit, setLimit] = useState(1000);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<UiMessage>(''),
    [done, setDone] = useState('');
  const [progress, setProgress] = useState<MongoDocumentExportProgress>({ documents: 0, bytes: 0 });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function start() {
    const controller = new AbortController();
    request.current = controller;
    onBusyChange(true);
    setBusy(true);
    setError('');
    setDone('');
    setProgress({ documents: 0, bytes: 0 });
    try {
      const target = await downloadMongoDocuments(
        base,
        { database, collection, filter, sort, scope, ...(scope === 'first' ? { limit } : {}) },
        controller.signal,
        setProgress,
      );
      setDone(target === 'disk' ? '已完成流式保存' : '导出完成，浏览器已开始保存文件');
    } catch (reason) {
      const aborted =
        controller.signal.aborted ||
        (reason instanceof DOMException && reason.name === 'AbortError');
      setError(
        aborted ? uiMessage('导出已取消；未完成的流式文件不会作为成功结果。') : uiFailure(reason),
      );
    } finally {
      request.current = null;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className={styles.workflow}>
      <div className={styles.intro}>
        <DownloadSimple size={28} weight="duotone" />
        <div>
          <strong>Canonical Extended JSON</strong>
          <p>
            {tu('每行一个完整 BSON 文档，保留 ObjectId、Int64、Decimal128、日期与二进制类型。')}
          </p>
        </div>
      </div>
      <div className={styles.scope}>
        <span className={styles.eyebrow}>{tu('读取范围')}</span>
        <strong>
          {database}.{collection}
        </strong>
        <pre aria-label={tu('导出已应用筛选')}>{filter}</pre>
        <small>
          {tu('使用当前已应用的筛选与排序，包含完整字段；实时游标读取，不提供一致性快照。')}
        </small>
      </div>
      <fieldset disabled={busy} className={styles.options}>
        <label>
          <span>{tu('导出范围')}</span>
          <select
            aria-label={tu('文档导出范围')}
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
          >
            <option value="all">{tu('所有匹配文档')}</option>
            <option value="first">{tu('仅前 N 个匹配文档')}</option>
          </select>
        </label>
        {scope === 'first' && (
          <label>
            <span>{tu('最多文档数')}</span>
            <input
              type="number"
              min={1}
              max={1_000_000}
              aria-label={tu('文档导出数量')}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
        )}
      </fieldset>
      <p className={styles.notice}>
        {tu(
          '独立游标按需读取，服务端最多 1 GiB / 10 分钟。支持文件系统保存时直接写入磁盘；浏览器下载回退最多 64 MiB。此文件不包含索引、集合选项或完整数据库备份。',
        )}
      </p>
      {(busy || done || error) && (
        <div className={styles.progress} role="status">
          <span>
            {progress.documents.toLocaleString(locale)} {tu('个文档')}
          </span>
          <strong>
            {(progress.bytes / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} KiB
          </strong>
          <span>{busy ? tu('正在读取并保存…') : done || tu('已停止')}</span>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {uiText(error, locale)}
        </p>
      )}
      <footer className={styles.footer}>
        <span>{tu('UTF-8 · NDJSON · 保留 BSON 类型')}</span>
        {busy ? (
          <button onClick={() => request.current?.abort()}>{tu('取消导出')}</button>
        ) : (
          <button className={styles.primary} onClick={() => void start()}>
            {tu('下载 NDJSON')}
          </button>
        )}
      </footer>
    </div>
  );
}
