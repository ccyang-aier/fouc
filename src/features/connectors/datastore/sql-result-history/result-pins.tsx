'use client';

import { useState, type ReactNode } from 'react';
import { ArrowsLeftRight, IconContext, PushPin, X } from '@phosphor-icons/react';
import type { DatabaseQueryResult, RelationalProvider, SqlResultView } from '@fouc/shared';
import { SqlQueryResult } from '../query-result';
import { SqlDialog } from '../sql-library-dialog';
import { SqlResultHeader, type SqlResultHeaderHost } from '../sql-result-header';
import { navigateWorkbenchTabs } from '../workbench-tab-navigation';
import { DataComparePanel } from '../data-compare/panel';
import { scopedResultPins, type ResultPin, type ResultPinScope } from './model';
import styles from './result-pins.module.css';
import headerStyles from '../sql-result-header.module.css';
import { sqlResultTabLabel } from '../sql-result-label';

type Props = {
  scope: ResultPinScope; pins: readonly ResultPin[];
  current: { result: DatabaseQueryResult; id: string; label: string } | null;
  currentLabel: string; hasExecution: boolean; base: string;
  onExplainTarget: (target: HTMLDivElement | null) => void;
  provider: RelationalProvider; children: (host: SqlResultHeaderHost) => ReactNode;
  layoutScopeKey?: string; onRemove: (id: string) => void;
  onNotice: (message: string) => void; onSqlPreview: (sql: string) => void;
  onCollapse: () => void;
  view: SqlResultView; onViewChange: (view: SqlResultView) => void;
};
export function ResultPins({ scope, pins, current, currentLabel, hasExecution, base, provider, children, layoutScopeKey, onRemove, onNotice, onSqlPreview, onExplainTarget, onCollapse, view, onViewChange }: Props) {
  const entries = scopedResultPins(pins, scope);
  const [active, setActive] = useState<string | null>(null);
  const [tabsTarget, setTabsTarget] = useState<HTMLDivElement | null>(null), [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null), [pinTarget, setPinTarget] = useState<HTMLDivElement | null>(null), [pinnedToolsTarget, setPinnedToolsTarget] = useState<HTMLDivElement | null>(null);
  const [comparison, setComparison] = useState<{ pin: ResultPin; right: DatabaseQueryResult; label: string } | null>(null);
  const selected = entries.find(pin => pin.id === active);
  function remove(id: string) { onRemove(id); if (id === selected?.id) setActive(null) }
  const selectedLabel = selected?.label ?? currentLabel;
  return <IconContext.Provider value={{ weight: 'bold', size: 19 }}><div className={styles.root}>
    <SqlResultHeader label={selectedLabel} selectedPin={Boolean(selected)} empty={!hasExecution && !entries.length} view={view} onCollapse={onCollapse}
      onTabsTarget={setTabsTarget} onActionsTarget={setActionsTarget} onPinTarget={setPinTarget} onPinnedToolsTarget={setPinnedToolsTarget}
      pinnedPinControl={selected && <button type="button" className="fouc-action" aria-label="取消固定当前结果" title="取消固定当前结果" onClick={() => remove(selected.id)}><PushPin weight="fill" /></button>}
      tabs={entries.map((pin, index) => <div key={pin.id} role="tab" aria-label={`${sqlResultTabLabel(pin.label, entries.slice(0, index).map(entry => entry.label))} · 固定结果`} aria-selected={pin.id === selected?.id} tabIndex={pin.id === selected?.id ? 0 : -1}
        className={`${headerStyles.tab} fouc-action`} title={`${pin.label}\n固定快照 · ${pin.result.rows.length} 行\n${pin.sql}`}
        onClick={() => setActive(pin.id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setActive(pin.id) } navigateWorkbenchTabs(event) }}>
        <PushPin size={15} weight="fill" /><span>{sqlResultTabLabel(pin.label, entries.slice(0, index).map(entry => entry.label))}</span><button type="button" className={headerStyles.close} aria-label={`取消固定 ${pin.label}`} onClick={event => { event.stopPropagation(); remove(pin.id) }}><X size={14} weight="bold" /></button>
      </div>)}
      pinActions={selected && <button type="button" className="fouc-action" aria-label="与当前比较" disabled={!current || current.id === selected.sourceId || !current.result.columns.length} title="比较固定快照与当前结果" onClick={() => current && setComparison({ pin: selected, right: current.result, label: current.label })}><ArrowsLeftRight size={19} /></button>} />
    <div className={styles.body} hidden={Boolean(selected)}>{children({ tabs: tabsTarget, actions: actionsTarget, pin: pinTarget, active: !selected, onActivate: () => setActive(null), pinnedLabels: entries.map(pin => pin.label) })}</div>
    {selected && <div className={styles.body}><SqlQueryResult key={selected.id} result={selected.result} view={view} onViewChange={onViewChange} provider={provider} scopeKey={`pin:${selected.id}`} layoutScopeKey={layoutScopeKey} headerTarget={pinnedToolsTarget}
      queryContext={{ base, sql: selected.sql, schema: selected.context.schema }} onExplainTarget={onExplainTarget} /></div>}
    {comparison && <SqlDialog title="固定结果与当前结果比较" className={styles.compareDialog} onClose={() => setComparison(null)}>
      <div className={styles.compareBody}><DataComparePanel left={comparison.pin.result} right={comparison.right} leftLabel={`${comparison.pin.label} · 固定快照`} rightLabel={`${comparison.label} · 当前执行`} provider={provider} scopeKey={comparison.pin.id} onNotice={onNotice} onSqlPreview={sql => { setComparison(null); onSqlPreview(sql) }} /></div>
      <footer className={styles.compareFooter}><span>仅比较打开时两份已加载快照</span><button type="button" onClick={() => setComparison(null)}>关闭比较</button></footer>
    </SqlDialog>}
  </div></IconContext.Provider>;
}
