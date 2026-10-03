import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import type { PlanCanvasNode } from './plan-canvas';
import { PLAN_CATEGORY_LABELS, planDetailEntries, planNodeWarnings } from './plan-presentation';
import styles from './explain.module.css';

export function PlanNodeDetails({ selected }: { selected: PlanCanvasNode | undefined }) {
  if (!selected) return <aside className={styles.inspector}><p className={styles.empty}>选择节点查看详细信息。</p></aside>;
  const node = selected.node;
  const warnings = planNodeWarnings(node);
  const entries = planDetailEntries(node);
  return <aside className={styles.inspector} aria-label="执行计划节点详情">
    <div className={styles.inspectorHeading}>
      <span className={styles.category} data-category={selected.category}>{PLAN_CATEGORY_LABELS[selected.category]}</span>
      <h3>{node.nodeType}</h3>
      {(node.relation || node.index) && <p>{node.relation}{node.index && <span> · {node.index}</span>}</p>}
    </div>
    <dl className={styles.metrics}>
      <div><dt>预计成本</dt><dd>{node.cost ?? '未提供'}</dd></div>
      <div><dt>预计行数</dt><dd>{node.rows ?? '未提供'}</dd></div>
      <div><dt>相对成本</dt><dd>{selected.costShare === undefined ? '未提供' : `${(selected.costShare * 100).toFixed(1)}%`}</dd></div>
      <div><dt>预计行宽</dt><dd>{node.width ?? '未提供'}</dd></div>
    </dl>
    {warnings.length > 0 && <div className={styles.nodeWarnings}>{warnings.map((warning) => <p key={warning}><WarningCircle size={14} /><span>{warning}</span></p>)}</div>}
    <div className={styles.detailsBody}>
      <h4>服务器节点属性</h4>
      {entries.length ? <dl>{entries.map((entry, index) => <div key={index}>{entry.label && <dt>{entry.label}</dt>}<dd>{entry.value}</dd></div>)}</dl> : <p className={styles.muted}>服务器未提供额外属性。</p>}
    </div>
  </aside>;
}
