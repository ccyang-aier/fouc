'use client';

import { Plus } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskSchedule } from '@fouc/shared/tasks';
import { useTranslation } from '@/lib/i18n';
import { localDay } from '../task-board-model';
import { makeSchedule, tasksOnDay, timeLabel } from './calendar-model';
import { messages } from './calendar.messages';
import styles from './calendar.module.css';

export function CalendarMonth({ days, anchor, tasks, board, today, busy, onDay, onOpen, onCreate }: {
  days: Date[]; anchor: string; tasks: BoardTask[]; board: TaskBoardDetail; today: string; busy: boolean;
  onDay: (day: string) => void; onOpen: (task: BoardTask, anchor: { x: number; y: number }) => void;
  onCreate: (schedule: TaskSchedule, anchor: { x: number; y: number }) => void;
}) {
  const { t, locale } = useTranslation(messages);
  return <div className={styles.monthScroll}><div className={styles.monthSurface}>
    <div className={styles.monthWeekdays}>{days.slice(0, 7).map(day => <span key={localDay(day)}>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}</span>)}</div>
    <div className={styles.monthGrid}>{days.map(day => {
      const date = localDay(day), items = tasksOnDay(tasks, day).toSorted((a, b) => (a.schedule ? Date.parse(a.schedule.startsAt) : 0) - (b.schedule ? Date.parse(b.schedule.startsAt) : 0) || a.number - b.number);
      return <section key={date} className={styles.monthDay} data-outside={date.slice(0, 7) !== anchor.slice(0, 7) || undefined} data-today={date === today || undefined} aria-label={date}>
        <header><button type="button" className={`fouc-action ${styles.monthDate}`} onClick={() => onDay(date)} aria-label={t('viewDay', { date })}>{day.getDate() === 1 ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(day) : day.getDate()}</button>{board.permission !== 'viewer' && <button type="button" className={`fouc-action ${styles.monthAdd}`} disabled={busy} aria-label={`${t('newSchedule')} ${date}`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onCreate(makeSchedule(day), { x: rect.right, y: rect.top }); }}><Plus size={14} /></button>}</header>
        <div className={styles.monthEvents}>{items.slice(0, 3).map(task => { const column = board.columns.find(column => column.id === task.columnId)!; return <button key={task.id} type="button" className={styles.monthEvent} data-color={column.isDone ? 'green' : column.color} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onOpen(task, { x: rect.right, y: rect.top }); }}><i /><span>{task.schedule ? timeLabel(task.schedule.startsAt, locale) : t('allDay')}</span><strong>{task.title}</strong></button>; })}{items.length > 3 && <button type="button" className={`fouc-action ${styles.moreEvents}`} onClick={() => onDay(date)}>{t('showMore', { count: items.length - 3 })}</button>}</div>
      </section>;
    })}</div>
  </div></div>;
}
