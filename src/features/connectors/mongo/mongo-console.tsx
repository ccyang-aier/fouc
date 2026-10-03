import { useEffect, useRef, useState } from 'react';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import type { MongoCommandResult } from '@fouc/shared/mongo';
import { backendFetch } from '@/lib/backend';
import { formatJsonSource } from '@fouc/shared';
import styles from './mongo.module.css';

export function MongoConsole({ base, database }: { base: string; database: string }) {
  const [text, setText] = useState('{"ping": 1}'), [result, setResult] = useState<MongoCommandResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setResult(null);
    try { const response = await backendFetch<MongoCommandResult>(`${base}/command`, { method: 'POST', body: JSON.stringify({ database, command: text, limit: 50 }), signal: controller.signal }); if (!controller.signal.aborted) setResult(response); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (active.current === controller) { setBusy(false); active.current = null; } }
  }
  function cancel() { active.current?.abort(); active.current = null; setBusy(false); setError('查询已取消。'); }
  return <div className={styles.console}><div className={styles.consoleHeader}><div><h3>只读命令</h3><p>Extended JSON 命令文档 · 不执行 JavaScript</p></div><button className={busy ? styles.smallButton : styles.primaryButton} onClick={() => busy ? cancel() : void run()}>{busy ? <Stop size={14} /> : <Play size={14} weight="fill" />}{busy ? '取消' : '运行'}</button></div><textarea aria-label="MongoDB 只读命令" className={styles.commandInput} value={text} spellCheck={false} onChange={event => setText(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!busy) void run(); } }} /><p className={styles.precision}>支持 find、aggregate、count、distinct、统计与 queryPlanner。$out、$merge、$where 和写入命令会被拦截。</p>{error && <p role="alert" className={styles.error}>{error}</p>}{busy && <div role="status" className={styles.loading}>正在读取 {database}…</div>}{result && <div className={styles.commandResult}><div className={styles.resultCaption}><span>{result.commandName}</span><span>{result.elapsedMs.toFixed(1)} ms{result.documents.length ? ` · ${result.documents.length} 个文档` : ''}{result.hasMore ? ' · 更多结果未展示' : ''}</span></div>{result.warnings.map(warning => <p className={styles.notice} key={warning}>{warning}</p>)}<pre className={styles.json}>{result.value ? formatJsonSource(result.value, 2) : `[\n${result.documents.map(document => formatJsonSource(document, 2)).join(',\n')}\n]`}</pre></div>}</div>;
}
