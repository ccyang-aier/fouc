'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import type { TaskProgressState } from './task-progress-model';
import { messages } from './task-progress.messages';
import styles from './task-card.module.css';

export function TaskProgress({ progress }: { progress: TaskProgressState }) {
  const { t } = useTranslation(messages);
  const summary = t('completion', { percent: progress.percent });
  const checklist = t('checklist', { done: progress.done, total: progress.total });
  const completedStatus = progress.completed ? t('completedStatus') : null;
  const risk = progress.risk === 'overdue' ? t('overdue', { days: -progress.daysRemaining! })
    : progress.risk === 'dueSoon' ? progress.daysRemaining === 0 ? t('dueToday') : t('dueSoon', { days: progress.daysRemaining! }) : null;
  const angle = progress.fraction * Math.PI * 2;
  const sector = `M 7 7 L 7 2.8 A 4.2 4.2 0 ${progress.fraction > .5 ? 1 : 0} 1 ${7 + 4.2 * Math.sin(angle)} ${7 - 4.2 * Math.cos(angle)} Z`;
  return <Tooltip>
    <TooltipTrigger asChild>
      <span className={styles.progressIndicator} tabIndex={0} role="img" data-risk={progress.risk || undefined}
        aria-label={[summary, checklist, completedStatus, risk].filter(Boolean).join(' · ')}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle className={styles.progressRing} cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
          {progress.fraction === 1 ? <circle cx="7" cy="7" r="4.2" fill="currentColor" />
            : progress.fraction > 0 && <path d={sector} fill="currentColor" />}
        </svg>
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className={styles.progressTooltip}>
      <strong>{summary}</strong><span>{checklist}</span>
      {completedStatus && <span>{completedStatus}</span>}
      {risk && <span>{risk}</span>}
    </TooltipContent>
  </Tooltip>;
}
