'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle, Code, Copy, Eye, LockKey, ShieldCheck, Warning } from '@phosphor-icons/react';
import type { RelationalProvider } from '@fouc/shared';
import type { SqlMutationCommitResult, SqlMutationInput, SqlMutationPrepared } from '@fouc/shared/sql-mutation';
import { MutationRowDiff } from './row-diff';
import styles from './sql-mutation.module.css';

export interface SqlMutationPanelProps {
  sessionId: string;
  provider: RelationalProvider;
  schema: string;
  sql: string;
  writable: boolean;
  className?: string;
  onPreview: (input: SqlMutationInput, control: { signal: AbortSignal }) => Promise<SqlMutationPrepared>;
  onCommit: (planId: string, control: { signal: AbortSignal }) => Promise<SqlMutationCommitResult>;
  onUnlock?: () => void | Promise<void>;
  onDiscard?: (planId: string) => void | Promise<void>;
  onCommitted?: (result: SqlMutationCommitResult) => void;
  onClose?: () => void;
}

export function SqlMutationPanel(props: SqlMutationPanelProps) {
  return <MutationPanel key={JSON.stringify([props.sessionId, props.schema, props.sql])} {...props} />;
}

function MutationPanel({ provider, schema, sql, writable, className = '', onPreview, onCommit, onUnlock, onDiscard, onCommitted, onClose }: SqlMutationPanelProps) {
  const editorId = useId();
  const [draft, setDraft] = useState(sql), [maxRows, setMaxRows] = useState(200);
  const [prepared, setPrepared] = useState<SqlMutationPrepared | null>(null);
  const [result, setResult] = useState<SqlMutationCommitResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | 'unlock' | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [rowIndex, setRowIndex] = useState(0), [changesOnly, setChangesOnly] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef<AbortController | null>(null), planId = useRef<string | null>(null);
  const handlers = useRef({ onDiscard });
  useEffect(() => { handlers.current = { onDiscard }; }, [onDiscard]);
  useEffect(() => () => {
    request.current?.abort();
    const pending = planId.current;
    if (pending) void Promise.resolve().then(() => handlers.current.onDiscard?.(pending)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!prepared?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [prepared?.expiresAt]);
  const expired = Boolean(prepared?.expiresAt && now >= prepared.expiresAt);
  const consumed = Boolean(result);
  const review = prepared?.review;

  function discard(): void {
    const pending = planId.current;
    if (pending) void Promise.resolve().then(() => onDiscard?.(pending)).catch(() => undefined);
    planId.current = null;
    setPrepared(null);
    setResult(null);
    setConfirmed(false);
    setNotice('');
    setError('');
  }

  async function preview(): Promise<void> {
    discard();
    const controller = new AbortController();
    request.current = controller;
    setBusy('preview');
    setCancelRequested(false);
    try {
      const next = await onPreview({ schema, sql: draft, maxRows }, { signal: controller.signal });
      if (controller.signal.aborted) {
        if (next.planId) await onDiscard?.(next.planId);
        setNotice('预览已取消');
        return;
      }
      setPrepared(next);
      planId.current = next.planId;
      setNow(Date.now());
      setRowIndex(0);
      setChangesOnly(next.review.operation === 'update');
      setNotice(next.review.executable ? '只读预览完成，尚未执行写入' : '已完成只读审查，此范围没有可执行计划');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      else setNotice('预览已取消');
    } finally { request.current = null; setBusy(null); setCancelRequested(false); }
  }

  async function unlock(): Promise<void> {
    setBusy('unlock');
    setError('');
    try {
      await onUnlock?.();
      discard();
      setNotice('已请求解锁；请基于当前连接重新预览并确认');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(null); }
  }

  async function commit(): Promise<void> {
    if (!prepared?.planId || !confirmed || !writable || expired || consumed) return;
    const controller = new AbortController();
    request.current = controller;
    const token = prepared.planId;
    planId.current = null;
    setBusy('commit');
    setCancelRequested(false);
    setError('');
    try {
      const next = await onCommit(token, { signal: controller.signal });
      setResult(next);
      setConfirmed(false);
      if (next.outcome === 'committed') {
        try { onCommitted?.(next); }
        catch { setNotice('事务已提交，刷新反馈失败；请手动重新读取数据'); }
      }
    } catch (reason) {
      // A disconnected HTTP response cannot establish whether COMMIT reached the server.
      setResult({ outcome: 'unknown', affectedRows: null, matchedRows: prepared.review.matchedRows, executionTimeMs: 0, error: reason instanceof Error ? reason.message : String(reason) });
      setConfirmed(false);
    } finally { request.current = null; setBusy(null); setCancelRequested(false); }
  }

  async function copy(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); setNotice('SQL 已复制'); }
    catch { setError('复制失败，请检查剪贴板权限'); }
  }

  return <section className={`${styles.panel} ${className}`} aria-label="SQL 写操作审查" aria-busy={Boolean(busy)}>
    <header className={styles.header}>
      <div className={styles.title}><ShieldCheck size={24} /><div><h2>审查 SQL 变更</h2><p>{provider.toUpperCase()}<span>{schema}</span><span>{writable ? '连接已解锁' : '连接只读'}</span></p></div></div>
      {onClose && <button type="button" disabled={Boolean(busy)} onClick={onClose}>关闭</button>}
    </header>
    <div className={styles.editor}>
      <label htmlFor={editorId}>当前语句</label>
      <textarea id={editorId} aria-label="需要审查的 SQL" value={draft} disabled={Boolean(busy)} onChange={(event) => { discard(); setDraft(event.target.value); }} spellCheck={false} />
      {draft.length > 65536 && <p className={styles.alert} role="alert">单条审查 SQL 最多 65536 字符，请缩小语句。</p>}
      <div className={styles.editorActions}>
        <label>最多目标行<select aria-label="SQL 预览目标行限制" value={maxRows} disabled={Boolean(busy)} onChange={(event) => { discard(); setMaxRows(Number(event.target.value)); }}><option value={50}>50</option><option value={200}>200</option><option value={500}>500</option></select></label>
        <span>预览不会执行 INSERT / UPDATE / DELETE</span>
        <button type="button" className={styles.primary} disabled={Boolean(busy) || !draft.trim() || draft.length > 65536} onClick={() => void preview()}><Eye size={16} />{busy === 'preview' ? '只读预览中…' : '生成只读预览'}</button>
      </div>
    </div>
    {error && <p className={styles.alert} role="alert"><Warning size={16} />{error}</p>}
    {busy === 'preview' && <div className={styles.loading} role="status"><div /><div /><p>正在执行原生 SELECT、计算范围并核对元数据…</p></div>}
    {review && <div className={styles.review}>
      <div className={styles.reviewHeader}>
        <div><span>{review.operation.toUpperCase()}</span><h3>{review.schema}.{review.table}</h3></div>
        <dl><div><dt>目标范围</dt><dd>{review.matchedRows.toLocaleString()} 行</dd></div><div><dt>已知值变化</dt><dd>{review.changedRows === null ? '未完整计算' : `${review.changedRows.toLocaleString()} 行`}</dd></div><div><dt>执行计划</dt><dd>{consumed ? '已使用' : expired ? '已过期' : prepared.planId ? '一次有效' : '不可执行'}</dd></div></dl>
      </div>
      {review.issues.length > 0 && <div className={styles.alert} role="alert">{review.issues.join('；')}</div>}
      <div className={styles.compareHead}>
        <label>查看行<select aria-label="选择 SQL 对照预览行" value={rowIndex} disabled={!review.rows.length} onChange={(event) => setRowIndex(Number(event.target.value))}>{review.rows.map((_, index) => <option key={index} value={index}>第 {index + 1} 行</option>)}</select></label>
        <span>{review.matchedRows > review.sampleLimit ? `展示前 ${review.sampleLimit} 行；${review.executable ? `执行计划核对全部 ${review.matchedRows} 行` : '没有生成执行计划'}` : `${review.rows.length} 行旧值 / 新值对照`}</span>
        <label><input type="checkbox" checked={changesOnly} onChange={(event) => setChangesOnly(event.target.checked)} />仅看变化</label>
      </div>
      <MutationRowDiff review={review} rowIndex={rowIndex} changesOnly={changesOnly} />
      <div className={styles.scripts}>
        <details><summary><Code size={15} />实际提交 SQL</summary><button type="button" onClick={() => void copy(review.writeSql)}><Copy size={13} />复制</button><pre aria-label="实际提交 SQL">{review.writeSql}</pre></details>
        <details><summary><Code size={15} />只读预览与范围计数</summary><button type="button" onClick={() => void copy(review.previewSql)}><Copy size={13} />复制预览</button><pre aria-label="只读改写 SELECT">{review.previewSql}</pre><pre aria-label="原生范围计数 SQL">{review.countSql}</pre></details>
      </div>
      <details className={styles.limitations}><summary><Warning size={14} />支持范围与执行语义</summary><ul>{review.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>
      {review.executable && !consumed && !expired && writable && <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={(event) => setConfirmed(event.target.checked)} />我已审查目标行、旧值 / 新值与实际 SQL，确认提交此一次性计划</label>}
      {result && <div className={result.outcome === 'committed' ? styles.success : styles.alert} role="status"><div><h4>{outcomeTitle(result.outcome)}</h4><p>{result.error || `${result.matchedRows} 行审查范围 · 驱动报告影响 ${result.affectedRows} 行 · ${result.executionTimeMs} ms`}</p></div></div>}
    </div>}
    {!review && !busy && <div className={styles.empty}><Eye size={28} /><h3>先核对数据，再决定执行</h3><p>支持单表 VALUES、确定性 UPDATE 赋值与 DELETE WHERE。无法证明完整影响的语句会说明原因。</p></div>}
    <footer className={styles.footer}>
      <span role="status">{cancelRequested ? '已请求取消，等待当前语句结束后检查回滚' : notice || (expired ? '计划已过期，请重新预览' : prepared?.expiresAt ? `计划剩余 ${Math.max(0, Math.ceil((prepared.expiresAt - now) / 1000))} 秒` : '只读预览与确认执行使用同一个连接权限入口')}</span>
      {busy && busy !== 'unlock' && <button type="button" disabled={cancelRequested} onClick={() => { request.current?.abort(); setCancelRequested(true); }}>取消{busy === 'preview' ? '预览' : '执行'}</button>}
      {!writable && onUnlock && <button type="button" disabled={Boolean(busy)} onClick={() => void unlock()}><LockKey size={15} />解锁写入</button>}
      <button type="button" className={styles.commit} disabled={Boolean(busy) || !writable || !confirmed || !prepared?.planId || expired || consumed} onClick={() => void commit()}><CheckCircle size={16} />{busy === 'commit' ? '核对并提交中…' : '确认单事务提交'}</button>
    </footer>
  </section>;
}

function outcomeTitle(outcome: SqlMutationCommitResult['outcome']): string {
  return ({ committed: '事务已提交', conflict: '数据或结构冲突，未提交本次变更', cancelled: '已取消，事务已请求回滚', 'rolled-back': '执行失败，事务已请求回滚', unknown: '提交结果不确定，请先重新读取数据' })[outcome];
}
