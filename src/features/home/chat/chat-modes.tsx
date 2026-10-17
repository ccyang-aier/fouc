import { Path, TerminalWindow, SquaresFour, Question } from '@phosphor-icons/react';
import { ChatPromptTag } from './chat-prompt-tag';
import type { ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';

export const chatModes = {
  plan: { icon: Path, label: 'modePlan', description: 'modePlanDescription' },
  debug: { icon: TerminalWindow, label: 'modeDebug', description: 'modeDebugDescription' },
  multitask: { icon: SquaresFour, label: 'modeMultitask', description: 'modeMultitaskDescription' },
  ask: { icon: Question, label: 'modeAsk', description: 'modeAskDescription' },
} as const;

export const chatModeOrder: readonly ChatMode[] = ['plan', 'debug', 'multitask', 'ask'];

export function ChatModeTag({ mode, onRemove, t }: {
  mode: ChatMode;
  onRemove?: () => void;
  t: ChatText;
}) {
  const label = t(chatModes[mode].label);
  return <ChatPromptTag label={label} removeLabel={t('removeMode', { mode: label })} onRemove={onRemove} />;
}
