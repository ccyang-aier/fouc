import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './plan-details.messages';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import type { PlanCanvasNode } from './plan-canvas';
import { PLAN_CATEGORY_LABELS, planDetailEntries, planNodeWarnings } from './plan-presentation';
import styles from './explain.module.css';
export function PlanNodeDetails({ selected }: { selected: PlanCanvasNode | undefined }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  if (!selected)
    return (
      <aside className={styles.inspector}>
        <p className={styles.empty}>{tConnector('selectANodeToInspectDetails')}</p>
      </aside>
    );
  const node = selected.node;
  const warnings = planNodeWarnings(node, locale);
  const entries = planDetailEntries(node);
  return (
    <aside className={styles.inspector} aria-label={tConnector('executionPlanNodeDetails')}>
      <div className={styles.inspectorHeading}>
        <span className={styles.category} data-category={selected.category}>
          {PLAN_CATEGORY_LABELS(locale)[selected.category]}
        </span>
        <h3>{node.nodeType}</h3>
        {(node.relation || node.index) && (
          <p>
            {node.relation}
            {node.index && <span> · {node.index}</span>}
          </p>
        )}
      </div>
      <dl className={styles.metrics}>
        <div>
          <dt>{tConnector('estimatedCost')}</dt>
          <dd>{node.cost ?? tConnector('notProvided')}</dd>
        </div>
        <div>
          <dt>{tConnector('estimatedRows')}</dt>
          <dd>{node.rows ?? tConnector('notProvided')}</dd>
        </div>
        <div>
          <dt>{tConnector('relativeCost')}</dt>
          <dd>
            {selected.costShare === undefined
              ? tConnector('notProvided')
              : `${(selected.costShare * 100).toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt>{tConnector('estimatedRowWidth')}</dt>
          <dd>{node.width ?? tConnector('notProvided')}</dd>
        </div>
      </dl>
      {warnings.length > 0 && (
        <div className={styles.nodeWarnings}>
          {warnings.map((warning) => (
            <p key={warning}>
              <WarningCircle size={14} />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}
      <div className={styles.detailsBody}>
        <h4>{tConnector('serverNodeProperties')}</h4>
        {entries.length ? (
          <dl>
            {entries.map((entry, index) => (
              <div key={index}>
                {entry.label && <dt>{entry.label}</dt>}
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.muted}>{tConnector('theServerProvidedNoAdditionalProperties')}</p>
        )}
      </div>
    </aside>
  );
}
