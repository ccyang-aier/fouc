'use client';

import { useEffect, useState } from 'react';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import type { RelationalSession, RelationalTableStructure } from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { SqlDialog } from './sql-library-dialog';
import { TestDataPanel } from './test-data';
import styles from './test-data-action.module.css';

interface Props {
  session: RelationalSession;
  base: string;
  schema: string;
  table: string;
  writable: boolean;
  disabled: boolean;
  onUnlock: () => Promise<void>;
  onImported: () => void;
  onBusyChange: (value: boolean) => void;
}

export function TestDataAction(props: Props) {
  const [target, setTarget] = useState<{ schema: string; table: string } | null>(null);
  const [busy, setBusy] = useState(false);
  function close() { if (!busy) setTarget(null); }
  function changeBusy(value: boolean) { setBusy(value); props.onBusyChange(value); }
  return <>
    <button type="button" className="fouc-menu-item" aria-label="生成当前表测试数据" title="基于真实字段生成测试数据 · 先预览再确认追加" disabled={props.disabled || !props.schema || !props.table} onClick={() => setTarget({ schema: props.schema, table: props.table })}><Database size={16}/><span>生成数据</span></button>
    {target && <SqlDialog title="生成测试数据" className={styles.dialog} busy={busy} onClose={close}>
      <TestDataSource key={`${props.base}\0${target.schema}\0${target.table}`} {...props} {...target} onBusyChange={changeBusy} onClose={close}/>
    </SqlDialog>}
  </>;
}

function TestDataSource({ base, schema, table, writable, onUnlock, onBusyChange, onImported, onClose }: Props & { onClose: () => void }) {
  const [structure, setStructure] = useState<RelationalTableStructure | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<RelationalTableStructure>(`${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setStructure(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => controller.abort();
  }, [base, schema, table, revision]);

  if (!structure) return <div className={styles.loading} aria-busy={!error}>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => { setError(''); setRevision(value => value + 1); }}>重试加载真实结构</button></> : <p role="status">正在加载真实字段、默认值与约束…</p>}
  </div>;
  return <TestDataPanel base={base} structure={structure} writable={writable} onUnlock={onUnlock} onBusyChange={onBusyChange} onImported={onImported} onClose={onClose}/>;
}
