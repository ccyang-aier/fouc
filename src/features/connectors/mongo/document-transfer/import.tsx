'use client';

import { useEffect, useRef, useState } from 'react';
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import {
  MONGO_DOCUMENT_TRANSFER_LIMITS as LIMITS,
  type MongoDocumentImportPreview, type MongoDocumentImportStatus, type MongoImportFieldMapping,
} from '@fouc/shared/mongo-document-transfer';
import { backendFetch } from '@/lib/backend';
import { MongoImportResult, MongoImportReview } from './import-review';
import styles from './transfer.module.css';

const FIELD_TYPES = ['string', 'objectId', 'int32', 'int64', 'decimal128', 'double', 'date', 'boolean'];
export function parseMongoImportMappings(text: string): MongoImportFieldMapping[] {
  return text.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const separator = line.lastIndexOf(':');
    const path = line.slice(0, separator).trim(), type = line.slice(separator + 1).trim();
    if (separator < 0 || !path.startsWith('/') || !FIELD_TYPES.includes(type)) throw new Error('字段转换须为 /字段/路径:类型，每行一项，例如 /amount:decimal128');
    return { path, type: type as MongoImportFieldMapping['type'] };
  });
}

export function MongoDocumentImportView({ base, database, collection, writable, onUnlock, onApplied, onBusyChange }: {
  base: string; database: string; collection: string; writable: boolean;
  onUnlock: () => Promise<void>; onApplied: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<{ name: string; text: string; bytes: number } | null>(null);
  const [format, setFormat] = useState<'json' | 'ndjson'>('ndjson'), [idPolicy, setIdPolicy] = useState<'preserve' | 'generate'>('preserve');
  const [mappingText, setMappingText] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<MongoDocumentImportPreview | null>(null), [status, setStatus] = useState<MongoDocumentImportStatus | null>(null);
  const [busy, setBusy] = useState<'file' | 'preview' | 'unlock' | 'commit' | null>(null), [error, setError] = useState('');
  const token = useRef<string | null>(null), request = useRef<AbortController | null>(null);
  useEffect(() => () => {
    request.current?.abort();
    if (token.current) void backendFetch(`${base}/documents/import/plans/${encodeURIComponent(token.current)}`, { method: 'DELETE' }).catch(() => undefined);
  }, [base]);
  function invalidate() {
    const current = token.current;
    token.current = null;
    if (current) void backendFetch(`${base}/documents/import/plans/${encodeURIComponent(current)}`, { method: 'DELETE' }).catch(() => undefined);
    setPreview(null); setStatus(null); setConfirmed(false); setError('');
  }
  function activity(value: typeof busy) { setBusy(value); onBusyChange(value !== null); }
  async function readFile(file: File | undefined) {
    if (!file) return;
    invalidate(); setSource(null); activity('file');
    try {
      if (!file.size || file.size > LIMITS.inputBytes) throw new Error('选择非空 UTF-8 文件，最大 32 MiB');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      setSource({ name: file.name, bytes: file.size, text });
      setFormat(/\.json$/i.test(file.name) ? 'json' : 'ndjson');
    } catch (reason) { setError(reason instanceof TypeError ? '文件不是有效 UTF-8，未截断或替换无效字节' : reason instanceof Error ? reason.message : String(reason)); }
    finally { activity(null); }
  }
  async function prepare() {
    if (!source) return;
    invalidate(); activity('preview');
    const controller = new AbortController(); request.current = controller;
    try {
      const fields = parseMongoImportMappings(mappingText);
      const result = await backendFetch<MongoDocumentImportPreview>(`${base}/documents/import/plans`, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ database, collection, text: source.text, format, idPolicy, fields }),
      });
      token.current = result.planId; setPreview(result);
    } catch (reason) { setError(controller.signal.aborted ? '预览已取消，未执行写入' : reason instanceof Error ? reason.message : String(reason)); }
    finally { request.current = null; activity(null); }
  }
  async function unlock() {
    invalidate(); activity('unlock');
    try { await onUnlock(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { activity(null); }
  }
  async function commit() {
    const planId = token.current;
    if (!planId || !confirmed || !writable) return;
    activity('commit'); setError('');
    const controller = new AbortController(); request.current = controller;
    let polling = false, active = true;
    const poll = setInterval(() => {
      if (polling) return;
      polling = true;
      void backendFetch<MongoDocumentImportStatus>(`${base}/documents/import/plans/${encodeURIComponent(planId)}`).then(value => { if (active) setStatus(value); }).catch(() => undefined).finally(() => { polling = false; });
    }, 600);
    try {
      const result = await backendFetch<MongoDocumentImportStatus>(`${base}/documents/import/plans/${encodeURIComponent(planId)}/commit`, { method: 'POST', body: JSON.stringify({ confirm: true }), signal: controller.signal });
      active = false; setStatus(result);
      if (result.inserted || result.uncertainDocuments) onApplied();
    } catch (reason) {
      // A lost HTTP acknowledgement is not permission to retry. Recover the consumed plan's status once.
      try {
        const recovered = await backendFetch<MongoDocumentImportStatus>(`${base}/documents/import/plans/${encodeURIComponent(planId)}`);
        active = false; setStatus(recovered);
        if (recovered.inserted || recovered.uncertainDocuments) onApplied();
        if (recovered.state === 'running') setError('请求连接中断，服务器仍在等待本批确认。请停止后续批次并核对目标集合，不要重复提交。');
      } catch { setError(`无法确认导入结果，请核对目标集合，不要重复提交。${reason instanceof Error ? reason.message : String(reason)}`); }
    } finally { active = false; clearInterval(poll); request.current = null; activity(null); setConfirmed(false); }
  }
  async function cancel() {
    const current = token.current;
    if ((busy === 'commit' || status?.state === 'running') && current) {
      try { setStatus(await backendFetch<MongoDocumentImportStatus>(`${base}/documents/import/plans/${encodeURIComponent(current)}/cancel`, { method: 'POST' })); }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    } else request.current?.abort();
  }
  return <div className={styles.workflow}>
    <div className={styles.intro}><UploadSimple size={28} weight="duotone" /><div><strong>验证文件，然后审查追加</strong><p>目标 {database}.{collection} · 支持 UTF-8 JSON 对象 / 数组和 NDJSON。</p></div></div>
    {preview ? <div className={styles.sourceSummary}><div><strong>{source?.name}</strong><small>{format.toUpperCase()} · {idPolicy === 'generate' ? '生成新 ObjectId' : '保留原生 _id'}{mappingText.trim() ? ' · 显式字段转换' : ''}</small></div><button disabled={!!busy} onClick={invalidate}>修改配置</button></div> : <fieldset disabled={busy !== null} className={styles.source}>
      <label className={styles.file}><span>{source ? source.name : '选择文档文件'}</span><small>{source ? `${(source.bytes / 1024).toFixed(1)} KiB · 已完整读取` : 'JSON / NDJSON / JSONL · 最大 32 MiB'}</small><input type="file" accept=".json,.ndjson,.jsonl,application/json" aria-label="选择 MongoDB 文档导入文件" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void readFile(file); }} /></label>
      <div className={styles.options}><label><span>文件格式</span><select aria-label="文档导入格式" value={format} onChange={event => { invalidate(); setFormat(event.target.value as typeof format); }}><option value="ndjson">NDJSON · 每行一个文档</option><option value="json">JSON · 对象或对象数组</option></select></label><label><span>_id 处理</span><select aria-label="导入文档 ID 策略" value={idPolicy} onChange={event => { invalidate(); setIdPolicy(event.target.value as typeof idPolicy); }}><option value="preserve">保留原生 _id；缺少时生成</option><option value="generate">忽略原 _id，生成新 ObjectId</option></select></label></div>
      <label className={styles.mapping}><span>显式字段类型转换 <small>可选 · 每行一个 JSON Pointer</small></span><textarea aria-label="导入字段类型转换" rows={3} value={mappingText} spellCheck={false} placeholder={'/amount:decimal128\n/items/0/count:int64\n/_id:objectId'} onChange={event => { invalidate(); setMappingText(event.target.value); }} /><small>数组使用 /items/0；~1 转义 /，~0 转义 ~。支持 {FIELD_TYPES.join('、')}。缺少字段保持缺少，null 保持 null。</small></label>
    </fieldset>}
    {!preview && <p className={styles.notice}>每次最多 5000 个文档、32 MiB；单文档最多 256 KiB。Canonical EJSON 保留 BSON 类型；普通 JSON 的大整数须使用 $numberLong 或数字字符串再指定转换。不会自动识别 24 位十六进制字符串为 ObjectId，不支持 CSV、ZIP 或 dump。</p>}
    {preview && !status && <MongoImportReview preview={preview} />}
    {status && <MongoImportResult status={status} />}
    {status?.state === 'running' && !busy && <div className={styles.footer}><button onClick={() => void cancel()}>停止后续批次</button><button onClick={() => { if (token.current) void backendFetch<MongoDocumentImportStatus>(`${base}/documents/import/plans/${encodeURIComponent(token.current)}`).then(setStatus).catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); }}>刷新写入结果</button></div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {preview && !status && writable && <label className={styles.confirmation}><input type="checkbox" checked={confirmed} disabled={!!busy} onChange={event => setConfirmed(event.target.checked)} /><span>向 {collection} 追加全部 {preview.documents} 个文档；保留已成功写入，不覆盖已有文档。</span></label>}
    <footer className={styles.footer}>
      <span>{busy === 'file' ? '完整读取文件…' : busy === 'preview' ? '验证全部文档并读取服务器…' : busy === 'commit' ? '每批最多 100 个，等待服务器确认' : preview ? '一次性计划 · 5 分钟内有效' : '预览不写入数据库'}</span>
      {busy === 'preview' || busy === 'commit' ? <button onClick={() => void cancel()}>{busy === 'commit' ? '停止后续批次' : '取消预览'}</button> : <>
        {!writable && <button disabled={!!busy} onClick={() => void unlock()}>解锁写入</button>}
        <button disabled={!source || !!busy} onClick={() => void prepare()}>{preview || status ? '重新预览' : '完整验证与预览'}</button>
        {preview && !status && <button className={styles.primary} disabled={!writable || !confirmed || !!busy} onClick={() => void commit()}>确认追加 {preview.documents} 个文档</button>}
      </>}
    </footer>
  </div>;
}
