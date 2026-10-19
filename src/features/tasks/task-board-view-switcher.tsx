'use client';

import { CalendarDots, Clock, SquaresFour, Table } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const views = ['kanban', 'timeline', 'spreadsheet', 'calendar'] as const;
const viewIcons = { kanban: SquaresFour, timeline: Clock, spreadsheet: Table, calendar: CalendarDots };

export type TaskBoardView = 'kanban' | 'timeline';

export function TaskBoardViewSwitcher({ value, onChange }: { value: TaskBoardView; onChange: (value: TaskBoardView) => void }) {
  const { t } = useTranslation(messages);
  return <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
    {views.map(view => { const Icon = viewIcons[view]; return view === 'kanban' || view === 'timeline'
      ? <button key={view} type="button" className={`fouc-action ${styles.viewSegment}`} data-surface="plain" aria-pressed={value === view} onClick={() => onChange(view)}><Icon size={18} /><span>{t(view)}</span></button>
      : <Tooltip key={view}>
        <TooltipTrigger asChild><span className={styles.plannedView}><button type="button" className={styles.viewSegment} disabled aria-label={`${t(view)} · ${t('planned')}`}><Icon size={18} /><span>{t(view)}</span></button></span></TooltipTrigger>
        <TooltipContent>{t('planned')}</TooltipContent>
      </Tooltip>; })}
  </div>;
}
