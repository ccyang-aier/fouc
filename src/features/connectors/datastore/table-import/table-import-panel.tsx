'use client';

import { useEffect, useRef, useState } from 'react';
import type { DatabaseColumnInfo, RelationalProvider } from '@fouc/shared';
import { autoMapTableImportColumns, decodeTableImportBytes, parseTableImport, TABLE_IMPORT_LIMITS, validateTableImportMappings, type TableImportAppendSummary, type TableImportEncoding, type TableImportFormat, type TableImportInput, type TableImportIssue, type TableImportMapping, type TableImportParsed, type TableImportPlan, type TableImportReview } from '@fouc/shared/table-import';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { FileArrowUp } from '@phosphor-icons/react/dist/csr/FileArrowUp';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { backendFetch } from '@/lib/backend';
import { TableImportMappingEditor } from './mapping-editor';
import { defaultTableImportOptions, TableImportParseControls } from './parse-options';
import { TableImportPreviewGrid } from './preview-grid';
import styles from './table-import.module.css';

export type TableImportPanelProps = {
  provider: RelationalProvider;
  sessionId: string;
  /** Scoped session resource URL, including its workspace and session ID. */
  base: string;
  schema: string;
  table: string;
  columns: DatabaseColumnInfo[];
  onPreview?: (input: TableImportInput, signal?: AbortSignal) => Promise<TableImportPlan>;
  onAppend?: (planId: string, signal?: AbortSignal) => Promise<TableImportAppendSummary>;
  onDiscard?: (planId: string) => Promise<void>;
  onImported?: (summary: TableImportAppendSummary) => void;
  onClose?: () => void;
};
type Step = 'source' | 'mapping' | 'review' | 'done';
const STEPS: Array<[Step, string]> = [['source', '源与解析'], ['mapping', '字段映射'], ['review', '审核导入'], ['done', '完成']];
function formatForName(name: string): TableImportFormat { return /\.sql$/i.test(name) ? 'sql' : /\.tsv$/i.test(name) ? 'tsv' : /\.json$/i.test(name) ? 'json' : /\.(ndjson|jsonl)$/i.test(name) ? 'ndjson' : /\.(txt|psv)$/i.test(name) ? 'delimited' : 'csv'; }
function Issues({ issues }: { issues: TableImportIssue[] }) {
  return issues.length ? <div className={styles.issues} role="alert"><div><WarningCircle size={15} /><strong>请修正后重新预览</strong></div><ul>{issues.slice(0, 20).map((issue, index) => <li key={index}>{issue.record ? `记录 ${issue.record} · ` : ''}{issue.line ? `第 ${issue.line} 行，第 ${issue.column} 列 · ` : ''}{issue.targetColumn ? `${issue.targetColumn}：` : ''}{issue.message}</li>)}</ul>{issues.length > 20 && <span>另有 {issues.length - 20} 项问题。</span>}</div> : null;
}
export function TableImportPanel(props: TableImportPanelProps) {
  return <TableImportWorkflow key={`${props.base}\0${props.sessionId}\0${props.schema}\0${props.table}`} {...props} />;
}
function TableImportWorkflow({ provider, base, schema, table, columns, onPreview, onAppend, onDiscard, onImported, onClose }: TableImportPanelProps) {
  const [step, setStep] = useState<Step>('source'), [sourceMode, setSourceMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null), [paste, setPaste] = useState('');
  const [options, setOptions] = useState(defaultTableImportOptions('csv')), [encoding, setEncoding] = useState<TableImportEncoding>('auto');
  const [source, setSource] = useState<{ text: string; parsed: TableImportParsed } | null>(null), [mappings, setMappings] = useState<TableImportMapping[]>([]);
  const [targets, setTargets] = useState(columns), [plan, setPlan] = useState<TableImportPlan | null>(null), [serverReview, setServerReview] = useState<TableImportReview | null>(null);
  const [busy, setBusy] = useState<'file' | 'preview' | 'commit' | null>(null), [error, setError] = useState(''), [summary, setSummary] = useState<TableImportAppendSummary | null>(null);
  const request = useRef<AbortController | null>(null), token = useRef<string | null>(null), fileInput = useRef<HTMLInputElement>(null), discardCallback = useRef(onDiscard);
  useEffect(() => { discardCallback.current = onDiscard; }, [onDiscard]);
  useEffect(() => () => {
    request.current?.abort();
    const current = token.current; token.current = null;
    if (current) void (discardCallback.current ? discardCallback.current(current) : backendFetch(`${base}/table-import/plans/${encodeURIComponent(current)}`, { method: 'DELETE' })).catch(() => undefined);
  }, [base]);
  function discard() {
    const current = token.current; token.current = null; setPlan(null);
    if (current) void (onDiscard ? onDiscard(current) : backendFetch(`${base}/table-import/plans/${encodeURIComponent(current)}`, { method: 'DELETE' })).catch(() => undefined);
  }
  function invalidate() { request.current?.abort(); request.current = null; discard(); setServerReview(null); setError(''); setBusy(null); }
  async function loadFile(selected: File) {
    invalidate(); setSource(null); setFile(null);
    if (/\.(xls[xm]?|parquet|orc|zip)$/i.test(selected.name)) { setError('此格式尚未支持。请转换为 CSV、JSON、分隔文本或字面量 INSERT SQL 后导入。'); return; }
    if (selected.size > TABLE_IMPORT_LIMITS.bytes) { setError('文件最多 5 MiB。请拆分文件后再导入。'); return; }
    const controller = new AbortController(); request.current = controller; setBusy('file');
    try {
      const bytes = new Uint8Array(await selected.arrayBuffer());
      if (request.current !== controller || controller.signal.aborted) return;
      setFile({ name: selected.name, bytes }); setOptions({ ...defaultTableImportOptions(formatForName(selected.name)), sqlDialect: provider }); setStep('source');
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (request.current === controller && !controller.signal.aborted) setBusy(null); }
  }
  function parseSource() {
    invalidate();
    try {
      const text = sourceMode === 'file' ? file ? decodeTableImportBytes(file.bytes, encoding).text : '' : paste;
      if (!text) throw new Error('请先选择文件或粘贴数据。');
      const parsed = parseTableImport(text, options);
      setSource({ text, parsed });
      if (!parsed.errors.length) { setMappings(autoMapTableImportColumns(parsed.columns, targets)); setStep('mapping'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  async function review() {
    if (!source) return;
    invalidate();
    const controller = new AbortController(); request.current = controller; setBusy('preview');
    const input: TableImportInput = { schema, table, text: source.text, options, mappings };
    try {
      const response = onPreview ? await onPreview(input, controller.signal) : await backendFetch<TableImportPlan>(`${base}/table-import/plans`, { method: 'POST', body: JSON.stringify(input), signal: controller.signal });
      if (request.current !== controller || controller.signal.aborted) {
        void (onDiscard ? onDiscard(response.planId) : backendFetch(`${base}/table-import/plans/${encodeURIComponent(response.planId)}`, { method: 'DELETE' })).catch(() => undefined); return;
      }
      setServerReview(response.review); setTargets(response.review.targetColumns);
      if (response.review.validation.valid) { token.current = response.planId; setPlan(response); setStep('review'); }
      else void (onDiscard ? onDiscard(response.planId) : backendFetch(`${base}/table-import/plans/${encodeURIComponent(response.planId)}`, { method: 'DELETE' })).catch(() => undefined);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (request.current === controller && !controller.signal.aborted) setBusy(null); }
  }
  async function commit() {
    if (!plan || busy) return;
    const controller = new AbortController(); request.current = controller; setBusy('commit'); setError('');
    let completed: TableImportAppendSummary | undefined;
    try {
      const response = onAppend ? await onAppend(plan.planId, controller.signal) : await backendFetch<TableImportAppendSummary>(`${base}/table-import/plans/${encodeURIComponent(plan.planId)}/commit`, { method: 'POST', body: JSON.stringify({ confirm: true }), signal: controller.signal });
      if (request.current !== controller || controller.signal.aborted) return;
      completed = response; token.current = null; setPlan(null); setSummary(response); setStep('done');
    } catch (reason) {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : String(reason)); discard(); setStep('mapping'); }
    } finally { if (request.current === controller && !controller.signal.aborted) setBusy(null); }
    if (completed) onImported?.(completed);
  }
  function cancel() {
    const committing = busy === 'commit'; invalidate();
    if (committing) { setStep('mapping'); setError('请求已取消，未收到提交结果。请刷新目标表确认最终状态，再重新预览。'); }
  }
  function back() { invalidate(); setStep(step === 'review' ? 'mapping' : 'source'); }
  const localValidation = source ? validateTableImportMappings(source.parsed.columns, mappings, targets, provider) : null;
  const issues = [...(source?.parsed.errors ?? []), ...(serverReview?.validation.errors ?? localValidation?.errors ?? [])];
  const warnings = [...new Set([...(source?.parsed.warnings ?? []), ...(serverReview?.validation.warnings ?? [])])];
  return <section className={styles.panel} aria-label="表数据导入" aria-busy={!!busy}>
    <header className={styles.heading}><span className={styles.headingIcon}><FileArrowUp size={20} /></span><div><h2>导入表数据</h2><p><span>{schema}</span><ArrowRight size={10} /><strong>{table}</strong><span className={styles.appendBadge}>仅追加</span></p></div><span className={styles.limit}>5 MiB / 5000 行</span></header>
    <ol className={styles.steps} aria-label="导入进度">{STEPS.map(([value, label], index) => <li key={value} data-active={step === value} data-complete={STEPS.findIndex(([item]) => item === step) > index} aria-current={step === value ? 'step' : undefined}><span>{STEPS.findIndex(([item]) => item === step) > index ? <Check size={12} /> : index + 1}</span>{label}</li>)}</ol>
    <div className={styles.content}>
      {error && <div className={styles.error} role="alert"><WarningCircle size={15} /><span>{error}</span></div>}
      {step === 'source' && <>
        <div className={styles.sourceTabs}><button type="button" data-active={sourceMode === 'file'} onClick={() => { invalidate(); setSource(null); setSourceMode('file'); }}>选择文件</button><button type="button" data-active={sourceMode === 'text'} onClick={() => { invalidate(); setSource(null); setSourceMode('text'); }}>粘贴文本</button></div>
        {sourceMode === 'file' ? <div className={styles.dropzone} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const selected = event.dataTransfer.files[0]; if (selected) void loadFile(selected); }}>
          <FileArrowUp size={29} /><strong>{file ? file.name : '拖入文件，或选择本地文件'}</strong><p>{file ? `${(file.bytes.byteLength / 1024).toFixed(1)} KiB · 文件已在本地读取` : 'CSV、TSV、分隔文本、JSON / NDJSON 与 INSERT SQL'}</p><button type="button" className={styles.secondary} disabled={busy === 'file'} onClick={() => fileInput.current?.click()}>{busy === 'file' ? '正在读取…' : file ? '更换文件' : '选择文件'}</button><input className={styles.fileInput} ref={fileInput} type="file" accept=".csv,.tsv,.txt,.psv,.json,.jsonl,.ndjson,.sql" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void loadFile(selected); event.target.value = ''; }} />
        </div> : <textarea className={styles.paste} value={paste} onChange={(event) => { invalidate(); setSource(null); setPaste(event.target.value); }} placeholder={'id,name\n1,Ada\n2,Grace'} aria-label="粘贴待导入数据" spellCheck={false} />}
        <TableImportParseControls options={options} encoding={encoding} hasFile={sourceMode === 'file'} onEncoding={(value) => { invalidate(); setSource(null); setEncoding(value); }} onChange={(value) => { invalidate(); setSource(null); setOptions(value); }} />
        <Issues issues={source?.parsed.errors ?? []} />
      </>}
      {step === 'mapping' && source && <>
        <TableImportMappingEditor parsed={source.parsed} targets={targets} mappings={mappings} provider={provider} onChange={(value) => { invalidate(); setMappings(value); }} />
        <Issues issues={issues} />
        {warnings.length > 0 && <div className={styles.warnings}>{warnings.map((warning) => <p key={warning}><WarningCircle size={13} />{warning}</p>)}</div>}
        <TableImportPreviewGrid parsed={source.parsed} />
      </>}
      {step === 'review' && plan && <>
        <div className={styles.reviewHeading}><span><Check size={20} /></span><div><strong>服务器已校验本次导入</strong><p>确认后追加到当前表。所有批次处于同一事务，发生错误时整体回滚。</p></div></div>
        <div className={styles.reviewStats}><div><span>追加记录</span><strong>{plan.review.rowsToImport}</strong></div><div><span>映射字段</span><strong>{plan.review.validation.mappedColumns.length}</strong></div><div><span>写入方式</span><strong>INSERT</strong></div></div>
        <div className={styles.reviewMapping}>{plan.review.mappings.filter((mapping) => mapping.targetColumn).map((mapping) => <span key={mapping.sourceColumn}>{mapping.sourceColumn}<ArrowRight size={11} />{mapping.targetColumn}</span>)}</div>
        {warnings.length > 0 && <div className={styles.warnings}>{warnings.map((warning) => <p key={warning}><WarningCircle size={13} />{warning}</p>)}</div>}
        <TableImportPreviewGrid parsed={plan.review.parsed} />
        <p className={styles.hint}>本次审核绑定当前工作空间、会话、目标与数据，只能提交一次。修改数据或映射后需要重新审核。</p>
      </>}
      {step === 'done' && summary && <div className={styles.success} role="status"><span><Check size={29} /></span><h3>导入完成</h3><p>已向 <strong>{schema}.{table}</strong> 追加 <strong>{summary.rowsImported}</strong> 行。</p><small>事务已提交 · {summary.elapsedMs} ms</small></div>}
    </div>
    <footer className={styles.footer}><span>{busy === 'commit' ? <><SpinnerGap size={13} className={styles.spinner} />正在追加，等待事务提交…</> : busy === 'preview' ? <><SpinnerGap size={13} className={styles.spinner} />正在校验目标元数据与字段值…</> : step === 'review' ? '原表数据保留 · 不建表 · 不清表' : '完整范围：最多 256 列 / 100000 个单元格'}</span><div>
      {busy && <button type="button" className={styles.secondary} onClick={cancel}>取消请求</button>}
      {!busy && step !== 'source' && step !== 'done' && <button type="button" className={styles.secondary} onClick={back}>返回修改</button>}
      {onClose && <button type="button" className={styles.secondary} onClick={() => { cancel(); onClose(); }}>{step === 'done' ? '完成' : '关闭'}</button>}
      {step === 'source' && <button type="button" className={styles.primary} disabled={!!busy || (sourceMode === 'file' ? !file : !paste)} onClick={parseSource}>预览并映射<ArrowRight size={13} /></button>}
      {step === 'mapping' && <button type="button" className={styles.primary} disabled={!!busy || !localValidation?.valid || !!source?.parsed.errors.length} onClick={() => void review()}>服务器审核<ArrowRight size={13} /></button>}
      {step === 'review' && <button type="button" className={styles.primary} disabled={!!busy || !plan} onClick={() => void commit()}>确认追加 {plan?.review.rowsToImport} 行</button>}
      {step === 'done' && !onClose && <button type="button" className={styles.primary} onClick={() => { invalidate(); setSummary(null); setStep('source'); }}>继续导入</button>}
    </div></footer>
  </section>;
}
