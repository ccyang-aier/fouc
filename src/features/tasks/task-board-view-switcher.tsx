'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const views = ['list', 'timeline', 'kanban'] as const;
type TaskView = typeof views[number];

function ViewIcon({ view }: { view: TaskView }) {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {view === 'list' && <><rect x="1.5" y="1.5" width="17" height="17" rx="2.5" /><path d="M1.5 7h17M1.5 13h17M8 1.5v17" /></>}
    {view === 'timeline' && <path d="M1.5 18.5h17M4 1.5v5M8 6.5v3M12 10v2M16 13.5v1.5" />}
    {view === 'kanban' && <><rect x="1.5" y="1.5" width="6" height="17" rx="2.5" /><rect x="12.5" y="1.5" width="6" height="17" rx="2.5" /></>}
  </svg>;
}

export function TaskBoardViewSwitcher() {
  const { t } = useTranslation(messages);
  return <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
    {views.map(view => view === 'kanban'
      ? <button key={view} type="button" className={`fouc-action ${styles.viewSegment}`} aria-pressed="true"><span>{t(view)}</span><ViewIcon view={view} /></button>
      : <Tooltip key={view}>
        <TooltipTrigger asChild><span className={styles.plannedView}><button type="button" className={styles.viewSegment} disabled aria-label={`${t(view)} · ${t('planned')}`}><span>{t(view)}</span><ViewIcon view={view} /></button></span></TooltipTrigger>
        <TooltipContent>{t('planned')}</TooltipContent>
      </Tooltip>)}
  </div>;
}
