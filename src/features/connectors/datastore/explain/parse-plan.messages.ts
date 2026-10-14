import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  thePlanExceedsLevelsOrNodesSeeTheRawPlan: [
    '计划结构超过 {p0} 层或 {p1} 个节点；可在原始计划中查看完整返回内容。',
    'The plan exceeds {p0} levels or {p1} nodes. See the raw plan for the complete response.',
  ],
  thePlanTableExceedsNodesTheCompleteResponseRemainsIn: [
    '计划表格超过 2048 个节点，原始计划中保留了完整返回内容。',
    'The plan table exceeds 2,048 nodes. The complete response remains in the raw plan.',
  ],
  theSqlitePlanExceedsLevelsDeeperNodesAreDisplayedSeparately: [
    'SQLite 计划层级超过 64 层，过深节点已单独呈现。',
    'The SQLite plan exceeds 64 levels. Deeper nodes are displayed separately.',
  ],
  sqliteReturnedCyclicParentIdentifiersThisNodeIsDisplayedSeparately: [
    'SQLite 返回了循环的父节点标识，已将该节点单独呈现。',
    'SQLite returned cyclic parent identifiers. This node is displayed separately.',
  ],
  theJsonPlanExceedsMibSoStructuralParsingWasSkipped: [
    'JSON 计划超过 4 MiB，已跳过结构解析；原始返回内容已保留。',
    'The JSON plan exceeds 4 MiB, so structural parsing was skipped. The raw response is retained.',
  ],
  theServerDidNotReturnARecognizedJsonExecutionPlan: [
    '服务器没有返回可识别的 JSON 执行计划。原始返回内容已保留。',
    'The server did not return a recognized JSON execution plan. The raw response is retained.',
  ],
  noRecognizedPlanNodesInspectTheRawServerResponse: [
    '没有可识别的计划节点，可查看服务器返回的原始计划。',
    'No recognized plan nodes. Inspect the raw server response.',
  ],
});
