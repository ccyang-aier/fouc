'use client';

import { useEffect, useRef, useState } from 'react';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import type { RelationalProvider } from '@fouc/shared';
import { DEFAULT_DATABASE_EXPORT_INPUT, validateDatabaseExportInput, type DatabaseExportInput, type DatabaseExportTableTarget } from '@fouc/shared/database-export';
import { downloadDatabaseExport } from './download';
import { ExportOptions } from './options';
import { ExportProgress, exportBytes } from './progress';
import { databaseExportActive, useDatabaseExportJob } from './use-export-job';
import { useDatabaseExportCatalogue } from './use-export-catalogue';
import styles from './database-export.module.css';

export interface DatabaseExportPanelProps {
  base: string;
  provider: RelationalProvider;
  database: string;
  schemas: string[];
  tables?: DatabaseExportTableTarget[];
  initialSchemas?: string[];
  initialTables?: DatabaseExportTableTarget[];
  onClose?(): void;
}

export function DatabaseExportPanel(props: DatabaseExportPanelProps) {
  return <Panel key={`${props.base}:${JSON.stringify(props.schemas)}`} {...props} />;
}

function Panel({ base, provider, database, schemas, tables, initialSchemas, initialTables, onClose }: DatabaseExportPanelProps) {
  const [input, setInput] = useState<DatabaseExportInput>(() => ({
    ...DEFAULT_DATABASE_EXPORT_INPUT,
    schemas: initialSchemas?.filter(schema => schemas.includes(schema)) ?? [...schemas],
    tables: initialTables?.map(table => ({ ...table })) ?? [],
  }));
  const [selectedMode, setSelectedMode] = useState(Boolean(initialTables?.length));
  const [inputError, setInputError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadBytes, setDownloadBytes] = useState(0);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  const resource = useDatabaseExportJob(base);
  const catalogue = useDatabaseExportCatalogue(base, input.schemas, tables, selectedMode && !resource.progress);
  const active = databaseExportActive(resource.progress);
  const busy = active || resource.starting || downloading || resource.loadingRecent || catalogue.loading;
  useEffect(() => () => downloadController.current?.abort(), []);

  function start() {
    try {
      if (selectedMode && !input.tables.length) throw new Error('指定对象模式下至少选择一张表 / 视图。');
      const request = validateDatabaseExportInput({ ...input, tables: selectedMode ? input.tables : [] });
      setInputError(null);
      setDownloadFeedback(null);
      setDownloadError(null);
      void resource.start(request);
    } catch (error) { setInputError(error instanceof Error ? error.message : String(error)); }
  }

  function returnToSettings() {
    const previous = resource.progress?.review?.input;
    if (previous) {
      setInput(previous);
      setSelectedMode(previous.tables.length > 0);
    }
    setInputError(null);
    setDownloadError(null);
    setDownloadFeedback(null);
    resource.select(null);
  }

  async function download() {
    if (!resource.progress?.artifact || !resource.artifactUrl) return;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(true);
    setDownloadBytes(0);
    setDownloadFeedback(null);
    setDownloadError(null);
    try {
      const artifact = resource.progress.artifact;
      const method = await downloadDatabaseExport(resource.artifactUrl, artifact.filename, artifact.bytes, controller.signal, setDownloadBytes);
      setDownloadFeedback(method === 'disk' ? '文件已完整保存至所选位置。' : '文件已完整交给浏览器下载。');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setDownloadFeedback('已取消文件下载，可重新保存。');
      else setDownloadError(error instanceof Error ? error.message : String(error));
    } finally { setDownloading(false); }
  }

  return <section className={styles.panel} aria-label="原生数据库流式导出">
    <header className={styles.header}>
      <div className={styles.heading}>
        <span className={styles.headerIcon}>
          <Database size={21} weight="duotone" />
        </span>
        <div>
          <span className={styles.eyebrow}>NATIVE DATABASE EXPORT</span>
          <h2>数据库导出</h2>
          <p>{provider} <span>·</span> {database}
          </p>
        </div>
      </div>
      <span className={styles.readOnlyBadge}>只读源</span>
    </header>
    <main className={styles.body}>
      {resource.recent.length > 0 && <div className={styles.recent}>
        <label>
          <span>当前会话任务</span>
          <select aria-label="恢复数据库导出任务" disabled={downloading || resource.starting} value={resource.progress?.id ?? ''} onChange={event => resource.select(event.target.value || null)}>
            <option value="">新建导出任务</option>{resource.recent.map(job => <option key={job.id} value={job.id}>{new Date(job.startedAt).toLocaleTimeString()} · {job.review?.input.format.toUpperCase() ?? '准备'} · {({ preparing: '准备中', running: '运行中', finalizing: '封装中', completed: '可下载', cancelled: '已取消', failed: '失败' })[job.status]} · {job.rows.toLocaleString()} 行</option>)}
          </select>
        </label>{resource.progress && !active && <button className={styles.secondary} disabled={busy} onClick={() => void resource.discard().catch(error => setInputError(error instanceof Error ? error.message : String(error)))}>删除设备文件</button>}
      </div>}
      {resource.loadingRecent ? <div className={styles.loading}>
        <span className={styles.spinner} />
        <span>正在恢复当前会话的导出任务…</span>
      </div> : resource.progress ? <ExportProgress value={resource.progress} /> : <>
        {catalogue.error && <p className={styles.error} role="alert">原生对象目录读取失败：{catalogue.error} <button className={styles.secondary} onClick={catalogue.retry}>重试目录</button></p>}
        {catalogue.loading && <p className={styles.helper} role="status">正在读取选中 Schema 的原生对象…</p>}
        <ExportOptions value={input} schemas={schemas} tables={catalogue.tables} selectedMode={selectedMode} disabled={busy} onChange={setInput} onSelectedMode={setSelectedMode}/>
      </>}
    </main>
    {(inputError || resource.error || downloadError) && <div className={styles.errorBar} role="alert">{inputError ?? resource.error ?? downloadError}
    </div>}
    {downloadFeedback && <div className={styles.feedback} role="status">{downloadFeedback}
    </div>}
    <footer className={styles.footer}>
      <div className={styles.footerNote}>{downloading ? `正在保存 ${exportBytes(downloadBytes)} / ${exportBytes(resource.progress?.artifact?.bytes ?? 0)}` : resource.progress?.status === 'completed' ? '关闭后仍可恢复下载；源会话关闭时清理设备文件。' : active ? '关闭面板后任务继续；取消会停止读取并清理文件。' : '临时文件预算：本工作空间 1 GiB / 设备共 2 GiB。'}
      </div>
      <div className={styles.footerActions}>
        {onClose && <button className={styles.secondary} disabled={resource.starting || downloading} onClick={onClose}>关闭</button>}
        {downloading ? <button className={styles.secondary} onClick={() => downloadController.current?.abort()}>
          <Stop size={13} />取消下载</button> : active ? <button className={styles.secondary} disabled={resource.cancelling} onClick={() => void resource.cancel()}>
            <Stop size={13} />{resource.cancelling ? '正在取消…' : '取消导出'}
          </button> : resource.progress ? <>
            <button className={styles.secondary} disabled={busy} onClick={returnToSettings}>
              {resource.progress.status === 'failed' ? '调整设置并重试' : '新建导出'}
            </button>
            {resource.progress.status === 'completed' && <button className={styles.primary} onClick={() => void download()}>
              <DownloadSimple size={15} />保存文件
            </button>}
          </> : <button className={styles.primary} disabled={busy || !schemas.length} onClick={start}>{resource.starting ? '正在准备…' : '开始原生导出'}
          <ArrowRight size={14} />
        </button>}
      </div>
    </footer>
  </section>;
}
