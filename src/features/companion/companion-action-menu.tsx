import { Smile, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n/react';
import { companionExpressions, companionMotions, messages, type CompanionAction } from './companion.messages';
import styles from './companion-widget.module.css';

const groups = {
  expression: { label: '表情', Icon: Smile, actions: companionExpressions },
  motion: { label: '动作', Icon: Sparkles, actions: companionMotions },
} as const;

export function CompanionActionMenu({ group, busy, onAction }: {
  group: keyof typeof groups;
  busy: boolean;
  onAction: (action: CompanionAction) => void;
}) {
  const { t } = useTranslation(messages);
  const { label, Icon, actions } = groups[group];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.tool} aria-label={t(label)} title={t(label)}>
          <Icon size={20} strokeWidth={1.65} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="end" sideOffset={12} collisionPadding={12} density="compact" className={styles.menu}>
        {actions.map(([action, key]) => (
          <DropdownMenuItem key={action} disabled={busy} onSelect={() => onAction(action)}>{t(key)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
