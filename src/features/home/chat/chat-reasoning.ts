import type { ModelReasoningLevel } from '@fouc/shared/model-catalog';
import type { chatMessages } from './chat-messages';

export const reasoningLabels = {
  none: 'reasoningNone', minimal: 'reasoningMinimal', low: 'reasoningLow', medium: 'reasoningMedium',
  high: 'reasoningHigh', xhigh: 'reasoningXhigh', max: 'reasoningMax',
} as const satisfies Record<ModelReasoningLevel, keyof typeof chatMessages>;
