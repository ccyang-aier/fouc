'use client';

import { useEffect, useRef, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import type { MongoDocumentExportProgress } from '@fouc/shared/mongo-document-transfer';
import { downloadMongoDocuments } from './download';
import styles from './transfer.module.css';

export function MongoDocumentExportView({ base, database, collection, filter, sort, onBusyChange }: {
  base: string; database: string; collection: string; filter: string; sort: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [scope, setScope] = useState<'all' | 'first'>('all');
  const [limit, setLimit] = useState(1000);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const [progress, setProgress] = useState<MongoDocumentExportProgress>({ documents: 0, bytes: 0 });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function start() {
    const controller = new AbortController();
    request.current = controller;
    onBusyChange(true);
    setBusy(true); setError(''); setDone(''); setProgress({ documents: 0, bytes: 0 });
    try {
      const target = await downloadMongoDocuments(base, { database, collection, filter, sort, scope, ...(scope === 'first' ? { limit } : {}) }, controller.signal, setProgress);
      setDone(target === 'disk' ? '已完成流式保存' : '导出完成，浏览器已开始保存文件');
    } catch (reason) {
      const aborted = controller.signal.aborted || reason instanceof DOMException && reason.name === 'AbortError';
      setError(aborted ? '导出已取消；未完成的流式文件不会作为成功结果。' : reason instanceof Error ? reason.message : String(reason));
    } finally { request.current = null; setBusy(false); onBusyChange(false); }
  }
  return <div className={styles.workflow}>
    <div className={styles.intro}><DownloadSimple size={28} weight="duotone" /><div><strong>Canonical Extended JSON</strong><p>每行一个完整 BSON 文档，保留 ObjectId、Int64、Decimal128、日期与二进制类型。</p></div></div>
    <div className={styles.scope}><span className={styles.eyebrow}>读取范围</span><strong>{database}.{collection}</strong><pre aria-label="导出已应用筛选">{filter}</pre><small>使用当前已应用的筛选与排序，包含完整字段；实时游标读取，不提供一致性快照。</small></div>
    <fieldset disabled={busy} className={styles.options}>
      <label><span>导出范围</span><select aria-label="文档导出范围" value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="all">所有匹配文档</option><option value="first">仅前 N 个匹配文档</option></select></label>
      {scope === 'first' && <label><span>最多文档数</span><input type="number" min={1} max={1_000_000} aria-label="文档导出数量" value={limit} onChange={event => setLimit(Number(event.target.value))} /></label>}
    </fieldset>
    <p className={styles.notice}>独立游标按需读取，服务端最多 1 GiB / 10 分钟。支持文件系统保存时直接写入磁盘；浏览器下载回退最多 64 MiB。此文件不包含索引、集合选项或完整数据库备份。</p>
    {(busy || done || error) && <div className={styles.progress} role="status"><span>{progress.documents.toLocaleString()} 个文档</span><strong>{(progress.bytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KiB</strong><span>{busy ? '正在读取并保存…' : done || '已停止'}</span></div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <footer className={styles.footer}><span>UTF-8 · NDJSON · 保留 BSON 类型</span>{busy ? <button onClick={() => request.current?.abort()}>取消导出</button> : <button className={styles.primary} onClick={() => void start()}>下载 NDJSON</button>}</footer>
  </div>;
}
