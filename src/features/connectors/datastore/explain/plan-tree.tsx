import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './plan-tree.messages';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import type { KeyboardEvent } from 'react';
import type { ExplainPlanNode } from './types';
import { categorizePlanNode } from './plan-canvas';
import { PLAN_CATEGORY_LABELS, planBranchMatches, planNodeMatches } from './plan-presentation';
import styles from './explain.module.css';
type Props = {
  nodes: readonly ExplainPlanNode[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
  search: string;
};
function navigate(
  event: KeyboardEvent<HTMLButtonElement>,
  node: ExplainPlanNode,
  expanded: boolean,
  onToggle: Props['onToggle'],
) {
  const element = event.currentTarget;
  const items = [
    ...(element
      .closest('[role="tree"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]') ?? []),
  ];
  const index = items.indexOf(element);
  let target: HTMLButtonElement | undefined;
  if (event.key === 'ArrowDown') target = items[index + 1];
  else if (event.key === 'ArrowUp') target = items[index - 1];
  else if (event.key === 'Home') target = items[0];
  else if (event.key === 'End') target = items.at(-1);
  else if (event.key === 'ArrowRight' && node.children.length) {
    if (!expanded) onToggle(node.id);
    else target = items[index + 1];
  } else if (event.key === 'ArrowLeft') {
    if (expanded && node.children.length) onToggle(node.id);
    else
      target = items
        .slice(0, index)
        .findLast(
          (candidate) =>
            Number(candidate.getAttribute('aria-level')) <
            Number(element.getAttribute('aria-level')),
        );
  } else return;
  event.preventDefault();
  if (target) {
    target.focus();
    target.click();
  }
}
function TreeBranch({
  node,
  depth,
  ...props
}: Omit<Props, 'nodes'> & {
  node: ExplainPlanNode;
  depth: number;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  if (!planBranchMatches(node, props.search)) return null;
  const expanded = !!props.search.trim() || !props.collapsed.has(node.id);
  const category = categorizePlanNode(node.nodeType);
  const matched = !!props.search.trim() && planNodeMatches(node, props.search);
  return (
    <div className={styles.treeBranch}>
      <div
        className={styles.treeRow}
        data-selected={props.selectedId === node.id}
        data-matched={matched}
      >
        <button
          type="button"
          className={styles.disclosure}
          aria-label={`${expanded ? tConnector('collapse') : tConnector('expand')} ${node.title}`}
          disabled={!node.children.length}
          onClick={() => props.onToggle(node.id)}
        >
          {node.children.length ? (
            expanded ? (
              <CaretDown size={12} />
            ) : (
              <CaretRight size={12} />
            )
          ) : (
            <span />
          )}
        </button>
        <button
          type="button"
          role="treeitem"
          className={styles.treeNode}
          aria-level={depth + 1}
          aria-selected={props.selectedId === node.id}
          aria-expanded={node.children.length ? expanded : undefined}
          onClick={() => props.onSelect(node.id)}
          onKeyDown={(event) => navigate(event, node, expanded, props.onToggle)}
        >
          <span
            className={styles.category}
            data-category={category}
            title={PLAN_CATEGORY_LABELS(locale)[category]}
          >
            {node.nodeType}
          </span>
          <strong title={node.title}>{node.relation || node.title}</strong>
          {node.index && (
            <span className={styles.index} title={node.index}>
              {node.index}
            </span>
          )}
          <span className={styles.treeMetrics}>
            {tConnector('cost')}
            {node.cost ?? '—'}
            <span>
              {tConnector('rowCount')}
              {node.rows ?? '—'}
            </span>
          </span>
        </button>
      </div>
      {expanded && node.children.length > 0 && (
        <div role="group" className={styles.treeChildren}>
          {node.children.map((child) => (
            <TreeBranch key={child.id} node={child} depth={depth + 1} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}
export function ExplainPlanTree({ nodes, ...props }: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <div role="tree" aria-label={tConnector('executionPlanTree')} className={styles.tree}>
      {nodes.map((node) => (
        <TreeBranch key={node.id} node={node} depth={0} {...props} />
      ))}
    </div>
  );
}
