import { Heart, Moon, Sparkle } from 'lucide-react';
import { motion, useIsPresent, type Variants } from 'motion/react';
import { useTranslation } from '@/lib/i18n/react';
import { CompanionActionMenu } from './companion-action-menu';
import { CompanionToolButton } from './companion-tool-button';
import { messages, type CompanionAction } from './companion.messages';
import type { CompanionState } from './companion-runtime';
import styles from './companion-widget.module.css';

const railMotion: Variants = {
  closed: { opacity: 0, y: 14, scale: .92, transition: { duration: .14 } },
  open: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: .24, ease: [.22, 1, .36, 1], delayChildren: .025, staggerChildren: .025, staggerDirection: -1 },
  },
};

export function CompanionToolbar({ id, state, onFeed, onAction }: {
  id: string;
  state: CompanionState;
  onFeed: () => void;
  onAction: (action: CompanionAction) => void;
}) {
  const { t } = useTranslation(messages);
  const present = useIsPresent();
  return (
    <motion.div
      id={id}
      className={styles.rail}
      role="toolbar"
      aria-label={t('工具栏')}
      aria-orientation="vertical"
      aria-hidden={!present || undefined}
      inert={!present}
      variants={railMotion}
      initial="closed"
      animate="open"
      exit="closed"
    >
      <CompanionToolButton icon={Sparkle} label={t('喂糖')} disabled={state.busy} loading={state.busy && state.label === 'CANDY!'} onClick={onFeed} />
      <span className={styles.divider} role="separator" />
      <CompanionToolButton icon={Heart} label={t('抚摸')} disabled={state.busy} onClick={() => onAction('happy')} />
      <CompanionActionMenu group="expression" busy={state.busy} onAction={onAction} />
      <CompanionActionMenu group="motion" busy={state.busy} onAction={onAction} />
      <CompanionToolButton icon={Moon} label={t('睡眠')} disabled={state.busy} onClick={() => onAction('sleep')} />
    </motion.div>
  );
}
