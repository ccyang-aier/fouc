'use client';
import { type UiMessage } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import {
  mongoGridFsSize,
  type MongoGridFsBuckets,
  type MongoGridFsFile,
  type MongoGridFsPage,
  type MongoGridFsSummary,
} from '@fouc/shared/mongo-gridfs';
import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  File,
  Funnel,
  Stop,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createUiMessages, uiFailure, uiText } from '../../i18n/ui-message';
import { useMongoResource } from '../mongo-resource';
import { messages as unitMessages } from './../i18n/gridfs-panel';
import { downloadMongoGridFs } from './download';
import { GridFsFileDetails, GridFsFiles } from './files';
import styles from './gridfs.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function MongoGridFsPanel({
  base,
  database,
  revision = 0,
}: {
  base: string;
  database: string;
  revision?: number;
}) {
  return (
    <GridFsBrowser
      key={`${base}:${database}`}
      base={base}
      database={database}
      revision={revision}
    />
  );
}

function GridFsBrowser({
  base,
  database,
  revision,
}: {
  base: string;
  database: string;
  revision: number;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [bucketChoice, setBucketChoice] = useState(''),
    [refresh, setRefresh] = useState(0);
  const buckets = useMongoResource<MongoGridFsBuckets>(
    `${base}/gridfs/buckets`,
    JSON.stringify({ database }),
    revision + refresh,
  );
  const bucket = buckets.data?.buckets.some((item) => item.bucket === bucketChoice)
    ? bucketChoice
    : (buckets.data?.buckets[0]?.bucket ?? '');
  const current = buckets.data?.buckets.find((item) => item.bucket === bucket);
  return (
    <section className={styles.panel} aria-label={tu('MongoDB GridFS 文件浏览')}>
      <header className={styles.header}>
        <div>
          <span className={styles.emblem}>
            <File size={22} />
          </span>
          <div>
            <h2>{tu('GridFS 文件')}</h2>
            <p>
              {database} {tu('· 原生文件与分块，只读浏览 / 下载')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefresh((value) => value + 1)}
          aria-label={tu('刷新 GridFS 桶目录')}
        >
          <ArrowsClockwise size={15} />
          {tu('刷新')}
        </button>
      </header>
      <div className={styles.bucketBar}>
        <label>
          Bucket
          <select
            aria-label={tu('GridFS Bucket')}
            value={bucket}
            disabled={buckets.loading || !buckets.data?.buckets.length}
            onChange={(event) => setBucketChoice(event.target.value)}
          >
            <option value="" disabled>
              {tu('选择原生桶')}
            </option>
            {buckets.data?.buckets.map((item) => (
              <option key={item.bucket} value={item.bucket}>
                {item.bucket}
                {item.state === 'files-only'
                  ? tu(' · 仅文件集合')
                  : item.state === 'chunks-only'
                    ? tu(' · 仅分块集合')
                    : ''}
              </option>
            ))}
          </select>
        </label>
        <span
          title={
            current
              ? `${database}.${current.filesCollection}\n${database}.${current.chunksCollection}`
              : ''
          }
        >
          {current
            ? `${current.filesCollection} / ${current.chunksCollection}`
            : tu('从真实 .files / .chunks 集合发现')}
        </span>
        <small>
          {buckets.data
            ? tu('{v0} 个桶{v1}', {
                v0: String(buckets.data.buckets.length),
                v1: String(buckets.data.truncated ? ' · 目录已截断' : ''),
              })
            : '—'}
        </small>
      </div>
      {buckets.loading && (
        <div className={styles.empty} role="status">
          <span className={styles.spinner} />
          <h3>{tu('读取原生桶目录…')}</h3>
          <button type="button" onClick={buckets.cancel}>
            {tu('取消目录读取')}
          </button>
        </div>
      )}
      {buckets.error && (
        <div className={styles.empty}>
          <p role="alert" className={styles.warning}>
            {uiText(buckets.error, locale)}
          </p>
          <button type="button" onClick={() => setRefresh((value) => value + 1)}>
            {tu('重试目录读取')}
          </button>
        </div>
      )}
      {buckets.data && !bucket && (
        <div className={styles.empty}>
          <File size={30} />
          <h3>{tu('当前数据库没有 GridFS 桶')}</h3>
          <p>{tu('仅显示真实存在的文件或分块集合。')}</p>
        </div>
      )}
      {bucket && !buckets.loading && (
        <GridFsBucket
          key={bucket}
          base={base}
          database={database}
          bucket={bucket}
          revision={revision + refresh}
          incomplete={current?.state !== 'complete'}
        />
      )}
    </section>
  );
}

function GridFsBucket({
  base,
  database,
  bucket,
  revision,
  incomplete,
}: {
  base: string;
  database: string;
  bucket: string;
  revision: number;
  incomplete: boolean;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [filter, setFilter] = useState('{}'),
    [sort, setSort] = useState('{"uploadDate":-1}');
  const [request, setRequest] = useState({
    filter: '{}',
    sort: '{"uploadDate":-1}',
    offset: 0,
    limit: 50,
    revision: 0,
  });
  const [limit, setLimit] = useState(50),
    [advanced, setAdvanced] = useState(false);
  const [history, setHistory] = useState<number[]>([]),
    [selected, setSelected] = useState<MongoGridFsFile | null>(null);
  const [download, setDownload] = useState<{
    file: MongoGridFsFile;
    received: number;
    cancelling: boolean;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<UiMessage>(''),
    [notice, setNotice] = useState<UiMessage>('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const namespace = { database, bucket };
  const page = useMongoResource<MongoGridFsPage>(
    `${base}/gridfs/files`,
    JSON.stringify({ ...namespace, ...request }),
    revision + request.revision,
  );
  const summary = useMongoResource<MongoGridFsSummary>(
    `${base}/gridfs/summary`,
    JSON.stringify(namespace),
    revision,
  );
  const dirty = request.filter !== filter || request.sort !== sort || request.limit !== limit;
  function apply() {
    setSelected(null);
    setHistory([]);
    setRequest((value) => ({ filter, sort, offset: 0, limit, revision: value.revision + 1 }));
  }
  function move(offset: number) {
    setSelected(null);
    setRequest((value) => ({ ...value, offset, revision: value.revision + 1 }));
  }
  function next() {
    if (page.data?.nextOffset == null) return;
    setHistory((value) => [...value, request.offset]);
    move(page.data.nextOffset);
  }
  function previous() {
    const offset = history.at(-1);
    if (offset === undefined) return;
    setHistory((value) => value.slice(0, -1));
    move(offset);
  }
  async function save(file: MongoGridFsFile) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setDownload({ file, received: 0, cancelling: false });
    setDownloadError('');
    setNotice('');
    try {
      const mode = await downloadMongoGridFs(base, namespace, file, controller.signal, (received) =>
        setDownload((value) => (value ? { ...value, received } : null)),
      );
      if (!controller.signal.aborted)
        setNotice(
          mode === 'disk'
            ? uiMessage('文件已完整写入所选位置')
            : uiMessage('内容已完整接收，已交给浏览器保存'),
        );
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        setNotice(uiMessage('下载已取消，未确认完整文件'));
      else setDownloadError(uiFailure(error));
    } finally {
      active.current = null;
      setDownload(null);
    }
  }
  return (
    <div className={styles.bucket}>
      <div className={styles.summary}>
        <div>
          <span>{tu('桶内文件')}</span>
          <strong>{summary.data?.fileCount ?? (summary.loading ? '读取中…' : '—')}</strong>
        </div>
        <div>
          <span>{tu('原生总容量')}</span>
          <strong
            title={
              summary.data?.totalBytes !== null && summary.data
                ? `${summary.data.totalBytes} bytes`
                : undefined
            }
          >
            {summary.data
              ? mongoGridFsSize(summary.data.totalBytes)
              : summary.loading
                ? tu('读取中…')
                : '—'}
          </strong>
        </div>
        <p>{tu('单文件最多 1 GiB · 不支持流式保存的浏览器最多 64 MiB')}</p>
      </div>
      {incomplete && (
        <p className={styles.warning}>
          {tu('桶集合配对不完整。元数据仍可读取，内容下载可能缺少分块。')}
        </p>
      )}
      {summary.error && (
        <p className={styles.warning} role="alert">
          {tu('摘要读取失败：')}
          {uiText(summary.error, locale)}
        </p>
      )}
      {summary.data?.warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {uiText(warning, locale)}
        </p>
      ))}
      <div className={styles.filterBar}>
        <label>
          <Funnel size={15} />
          <span>FILTER</span>
        </label>
        <textarea
          aria-label={tu('GridFS 文件筛选 EJSON')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          spellCheck={false}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
          }}
        />
        <button type="button" data-active={advanced} onClick={() => setAdvanced((value) => !value)}>
          {tu('排序')}
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => (page.loading ? page.cancel() : apply())}
        >
          {page.loading ? <Stop size={14} /> : <Funnel size={14} />}
          {page.loading ? tu('取消读取') : dirty ? tu('应用筛选') : tu('重新查询')}
        </button>
      </div>
      {advanced && (
        <label className={styles.sort}>
          {tu('排序 EJSON · 自动追加 _id')}
          <textarea
            aria-label={tu('GridFS 文件排序 EJSON')}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            spellCheck={false}
          />
        </label>
      )}
      <div className={styles.content}>
        <div className={styles.list}>
          {page.loading && (
            <div className={styles.empty} role="status">
              <span className={styles.spinner} />
              <h3>{tu('读取文件元数据…')}</h3>
            </div>
          )}
          {page.error && (
            <div className={styles.empty}>
              <p role="alert" className={styles.warning}>
                {uiText(page.error, locale)}
              </p>
              <button type="button" onClick={() => move(request.offset)}>
                {tu('重试当前页')}
              </button>
            </div>
          )}
          {page.data &&
            (page.data.files.length ? (
              <GridFsFiles
                page={page.data}
                selected={selected?.idEjson ?? null}
                onSelect={setSelected}
                onDownload={(file) => void save(file)}
                busy={Boolean(download)}
              />
            ) : (
              <div className={styles.empty}>
                <File size={27} />
                <h3>{tu('没有匹配的文件')}</h3>
                <p>{tu('请检查当前桶或调整筛选条件。')}</p>
              </div>
            ))}
        </div>
        {selected && <GridFsFileDetails file={selected} onClose={() => setSelected(null)} />}
      </div>
      {download && (
        <div className={styles.download} role="status">
          <DownloadSimple size={17} />
          <div>
            <strong>{download.file.filename || tu('GridFS 文件')}</strong>
            <span>
              {download.cancelling
                ? tu('正在停止下载…')
                : `${mongoGridFsSize(String(download.received))} / ${mongoGridFsSize(download.file.length)}`}
            </span>
            <progress
              value={download.received}
              max={Number(download.file.length)}
              aria-label={tu('GridFS 下载进度')}
            />
          </div>
          <button
            type="button"
            disabled={download.cancelling}
            onClick={() => {
              active.current?.abort();
              setDownload((value) => (value ? { ...value, cancelling: true } : null));
            }}
          >
            {tu('取消下载')}
          </button>
        </div>
      )}
      {downloadError && (
        <p className={styles.warning} role="alert">
          {uiText(downloadError, locale)}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {uiText(notice, locale)}
        </p>
      )}
      <footer className={styles.footer}>
        <span>
          {page.data
            ? `${request.offset + (page.data.files.length ? 1 : 0)}–${request.offset + page.data.files.length} · ${page.data.elapsedMs.toFixed(1)} ms`
            : tu('等待当前页')}
          <small>{tu('独立分页读取，不保证并发增删时的固定快照')}</small>
        </span>
        <label>
          {tu('每页')}
          <select
            aria-label={tu('GridFS 每页文件数')}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            {[25, 50, 100, 250, 500].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={tu('上一页 GridFS 文件')}
          disabled={page.loading || !history.length}
          onClick={previous}
        >
          <CaretLeft size={16} />
        </button>
        <button
          type="button"
          aria-label={tu('下一页 GridFS 文件')}
          disabled={page.loading || page.data?.nextOffset == null}
          onClick={next}
        >
          <CaretRight size={16} />
        </button>
      </footer>
      {page.data?.warnings.slice(1).map((warning) => (
        <p key={warning} className={styles.warning}>
          {uiText(warning, locale)}
        </p>
      ))}
    </div>
  );
}
