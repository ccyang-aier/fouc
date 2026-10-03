'use client';

import { useEffect, useState } from 'react';
import { Graph } from '@phosphor-icons/react';
import type { ErDiagramLoadResult, ErDiagramNode } from '@fouc/shared/er-diagram';
import { backendFetch } from '@/lib/backend';
import { SchemaDiagramPanel } from './diagram';
import styles from './relational.module.css';

export function SchemaDiagramView({ base, schema, onOpenTable, onOpenQuery }: {
  base: string;
  schema: string;
  onOpenTable: (node: ErDiagramNode) => void;
  onOpenQuery: (sql: string) => void;
}) {
  const [result, setResult] = useState<ErDiagramLoadResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<ErDiagramLoadResult>(`${base}/diagram`, {
      method: 'POST', signal: controller.signal, body: JSON.stringify({ schema }),
    }).then(value => {
      if (!controller.signal.aborted) { setResult(value); setError(''); }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, schema, revision]);
  function refresh() { setLoading(true); setError(''); setRevision(value => value + 1); }
  return result ? <SchemaDiagramPanel model={result.model} title={`${schema} · 关系图`} loading={loading} error={error} onRefresh={refresh} onOpenTable={onOpenTable} onOpenQuery={onOpenQuery} />
    : <div className={styles.empty} role={error ? 'alert' : 'status'}><Graph size={30} /><strong>{error || '正在读取原生表结构与外键…'}</strong><span>关系来自数据库实际目录。</span>{error && <button type="button" onClick={refresh}>重新读取</button>}</div>;
}
