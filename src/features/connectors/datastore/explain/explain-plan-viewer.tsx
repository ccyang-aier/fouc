'use client';

import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { BracketsCurly } from '@phosphor-icons/react/dist/csr/BracketsCurly';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { FlowArrow } from '@phosphor-icons/react/dist/csr/FlowArrow';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { TreeStructure } from '@phosphor-icons/react/dist/csr/TreeStructure';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { parseExplainResult } from './parse-plan';
import { buildPlanCanvas, parsePlanNumber } from './plan-canvas';
import { ExplainPlanDiagram } from './plan-diagram';
import { PlanNodeDetails } from './plan-details';
import { ExplainPlanTree } from './plan-tree';
import { planNodeMatches } from './plan-presentation';
import { flattenExplainPlanNodes, type ExplainPlanViewerProps } from './types';
import styles from './explain.module.css';

type PlanView = 'diagram' | 'tree' | 'summary' | 'raw';
const VIEWS = [{ id: 'diagram', label: '流程图', icon: FlowArrow }, { id: 'tree', label: '计划树', icon: TreeStructure }, { id: 'summary', label: '节点概览', icon: ChartBar }, { id: 'raw', label: '原始计划', icon: BracketsCurly }] as const;
const PROVIDERS = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlite: 'SQLite' };
function serializePlan(raw: unknown): string { return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2) ?? ''; }

