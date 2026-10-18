'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const views = ['kanban', 'timeline', 'spreadsheet', 'calendar'] as const;
type TaskView = typeof views[number];

function ViewIcon({ view }: { view: TaskView }) {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {view === 'kanban' && <><path d="M2 2.5h16" /><rect x="2.5" y="6" width="5" height="11.5" rx="1.5" /><rect x="12.5" y="6" width="5" height="7.5" rx="1.5" /></>}
    {view === 'timeline' && <path d="M2 3.5h16M2 7.5h12M2 11.5h8M2 15.5h4" />}
    {view === 'spreadsheet' && <><rect x="1.5" y="1.5" width="17" height="17" rx="2.5" /><path d="M1.5 7h17M1.5 13h17M8 1.5v17" /></>}
    {view === 'calendar' && <><rect x="2.5" y="3.5" width="15" height="14" rx="2" /><path d="M6 1.5v4M14 1.5v4M2.5 8h15M6.5 12h3" /></>}
  </svg>;
}

export function TaskBoardViewSwitcher() {
  const { t } = useTranslation(messages);
  return <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
    {views.map(view => view === 'kanban'
      ? <button key={view} type="button" className={`fouc-action ${styles.viewSegment}`} aria-pressed="true"><ViewIcon view={view} /><span>{t(view)}</span></button>
      : <Tooltip key={view}>
        <TooltipTrigger asChild><span className={styles.plannedView}><button type="button" className={styles.viewSegment} disabled aria-label={`${t(view)} · ${t('planned')}`}><ViewIcon view={view} /><span>{t(view)}</span></button></span></TooltipTrigger>
        <TooltipContent>{t('planned')}</TooltipContent>
      </Tooltip>)}
  </div>;
}
