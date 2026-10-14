import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  selectANodeToInspectDetails: ['选择节点查看详细信息。', 'Select a node to inspect details.'],
  executionPlanNodeDetails: ['执行计划节点详情', 'Execution plan node details'],
  estimatedCost: ['预计成本', 'Estimated cost'],
  notProvided: ['未提供', 'Not provided'],
  estimatedRows: ['预计行数', 'Estimated rows'],
  relativeCost: ['相对成本', 'Relative cost'],
  estimatedRowWidth: ['预计行宽', 'Estimated row width'],
  serverNodeProperties: ['服务器节点属性', 'Server node properties'],
  theServerProvidedNoAdditionalProperties: [
    '服务器未提供额外属性。',
    'The server provided no additional properties.',
  ],
});
