import { Path, TerminalWindow, SquaresFour, Target } from '@phosphor-icons/react';
import { ChatPickerItem } from './chat-picker';
import type { ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';
import styles from './chat-modes.module.css';

export const chatModes = {
  plan: { icon: Path, label: 'modePlan', description: 'modePlanDescription' },
  debug: { icon: TerminalWindow, label: 'modeDebug', description: 'modeDebugDescription' },
  multitask: { icon: SquaresFour, label: 'modeMultitask', description: 'modeMultitaskDescription' },
  goal: { icon: Target, label: 'modeGoal', description: 'modeGoalDescription' },
} as const;

export const chatModeOrder: readonly ChatMode[] = ['plan', 'debug', 'multitask', 'goal'];

export function ChatModeItems({ modes = chatModeOrder, selected, onSelect, t }: {
  modes?: readonly ChatMode[];
  selected: ChatMode | null;
  onSelect: (mode: ChatMode) => void;
  t: ChatText;
}) {
  return modes.map(id => {
    const { icon: Icon, label, description } = chatModes[id];
    return <ChatPickerItem key={id} className={styles.item} role="menuitemradio"
      aria-checked={selected === id} data-current={selected === id} textValue={t(label)} onSelect={() => onSelect(id)}>
      <Icon className={styles.icon} data-mode={id} data-static-color aria-hidden="true" />
      <span className={styles.name}>{t(label)}</span>
      <span className={styles.description}>{t(description)}</span>
    </ChatPickerItem>;
  });
}

export function ChatModeTag({ mode, t }: {
  mode: ChatMode;
  t: ChatText;
}) {
  const label = t(chatModes[mode].label);
  return <span className={styles.messageTag}>{label}</span>;
}
