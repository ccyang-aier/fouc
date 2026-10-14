import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './plan-presentation.messages';
import type { ExplainPlanNode } from './types';
import { categorizePlanNode, type PlanCanvasCategory } from './plan-canvas';
export const PLAN_CATEGORY_LABELS = (locale?: Locale): Record<PlanCanvasCategory, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    result: tConnector('output'),
    sort: tConnector('sort'),
    join: tConnector('connect'),
    tscan: tConnector('scan'),
    iscan: tConnector('indexes'),
    lookup: tConnector('lookup'),
    mat: tConnector('intermediateResult'),
    agg: tConnector('aggregate'),
    xchg: tConnector('parallelDistribution'),
    other: tConnector('otherOperation'),
  };
};
export function planNodeMatches(node: ExplainPlanNode, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  return (
    !query ||
    [node.title, node.nodeType, node.relation, node.index, ...node.details]
      .filter(Boolean)
      .join('\n')
      .toLocaleLowerCase()
      .includes(query)
  );
}
export function planBranchMatches(node: ExplainPlanNode, search: string): boolean {
  return (
    planNodeMatches(node, search) || node.children.some((child) => planBranchMatches(child, search))
  );
}
/** Preserve a colon inside a predicate or URL: only the first separator denotes its native label. */
export function planDetailEntries(node: ExplainPlanNode): Array<{
  label?: string;
  value: string;
}> {
  return node.details
    .map((detail) => {
      const index = detail.indexOf(':');
      return index < 0
        ? { value: detail.trim() }
        : {
            label: detail.slice(0, index).trim() || undefined,
            value: detail.slice(index + 1).trim(),
          };
    })
    .filter((entry) => entry.label || entry.value);
}
export function planNodeWarnings(node: ExplainPlanNode, locale?: Locale): string[] {
  const tConnector = createTranslator(connectorMessages, locale);
  const warnings: string[] = [];
  if (categorizePlanNode(node.nodeType) === 'tscan')
    warnings.push(tConnector('thisNodeScansTableDataWhetherAnIndexIsNeeded'));
  if (
    node.details.some((detail) =>
      /(?:filesort|temporary table|using_temporary_table):\s*true|using filesort|using temporary/i.test(
        detail,
      ),
    ) ||
    /use temp b-tree/i.test(node.nodeType)
  )
    warnings.push(tConnector('thisNodeIncludesAdditionalSortingOrTemporaryResultsConsiderThe'));
  return warnings;
}
