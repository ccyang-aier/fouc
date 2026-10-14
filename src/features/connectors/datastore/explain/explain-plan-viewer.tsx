'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './explain-plan-viewer.messages';
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
const VIEWS = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { id: 'diagram', label: tConnector('flowchart'), icon: FlowArrow },
    { id: 'tree', label: tConnector('planTree'), icon: TreeStructure },
    { id: 'summary', label: tConnector('nodeOverview'), icon: ChartBar },
    { id: 'raw', label: tConnector('rawPlan'), icon: BracketsCurly },
  ] as const;
};
const PROVIDERS = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlite: 'SQLite' };
function serializePlan(raw: unknown): string {
  return typeof raw === 'string' ? raw : (JSON.stringify(raw, null, 2) ?? '');
}
/** Estimated native EXPLAIN only: the caller supplies a scoped session result, never an ANALYZE result. */
export function ExplainPlanViewer({
  provider,
  result,
  loading = false,
  error,
  onRetry,
}: ExplainPlanViewerProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId();
  const [view, setView] = useState<PlanView>('diagram');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<{
    result: ExplainPlanViewerProps['result'];
    id: string;
  } | null>(null);
  const [collapseState, setCollapsed] = useState<{
    result: ExplainPlanViewerProps['result'];
    ids: Set<string>;
  } | null>(null);
  const [copyStatus, setCopyState] = useState<{
    result: ExplainPlanViewerProps['result'];
    status: 'copied' | 'failed';
  } | null>(null);
  const copyState = copyStatus?.result === result ? copyStatus.status : 'idle';
  const plan = useMemo(
    () => (result ? parseExplainResult(provider, result, locale) : null),
    [provider, result, locale],
  );
  const nodes = useMemo(() => flattenExplainPlanNodes(plan?.nodes ?? []), [plan]);
  const layout = useMemo(() => buildPlanCanvas(plan?.nodes ?? []), [plan]);
  const selected =
    layout.nodes.find(
      (node) => node.node.id === (selection?.result === result ? selection.id : undefined),
    ) ?? layout.nodes[0];
  const collapsed = collapseState?.result === result ? collapseState.ids : new Set<string>();
  const filtered = useMemo(
    () => nodes.filter((node) => planNodeMatches(node, search)),
    [nodes, search],
  );
  const raw = useMemo(() => (view === 'raw' && plan ? serializePlan(plan.raw) : ''), [view, plan]);
  const warnings = [
    ...(plan?.warnings ?? []),
    ...(result?.messages
      .filter((message) => /warning|error/i.test(message.severity))
      .map((message) => message.message) ?? []),
  ];
  if (result?.truncated || result?.hasMore)
    warnings.push(tConnector('theServerTruncatedThePlanTheInformationBelowCoversOnly'));
  function select(nodeId: string) {
    setSelection({ result, id: nodeId });
  }
  function toggle(nodeId: string) {
    const ids = new Set(collapsed);
    if (ids.has(nodeId)) ids.delete(nodeId);
    else ids.add(nodeId);
    setCollapsed({ result, ids });
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % VIEWS(locale).length
        : event.key === 'ArrowLeft'
          ? (index + VIEWS(locale).length - 1) % VIEWS(locale).length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? VIEWS(locale).length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setView(VIEWS(locale)[next].id);
    const tabs = event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next].focus();
  }
  async function copy() {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(serializePlan(plan.raw));
      setCopyState({ result, status: 'copied' });
    } catch {
      setCopyState({ result, status: 'failed' });
    }
  }
  const rootCost = plan?.nodes
    .map((node) => parsePlanNumber(node.cost))
    .filter((value): value is number => value !== undefined)
    .reduce((sum, value) => sum + value, 0);
  return (
    <section
      className={styles.viewer}
      aria-label={tConnector('sqlExecutionPlan')}
      aria-busy={loading}
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <FlowArrow size={16} />
          <strong>{tConnector('executionPlan')}</strong>
          <span>{PROVIDERS[provider]}</span>
          <span className={styles.estimated}>{tConnector('estimatedDoesNotExecuteTheQuery')}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            className={styles.iconButton}
            disabled={loading}
            onClick={onRetry}
            aria-label={tConnector('regenerateExecutionPlan')}
            title={tConnector('regenerateExecutionPlan')}
          >
            <ArrowClockwise size={15} />
          </button>
        )}
      </header>
      {error ? (
        <div className={styles.state} role="alert">
          <WarningCircle size={25} />
          <strong>{tConnector('couldNotGenerateTheExecutionPlan')}</strong>
          <p>{error}</p>
          {onRetry && (
            <button type="button" className={styles.retry} disabled={loading} onClick={onRetry}>
              {tConnector('retry')}
            </button>
          )}
        </div>
      ) : loading && !result ? (
        <div className={styles.state} role="status">
          <SpinnerGap className={styles.spinner} size={24} />
          <strong>{tConnector('retrievingTheServerPlan')}</strong>
          <p>{tConnector('theDatabaseAnalyzesQueryStructureAndReturnsTheEstimatedExecution')}</p>
        </div>
      ) : !plan ? (
        <div className={styles.state}>
          <FlowArrow size={27} />
          <strong>{tConnector('inspectTheQueryExecutionPath')}</strong>
          <p>{tConnector('generateAnExecutionPlanToInspectIndexesJoinOrderAnd')}</p>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label={tConnector('planView')}>
              {VIEWS(locale).map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`${id}-${item.id}`}
                  aria-controls={`${id}-content`}
                  aria-selected={view === item.id}
                  tabIndex={view === item.id ? 0 : -1}
                  data-active={view === item.id}
                  onClick={() => setView(item.id)}
                  onKeyDown={(event) => navigateTabs(event, index)}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            {view !== 'raw' && (
              <label className={styles.search}>
                <MagnifyingGlass size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tConnector('searchNodesTablesOrIndexes')}
                  aria-label={tConnector('searchExecutionPlanNodes')}
                />
                <span>
                  {search.trim() ? `${filtered.length}/` : ''}
                  {nodes.length}
                </span>
              </label>
            )}
            {view === 'tree' && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() =>
                  setCollapsed({
                    result,
                    ids: collapsed.size
                      ? new Set()
                      : new Set(
                          nodes.filter((node) => node.children.length).map((node) => node.id),
                        ),
                  })
                }
              >
                {collapsed.size ? tConnector('expandAll') : tConnector('collapseAll')}
              </button>
            )}
            {view === 'raw' && (
              <button type="button" className={styles.textButton} onClick={copy}>
                {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                {copyState === 'copied'
                  ? tConnector('copied')
                  : copyState === 'failed'
                    ? tConnector('copyFailedRetry')
                    : tConnector('copyRawPlan')}
              </button>
            )}
          </div>
          {warnings.length > 0 && (
            <div className={styles.warningBar} role="status">
              <WarningCircle size={14} />
              <span>{[...new Set(warnings)].join(' ')}</span>
            </div>
          )}
          {loading && (
            <div className={styles.refreshing} role="status">
              <SpinnerGap className={styles.spinner} size={13} />
              {tConnector('updatingPlan')}
            </div>
          )}
          <div
            id={`${id}-content`}
            role="tabpanel"
            aria-labelledby={`${id}-${view}`}
            className={styles.body}
          >
            {view === 'raw' ? (
              <pre className={styles.raw}>
                <code>{raw}</code>
              </pre>
            ) : (
              <>
                <div className={styles.primary}>
                  {!nodes.length ? (
                    <div className={styles.state}>
                      <BracketsCurly size={24} />
                      <strong>{tConnector('rawPlanReturned')}</strong>
                      <p>{tConnector('thisStructureCannotBeRecognizedStaticallySwitchToTheRaw')}</p>
                      <button type="button" className={styles.retry} onClick={() => setView('raw')}>
                        {tConnector('viewRawPlan')}
                      </button>
                    </div>
                  ) : view === 'diagram' ? (
                    <ExplainPlanDiagram
                      layout={layout}
                      selectedId={selected?.node.id}
                      onSelect={select}
                      search={search}
                    />
                  ) : !filtered.length ? (
                    <div className={styles.state}>
                      <MagnifyingGlass size={23} />
                      <strong>{tConnector('noMatchingNodes')}</strong>
                      <p>{tConnector('tryATableNameIndexNameOrOperationType')}</p>
                      <button type="button" className={styles.retry} onClick={() => setSearch('')}>
                        {tConnector('clearSearch')}
                      </button>
                    </div>
                  ) : view === 'tree' ? (
                    <ExplainPlanTree
                      nodes={plan.nodes}
                      selectedId={selected?.node.id}
                      onSelect={select}
                      collapsed={collapsed}
                      onToggle={toggle}
                      search={search}
                    />
                  ) : (
                    <div className={styles.summary}>
                      <div className={styles.summaryMetrics}>
                        <div>
                          <span>{tConnector('planNodes')}</span>
                          <strong>{nodes.length}</strong>
                        </div>
                        <div>
                          <span>{tConnector('estimatedRootCost')}</span>
                          <strong>
                            {rootCost === undefined ||
                            !plan.nodes.some((node) => node.cost !== undefined)
                              ? tConnector('notProvided')
                              : rootCost.toLocaleString(locale, { maximumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div>
                          <span>{tConnector('responseFormat')}</span>
                          <strong>
                            {plan.format === 'json' ? 'JSON' : tConnector('nativeTable')}
                          </strong>
                        </div>
                      </div>
                      <table className={styles.summaryTable}>
                        <thead>
                          <tr>
                            <th>{tConnector('serverOperation')}</th>
                            <th>{tConnector('tableIndex')}</th>
                            <th>{tConnector('estimatedCost')}</th>
                            <th>{tConnector('estimatedRows')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((node) => (
                            <tr key={node.id} data-selected={node.id === selected?.node.id}>
                              <td>
                                <button type="button" onClick={() => select(node.id)}>
                                  {node.nodeType}
                                </button>
                              </td>
                              <td>
                                {node.relation || '—'}
                                {node.index && <small>{node.index}</small>}
                              </td>
                              <td>{node.cost ?? tConnector('notProvided')}</td>
                              <td>{node.rows ?? tConnector('notProvided')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {nodes.length > 0 && <PlanNodeDetails selected={selected} />}
              </>
            )}
          </div>
          <footer className={styles.footer}>
            <span>
              {nodes.length}
              {tConnector('nodes')}
              {result?.executionTimeMs.toFixed(0)}
              {tConnector('msPlanRequest')}
            </span>
            <span>{tConnector('costIsAServerEstimateNotActualElapsedTime')}</span>
          </footer>
        </>
      )}
    </section>
  );
}
