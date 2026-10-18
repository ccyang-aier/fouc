'use client';

import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardProgress({ completed, total }: { completed: number; total: number }) {
  const { t } = useTranslation(messages);
  const completion = total ? Math.round(completed / total * 100) : 0;
  return <div className={styles.summaryProgress} role="progressbar" aria-label={t('completion', { percent: completion })} aria-valuenow={completed} aria-valuemax={Math.max(1, total)} aria-valuemin={0}>
    <svg className={styles.summaryRing} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle className={styles.summaryTrack} cx="11" cy="11" r="8" strokeWidth="2.5" />
      {completion > 0 && <circle className={styles.summaryArc} cx="11" cy="11" r="8" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray={`${completion} 100`} transform="rotate(-90 11 11)" />}
    </svg>
    <span className={styles.summaryNumbers}><strong>{completed}</strong><span>/</span><span>{total}</span></span>
    <span className={styles.summaryLabel}>{t('completedLabel')}</span>
  </div>;
}