/** Estimated native EXPLAIN only: the caller supplies a scoped session result, never an ANALYZE result. */
export function ExplainPlanViewer({ provider, result, loading = false, error, onRetry }: ExplainPlanViewerProps) {
  const id = useId();
  const [view, setView] = useState<PlanView>('diagram');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<{ result: ExplainPlanViewerProps['result']; id: string } | null>(null);
  const [collapseState, setCollapsed] = useState<{ result: ExplainPlanViewerProps['result']; ids: Set<string> } | null>(null);
  const [copyStatus, setCopyState] = useState<{ result: ExplainPlanViewerProps['result']; status: 'copied' | 'failed' } | null>(null);
  const copyState = copyStatus?.result === result ? copyStatus.status : 'idle';
  const plan = useMemo(() => result ? parseExplainResult(provider, result) : null, [provider, result]);
  const nodes = useMemo(() => flattenExplainPlanNodes(plan?.nodes ?? []), [plan]);
  const layout = useMemo(() => buildPlanCanvas(plan?.nodes ?? []), [plan]);
  const selected = layout.nodes.find((node) => node.node.id === (selection?.result === result ? selection.id : undefined)) ?? layout.nodes[0];
  const collapsed = collapseState?.result === result ? collapseState.ids : new Set<string>();
  const filtered = useMemo(() => nodes.filter((node) => planNodeMatches(node, search)), [nodes, search]);
  const raw = useMemo(() => view === 'raw' && plan ? serializePlan(plan.raw) : '', [view, plan]);
  const warnings = [...(plan?.warnings ?? []), ...(result?.messages.filter((message) => /warning|error/i.test(message.severity)).map((message) => message.message) ?? [])];
  if (result?.truncated || result?.hasMore) warnings.push('服务器返回的计划已截断，以下信息只覆盖已返回部分。');
  function select(nodeId: string) { setSelection({ result, id: nodeId }); }
  function toggle(nodeId: string) {
    const ids = new Set(collapsed);
    if (ids.has(nodeId)) ids.delete(nodeId); else ids.add(nodeId);
    setCollapsed({ result, ids });
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % VIEWS.length : event.key === 'ArrowLeft' ? (index + VIEWS.length - 1) % VIEWS.length : event.key === 'Home' ? 0 : event.key === 'End' ? VIEWS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setView(VIEWS[next].id);
    const tabs = event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next].focus();
  }
  async function copy() {
    if (!plan) return;
    try { await navigator.clipboard.writeText(serializePlan(plan.raw)); setCopyState({ result, status: 'copied' }); }
    catch { setCopyState({ result, status: 'failed' }); }
  }
  const rootCost = plan?.nodes.map((node) => parsePlanNumber(node.cost)).filter((value): value is number => value !== undefined).reduce((sum, value) => sum + value, 0);
  return <section className={styles.viewer} aria-label="SQL 执行计划" aria-busy={loading}>
    <header className={styles.header}>
      <div className={styles.title}><FlowArrow size={16} /><strong>执行计划</strong><span>{PROVIDERS[provider]}</span><span className={styles.estimated}>预计 · 不执行查询</span></div>
      {onRetry && <button type="button" className={styles.iconButton} disabled={loading} onClick={onRetry} aria-label="重新生成执行计划" title="重新生成执行计划"><ArrowClockwise size={15} /></button>}
    </header>
    {error ? <div className={styles.state} role="alert"><WarningCircle size={25} /><strong>执行计划生成失败</strong><p>{error}</p>{onRetry && <button type="button" className={styles.retry} disabled={loading} onClick={onRetry}>重试</button>}</div>
      : loading && !result ? <div className={styles.state} role="status"><SpinnerGap className={styles.spinner} size={24} /><strong>正在获取服务器计划</strong><p>数据库将分析查询结构，返回预计执行路径。</p></div>
        : !plan ? <div className={styles.state}><FlowArrow size={27} /><strong>查看查询的执行路径</strong><p>生成执行计划后，可检查索引、连接顺序与预计成本。</p></div>
          : <>
            <div className={styles.toolbar}>
              <div className={styles.tabs} role="tablist" aria-label="计划视图">{VIEWS.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-${item.id}`} aria-controls={`${id}-content`} aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1} data-active={view === item.id} onClick={() => setView(item.id)} onKeyDown={(event) => navigateTabs(event, index)}><item.icon size={14} /><span>{item.label}</span></button>)}</div>
              {view !== 'raw' && <label className={styles.search}><MagnifyingGlass size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索节点、表或索引" aria-label="搜索执行计划节点" /><span>{search.trim() ? `${filtered.length}/` : ''}{nodes.length}</span></label>}
              {view === 'tree' && <button type="button" className={styles.textButton} onClick={() => setCollapsed({ result, ids: collapsed.size ? new Set() : new Set(nodes.filter((node) => node.children.length).map((node) => node.id)) })}>{collapsed.size ? '全部展开' : '全部收起'}</button>}
              {view === 'raw' && <button type="button" className={styles.textButton} onClick={copy}>{copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}{copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败，重试' : '复制原始计划'}</button>}
            </div>
            {warnings.length > 0 && <div className={styles.warningBar} role="status"><WarningCircle size={14} /><span>{[...new Set(warnings)].join(' ')}</span></div>}
            {loading && <div className={styles.refreshing} role="status"><SpinnerGap className={styles.spinner} size={13} />正在更新计划…</div>}
            <div id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${view}`} className={styles.body}>
              {view === 'raw' ? <pre className={styles.raw}><code>{raw}</code></pre> : <>
                <div className={styles.primary}>
                  {!nodes.length ? <div className={styles.state}><BracketsCurly size={24} /><strong>原始计划已返回</strong><p>当前结构无法静态识别，请切换到原始计划查看。</p><button type="button" className={styles.retry} onClick={() => setView('raw')}>查看原始计划</button></div>
                    : view === 'diagram' ? <ExplainPlanDiagram layout={layout} selectedId={selected?.node.id} onSelect={select} search={search} />
                      : !filtered.length ? <div className={styles.state}><MagnifyingGlass size={23} /><strong>没有匹配的节点</strong><p>尝试表名、索引名或操作类型。</p><button type="button" className={styles.retry} onClick={() => setSearch('')}>清除搜索</button></div>
                        : view === 'tree' ? <ExplainPlanTree nodes={plan.nodes} selectedId={selected?.node.id} onSelect={select} collapsed={collapsed} onToggle={toggle} search={search} />
                          : <div className={styles.summary}>
                            <div className={styles.summaryMetrics}><div><span>计划节点</span><strong>{nodes.length}</strong></div><div><span>根节点预计成本</span><strong>{rootCost === undefined || !plan.nodes.some((node) => node.cost !== undefined) ? '未提供' : rootCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div><div><span>返回形式</span><strong>{plan.format === 'json' ? 'JSON' : '原生表格'}</strong></div></div>
                            <table className={styles.summaryTable}><thead><tr><th>服务器操作</th><th>表 / 索引</th><th>预计成本</th><th>预计行数</th></tr></thead><tbody>{filtered.map((node) => <tr key={node.id} data-selected={node.id === selected?.node.id}><td><button type="button" onClick={() => select(node.id)}>{node.nodeType}</button></td><td>{node.relation || '—'}{node.index && <small>{node.index}</small>}</td><td>{node.cost ?? '未提供'}</td><td>{node.rows ?? '未提供'}</td></tr>)}</tbody></table>
                          </div>}
                </div>
                {nodes.length > 0 && <PlanNodeDetails selected={selected} />}
              </>}
            </div>
            <footer className={styles.footer}><span>{nodes.length} 个节点 · {result?.executionTimeMs.toFixed(0)} ms 计划请求</span><span>成本为服务器估算值，不能视为实际耗时。</span></footer>
          </>}
  </section>;
}
