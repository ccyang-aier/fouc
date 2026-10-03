import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared';

/** DBX's common estimated-plan node, with engine-native values retained as text. */
export interface ExplainPlanNode {
  id: string;
  title: string;
  nodeType: string;
  relation?: string;
  index?: string;
  cost?: string;
  rows?: string;
  width?: string;
  details: string[];
  children: ExplainPlanNode[];
}

export interface ParsedExplainPlan {
  databaseType: RelationalProvider;
  raw: unknown;
  nodes: ExplainPlanNode[];
  warnings: string[];
  format: 'json' | 'table';
}

export type ExplainPlanViewerProps = {
  provider: RelationalProvider;
  result: DatabaseQueryResult | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function flattenExplainPlanNodes(nodes: readonly ExplainPlanNode[]): ExplainPlanNode[] {
  const rows: ExplainPlanNode[] = [];
  const queue = [...nodes].reverse();
  while (queue.length) {
    const node = queue.pop()!;
    rows.push(node);
    for (let index = node.children.length - 1; index >= 0; index--) queue.push(node.children[index]);
  }
  return rows;
}
