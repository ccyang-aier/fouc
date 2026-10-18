'use client';

import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardProgress({ completed, total }: { completed: number; total: number }) {
  const { t } = useTranslation(messages);
  const completion = total ? Math.round(completed / total * 100) : 0;
  return <div className={styles.summaryProgress} role="progressbar" aria-label={t('completion', { percent: completion })} aria-valuenow={completed} aria-valuemax={Math.max(1, total)} aria-valuemin={0}>
    <strong className={styles.summaryPercent}>{completion}<span>%</span></strong>
    <span className={styles.summaryDetails}>
      <span className={styles.summaryNumbers}><strong>{completed}</strong><span>/ {total}</span><span className={styles.summaryLabel}>{t('completedLabel')}</span></span>
      <span className={styles.summaryTrack}><span style={{ width: `${completion}%` }} data-complete={completion === 100 || undefined} /></span>
    </span>
  </div>;
}
