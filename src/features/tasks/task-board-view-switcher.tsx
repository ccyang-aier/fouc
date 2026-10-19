'use client';

import { CalendarDots, SquaresFour, Table } from '@phosphor-icons/react';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const views = ['kanban', 'calendar', 'spreadsheet'] as const;
const viewIcons = { kanban: SquaresFour, calendar: CalendarDots, spreadsheet: Table };

export type TaskBoardView = typeof views[number];

export function TaskBoardViewSwitcher({ value, onChange }: { value: TaskBoardView; onChange: (value: TaskBoardView) => void }) {
  const { t } = useTranslation(messages);
  return <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
    {views.map(view => { const Icon = viewIcons[view]; return <button key={view} type="button" className={`fouc-action ${styles.viewSegment}`} data-surface="plain" aria-pressed={value === view} onClick={() => onChange(view)}><Icon size={18} /><span>{t(view)}</span></button>; })}
  </div>;
}
