import type { ExplainPlanNode } from './types';
import { categorizePlanNode, type PlanCanvasCategory } from './plan-canvas';

export const PLAN_CATEGORY_LABELS: Record<PlanCanvasCategory, string> = {
  result: '输出', sort: '排序', join: '连接', tscan: '扫描', iscan: '索引', lookup: '查找',
  mat: '中间结果', agg: '聚合', xchg: '并行分发', other: '其他操作',
};

export function planNodeMatches(node: ExplainPlanNode, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  return !query || [node.title, node.nodeType, node.relation, node.index, ...node.details].filter(Boolean).join('\n').toLocaleLowerCase().includes(query);
}

export function planBranchMatches(node: ExplainPlanNode, search: string): boolean {
  return planNodeMatches(node, search) || node.children.some((child) => planBranchMatches(child, search));
}

/** Preserve a colon inside a predicate or URL: only the first separator denotes its native label. */
export function planDetailEntries(node: ExplainPlanNode): Array<{ label?: string; value: string }> {
  return node.details.map((detail) => {
    const index = detail.indexOf(':');
    return index < 0 ? { value: detail.trim() } : { label: detail.slice(0, index).trim() || undefined, value: detail.slice(index + 1).trim() };
  }).filter((entry) => entry.label || entry.value);
}

export function planNodeWarnings(node: ExplainPlanNode): string[] {
  const warnings: string[] = [];
  if (categorizePlanNode(node.nodeType) === 'tscan') warnings.push('此节点扫描表数据；是否需要索引取决于数据规模与筛选条件。');
  if (node.details.some((detail) => /(?:filesort|temporary table|using_temporary_table):\s*true|using filesort|using temporary/i.test(detail)) || /use temp b-tree/i.test(node.nodeType)) warnings.push('此节点包含额外排序或临时结果，可结合预计行数进一步判断。');
  return warnings;
}
