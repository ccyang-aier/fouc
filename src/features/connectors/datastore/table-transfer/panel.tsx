'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowsLeftRight, CheckCircle, Warning, X } from '@phosphor-icons/react';
import type { RelationalTableStructure } from '@fouc/shared';
import { tableTransferInputSchema, validateTableTransferMapping, type TableTransferInput, type TableTransferPlan, type TableTransferProgress, type TableTransferResult } from '@fouc/shared/table-transfer';
import { autoTransferMappings, TransferMappingTable } from './mapping';
import styles from './table-transfer.module.css';

export interface TableTransferPanelProps {
  source: RelationalTableStructure; target: RelationalTableStructure; sourceLabel?: string; targetLabel?: string; className?: string;
  onPrepare: (input: TableTransferInput) => Promise<TableTransferPlan>;
  onExecute: (plan: TableTransferPlan, control: { signal: AbortSignal; onProgress: (progress: TableTransferProgress) => void }) => Promise<TableTransferResult>;
  onComplete?: (result: TableTransferResult) => void; onClose?: () => void;
}
export function TableTransferPanel(props: TableTransferPanelProps) { return <TransferEditor key={`${props.source.connectionId}/${props.source.schema}/${props.source.table}/${props.target.connectionId}/${props.target.schema}/${props.target.table}`} {...props} />; }
function TransferEditor({ source, target, sourceLabel, targetLabel, className = '', onPrepare, onExecute, onComplete, onClose }: TableTransferPanelProps) {
  const [input, setInput] = useState<TableTransferInput>(() => ({ mode: 'append', mappings: autoTransferMappings(source, target), maxRows: 20000, batchSize: 200, rowLimitMode: 'require-complete' }));
  const [plan, setPlan] = useState<TableTransferPlan | null>(null), [busy, setBusy] = useState<'prepare' | 'execute' | null>(null);
  const [progress, setProgress] = useState<TableTransferProgress | null>(null), [result, setResult] = useState<TableTransferResult | null>(null), [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false), [cancelRequested, setCancelRequested] = useState(false), [page, setPage] = useState<'mapping' | 'review'>('mapping');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const validation = useMemo(() => {
    const parsed = tableTransferInputSchema.safeParse(input), errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    for (const mapping of input.mappings) { const from = source.columns.find((column) => column.name === mapping.sourceColumn), to = target.columns.find((column) => column.name === mapping.targetColumn); if (from && to) { const error = validateTableTransferMapping(from, source.provider, to, target.provider, mapping); if (error) errors.push(`${from.name} → ${to.name}：${error}`); } }
    return errors;
  }, [source, target, input]);
  function update(next: TableTransferInput) { setInput(next); setPlan(null); setResult(null); setConfirmed(false); setError(''); }
  async function prepare() { setBusy('prepare'); setError(''); try { const next = await onPrepare(input); setPlan(next); setConfirmed(false); setPage('review'); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); } }
  async function execute() {
    if (!plan?.executable || !confirmed) return;
    const abort = new AbortController(); controller.current = abort; setBusy('execute'); setProgress(null); setResult(null); setError(''); setCancelRequested(false);
    try { const next = await onExecute(plan, { signal: abort.signal, onProgress: setProgress }); setResult(next); try { onComplete?.(next); } catch { setError('传输已结束，目标刷新失败；请手动重新读取目标。'); } }
    catch (reason) { setError(`${reason instanceof Error ? reason.message : String(reason)}；如请求中断，请重新读取目标确认事务结果`); }
    finally { controller.current = null; setBusy(null); }
  }
  function cancel() { setCancelRequested(true); controller.current?.abort(); }
  const phase = progress?.phase ?? 'reading', pending = Boolean(busy), completed = Boolean(result);
  return <section className={`${styles.panel} ${className}`} aria-label="跨连接表数据传输" aria-busy={pending}>
    <header className={styles.header}><div className={styles.title}><div className={styles.icon}><ArrowsLeftRight size={22} /></div><div><h2>跨连接数据传输</h2><p>追加到已有表 · 原生字段映射 · 单个目标事务</p></div></div>{onClose && <button type="button" aria-label="关闭数据传输" disabled={pending} onClick={onClose}><X size={17} /></button>}</header>
    <div className={styles.endpoints}><div><small>源连接 · {source.provider.toUpperCase()}</small><h3>{sourceLabel || source.connectionId || '当前源会话'}</h3><code>{source.schema}.{source.table}</code></div><ArrowRight size={21} /><div><small>目标连接 · {target.provider.toUpperCase()}</small><h3>{targetLabel || target.connectionId || '当前目标会话'}</h3><code>{target.schema}.{target.table}</code></div></div>
    <nav className={styles.tabs} aria-label="传输配置页"><button type="button" aria-current={page === 'mapping' ? 'page' : undefined} disabled={busy === 'execute'} onClick={() => setPage('mapping')}>字段映射 <span>{input.mappings.length}</span></button><button type="button" aria-current={page === 'review' ? 'page' : undefined} onClick={() => setPage('review')}>准备与执行</button><p>源总行数尚未读取</p></nav>
    {page === 'mapping' && <fieldset className={styles.config} disabled={pending || completed}><TransferMappingTable source={source} target={target} mappings={input.mappings} onChange={(mappings) => update({ ...input, mappings })} /><div className={styles.settings}><label>行数安全上限<input aria-label="传输行数安全上限" type="number" min={1} max={100000} value={input.maxRows} onChange={(event) => update({ ...input, maxRows: Number(event.target.value) })} /></label><label>每批读取行数<input aria-label="传输每批行数" type="number" min={1} max={1000} value={input.batchSize} onChange={(event) => update({ ...input, batchSize: Number(event.target.value) })} /></label><div className={styles.limit}><label><input aria-label="仅传输最多N行" type="checkbox" checked={input.rowLimitMode === 'first-rows'} onChange={(event) => update({ ...input, rowLimitMode: event.target.checked ? 'first-rows' : 'require-complete' })} />仅传输最多 N 行</label><p>{input.rowLimitMode === 'first-rows' ? `明确选择限量追加：源还有更多时，也只提交前 ${input.maxRows.toLocaleString()} 行。` : '默认要求传完：额外探测一行，超过上限会回滚整个目标事务。'}</p></div></div><p className={styles.hint}>源读取没有跨批一致性快照。执行前请稳定源数据；二进制保留原字节，数字使用原始精度绑定。不会清表或处理重复键。</p></fieldset>}
    {page === 'review' && <div className={styles.review}>{plan ? <><div className={styles.planSummary}><b>{plan.executable ? '传输计划已准备' : '映射需要调整'}</b><span>{plan.columns.length} 个字段 · 每批最多 {plan.effectiveBatchSize} 行 · {plan.input.rowLimitMode === 'first-rows' ? `仅前 ${plan.input.maxRows.toLocaleString()} 行` : '超过行数上限则回滚'}</span></div><div className={styles.reviewGrid}><div><h4>源读取 SQL</h4><pre aria-label="传输源读取SQL">{plan.sourcePreviewSql}</pre><h4>目标参数化追加</h4><pre aria-label="传输目标写入SQL">{plan.targetPreviewSql}</pre><p className={styles.hint}>源是否有更多行：未知。执行会读取最多 N + 1 行探测，不在准备阶段猜测总量。</p></div><aside><h4>影响与限制</h4>{plan.issues.map((issue, index) => <p key={index} className={issue.severity === 'error' ? styles.errorIssue : styles.warning}><Warning size={14} /><span>{issue.targetColumn && <b>{issue.targetColumn} · </b>}{issue.message}</span></p>)}</aside></div>
      {plan.executable && !result && busy !== 'execute' && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />确认源和目标、字段映射及{plan.input.rowLimitMode === 'first-rows' ? '限量追加' : '完整传输'}规则</label>}
    </> : <div className={styles.empty}><ArrowsLeftRight size={32} /><h3>先准备传输计划</h3><p>核对目标生成列、缺失 DEFAULT、类型兼容和参数批次后，再开始写入。</p></div>}
    {(progress || busy === 'execute') && <div className={styles.progress} role="status" aria-label="表传输进度"><div className={styles.phase}><span data-active={phase === 'reading'}>读取源</span><ArrowRight size={13} /><span data-active={phase === 'writing'}>写入目标事务</span><ArrowRight size={13} /><span data-active={phase === 'committing' || phase === 'completed'}>提交</span></div><div className={styles.metrics}><span><b>{(progress?.rowsRead ?? 0).toLocaleString()}</b>行已读取</span><span><b>{(progress?.rowsWritten ?? 0).toLocaleString()}</b>行已写入事务</span><span><b>{progress?.batchesWritten ?? 0}</b>个写入批次</span><span><b>{formatBytes(progress?.bytesRead ?? 0)}</b>源数据</span></div>{busy === 'execute' && <div className={styles.indeterminate}><i /></div>}<p>{cancelRequested ? '已请求取消；等待当前读写批次结束后回滚。' : phase === 'committing' ? '正在提交目标事务，等待数据库确认…' : phase === 'rolling-back' ? '失败 / 取消后已请求回滚目标事务。' : phase === 'completed' ? '目标事务已确认提交。' : '写入事务中的行尚未提交；行数上限不代表源总行数。'}</p></div>}
    {result && <div className={result.status === 'committed' ? styles.resultSuccess : styles.resultError} role="status"><h3>{result.status === 'committed' ? result.sourceHasMore ? '限量传输已提交，源仍有更多行' : '读取范围已传输并提交' : result.status === 'cancelled' ? '传输已取消' : result.status === 'unknown' ? '事务结果待确认' : '传输失败'}</h3><p>{result.transaction === 'committed' ? `${result.rowsCommitted?.toLocaleString()} 行已提交 · ${result.batchesWritten} 批 · ${(result.elapsedMs / 1000).toFixed(1)} 秒` : result.transaction === 'unknown' ? '提交阶段连接中断；请重新读取目标核对，暂不要直接重试。' : result.transaction === 'rolled-back' ? '目标事务已请求回滚，未确认提交任何本次传输行。' : '目标事务尚未开始。'}</p>{result.error && <p>{result.error}</p>}</div>}</div>}
    {validation.length > 0 && <div className={styles.validation} role="alert">{validation.slice(0, 3).map((message, index) => <p key={index}>{message}</p>)}{validation.length > 3 && <p>另有 {validation.length - 3} 项待修正</p>}</div>}{error && <p role="alert" className={styles.error}>{error}</p>}
    <footer className={styles.footer}><span>{busy === 'prepare' ? '正在核对原生元数据…' : busy === 'execute' ? '目标事务执行中' : result ? '本次传输已结束，请重新读取目标数据' : <><CheckCircle size={13} />准备阶段不会写入数据库</>}</span>{busy === 'execute' ? <button type="button" className={styles.cancel} disabled={cancelRequested} onClick={cancel}>{cancelRequested ? '正在取消…' : '取消并回滚'}</button> : <><button type="button" disabled={pending || completed || Boolean(validation.length)} onClick={() => void prepare()}>准备计划</button><button type="button" className={styles.primary} disabled={pending || completed || !plan?.executable || !confirmed} onClick={() => void execute()}>开始追加传输</button></>}</footer>
  </section>;
}
function formatBytes(value: number): string { return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MiB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${value} B`; }
