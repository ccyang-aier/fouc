'use client';
import { useTranslation } from '@/lib/i18n';
import {
  MONGO_GRIDFS_LIMITS,
  mongoGridFsSize,
  type MongoGridFsFile,
  type MongoGridFsPage,
} from '@fouc/shared/mongo-gridfs';
import { DownloadSimple, File, Info } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { uiText } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/gridfs-files';
import styles from './gridfs.module.css';

export function GridFsFiles({
  page,
  selected,
  onSelect,
  onDownload,
  busy,
}: {
  page: MongoGridFsPage;
  selected: string | null;
  onSelect: (file: MongoGridFsFile) => void;
  onDownload: (file: MongoGridFsFile) => void;
  busy: boolean;
}) {
  const { t: tu } = useTranslation(unitMessages);

  return (
    <div className={styles.tableScroll}>
      <table className={styles.files} aria-label={tu('GridFS 原生文件列表')}>
        <thead>
          <tr>
            <th>{tu('文件名')}</th>
            <th>{tu('大小')}</th>
            <th>{tu('上传时间 · UTC')}</th>
            <th>{tu('内容类型')}</th>
            <th>{tu('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {page.files.map((file) => {
            const available =
              file.length !== null &&
              file.chunkSize !== null &&
              BigInt(file.length) <= BigInt(MONGO_GRIDFS_LIMITS.downloadBytes);
            return (
              <tr key={file.idEjson} data-selected={file.idEjson === selected}>
                <th scope="row">
                  <button
                    type="button"
                    className={styles.fileName}
                    onClick={() => onSelect(file)}
                    title={file.filename || file.idEjson}
                  >
                    <File size={17} />
                    <span>{file.filename || tu('未命名文件')}</span>
                    {file.warnings.length > 0 && (
                      <Info size={14} aria-label={tu('文件元数据有警告')} />
                    )}
                  </button>
                </th>
                <td title={file.length !== null ? `${file.length} bytes` : tu('无效长度')}>
                  <code>{mongoGridFsSize(file.length)}</code>
                </td>
                <td>
                  <time
                    dateTime={file.uploadedAt ?? undefined}
                    title={file.uploadedAt ?? tu('原生日期无效')}
                  >
                    {file.uploadedAt?.replace('T', ' ').replace('Z', '') ?? tu('未知')}
                  </time>
                </td>
                <td title={file.contentType ?? ''}>
                  <span className={styles.contentType}>{file.contentType || tu('未提供')}</span>
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!available || busy}
                    onClick={() => onDownload(file)}
                    aria-label={tu('下载 {v0}', { v0: String(file.filename || 'GridFS 文件') })}
                    title={
                      available
                        ? tu('读取原生 GridFS 内容')
                        : file.warnings.join('；') || tu('单文件下载上限 1 GiB')
                    }
                  >
                    <DownloadSimple size={15} />
                    {tu('下载')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GridFsFileDetails({
  file,
  onClose,
}: {
  file: MongoGridFsFile;
  onClose: () => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [rawOpen, setRawOpen] = useState(false);
  const metadata = useMemo(() => pretty(file.metadataEjson), [file.metadataEjson]);
  const raw = useMemo(() => (rawOpen ? pretty(file.rawEjson) : ''), [file.rawEjson, rawOpen]);
  return (
    <aside className={styles.details} aria-label={tu('GridFS 文件详情')}>
      <header>
        <div>
          <Info size={17} />
          <strong>{tu('文件详情')}</strong>
        </div>
        <button type="button" onClick={onClose}>
          {tu('关闭')}
        </button>
      </header>
      <h3 title={file.filename}>{file.filename || tu('未命名文件')}</h3>
      <dl>
        <dt>{tu('原始长度')}</dt>
        <dd>{file.length === null ? tu('未知') : `${file.length} bytes`}</dd>
        <dt>{tu('原生分块')}</dt>
        <dd>{file.chunkSize === null ? tu('未知') : `${file.chunkSize} bytes`}</dd>
        <dt>{tu('上传时间 UTC')}</dt>
        <dd>{file.uploadedAt || tu('未知')}</dd>
        <dt>{tu('文件身份')}</dt>
        <dd>
          <code>{file.idEjson}</code>
        </dd>
      </dl>
      {file.warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {uiText(warning, locale)}
        </p>
      ))}
      <details open>
        <summary>{tu('metadata · Canonical EJSON')}</summary>
        <pre>{metadata}</pre>
      </details>
      <details onToggle={(event) => setRawOpen(event.currentTarget.open)}>
        <summary>{tu('完整 files 文档 · EJSON')}</summary>
        {rawOpen && <pre>{raw}</pre>}
      </details>
    </aside>
  );
}

function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
