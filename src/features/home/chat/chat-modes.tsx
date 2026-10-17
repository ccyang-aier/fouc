import { Path, TerminalWindow, SquaresFour, Target } from '@phosphor-icons/react';
import { ChatPromptTag } from './chat-prompt-tag';
import type { ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';

export const chatModes = {
  plan: { icon: Path, label: 'modePlan', description: 'modePlanDescription' },
  debug: { icon: TerminalWindow, label: 'modeDebug', description: 'modeDebugDescription' },
  multitask: { icon: SquaresFour, label: 'modeMultitask', description: 'modeMultitaskDescription' },
  goal: { icon: Target, label: 'modeGoal', description: 'modeGoalDescription' },
} as const;

export const chatModeOrder: readonly ChatMode[] = ['plan', 'debug', 'multitask', 'goal'];

export function ChatModeTag({ mode, onRemove, t }: {
  mode: ChatMode;
  onRemove?: () => void;
  t: ChatText;
}) {
  const label = t(chatModes[mode].label);
  return <ChatPromptTag label={label} removeLabel={t('removeMode', { mode: label })} onRemove={onRemove} />;
}
