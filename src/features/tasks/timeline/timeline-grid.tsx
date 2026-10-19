'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CalendarPlus } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskSchedule } from '@fouc/shared/tasks';
import { useTranslation } from '@/lib/i18n';
import { localDay } from '../task-board-model';
import { atMinute, DAY_HEIGHT, HOUR_HEIGHT, layoutDayEvents, timeLabel } from './timeline-model';
import { TimelineEvent } from './timeline-event';
import { useTimelineGesture } from './use-timeline-gesture';
import { messages } from './timeline.messages';
import styles from './timeline.module.css';

export function TimelineGrid({ days, tasks, board, now, busy, onCreate, onOpen, onDetails, onUpdate, onUnschedule }: {
  days: Date[]; tasks: BoardTask[]; board: TaskBoardDetail; now: Date; busy: boolean;
  onCreate: (schedule: TaskSchedule, anchor: { x: number; y: number }) => void;
  onOpen: (task: BoardTask, anchor: { x: number; y: number }) => void;
  onDetails: (task: BoardTask) => void; onUpdate: (task: BoardTask, schedule: TaskSchedule) => Promise<boolean>;
  onUnschedule: (task: BoardTask) => Promise<boolean>;
}) {
  const { t, locale } = useTranslation(messages);
  const scroll = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null);
  const editable = board.permission !== 'viewer';
  const gesture = useTimelineGesture({ surface, days, disabled: !editable || busy, onCreate, onUpdate });
  const events = useMemo(() => {
    const visible = gesture.preview?.taskId ? tasks.map(task => task.id === gesture.preview!.taskId ? { ...task, schedule: gesture.preview!.schedule } : task) : tasks;
    return days.map(day => layoutDayEvents(visible, day));
  }, [days, tasks, gesture.preview]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = HOUR_HEIGHT * 7.5; }, []);
  const today = localDay(now);
  const todayIndex = days.findIndex(day => localDay(day) === today);
  const dueTasks = days.map(day => tasks.filter(task => !task.schedule && task.dueDate === localDay(day)));
  const hasDueTasks = dueTasks.some(tasks => tasks.length > 0);
  const timezone = new Intl.DateTimeFormat(locale, { timeZoneName: 'shortOffset' }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value;
  const preview = gesture.preview?.taskId === null ? gesture.preview.schedule : null;
  return <div ref={scroll} className={styles.timeScroll} data-tracking={gesture.tracking || undefined}>
    <div className={styles.timeSurface} data-day-count={days.length} style={{ '--day-count': days.length } as React.CSSProperties}>
      <div className={styles.gridHeader}><div className={styles.timezone}>{timezone}</div>{days.map(day => <div key={localDay(day)} className={styles.dayHeading} data-today={localDay(day) === today || undefined}><span>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong></div>)}</div>
      {hasDueTasks && <div className={styles.dueRow}><span className={styles.dueLabel}>{t('allDay')}</span>{dueTasks.map((tasks, index) => <div key={localDay(days[index])} className={styles.dueCell}>{tasks.slice(0, 2).map(task => <button key={task.id} type="button" className={`fouc-action ${styles.dueTask}`} onClick={() => onDetails(task)}><i data-color={board.columns.find(column => column.id === task.columnId)?.color} /><span>{task.title}</span></button>)}{tasks.length > 2 && <span className={styles.dueMore}>{t('showMore', { count: tasks.length - 2 })}</span>}</div>)}</div>}
      <div className={styles.timeBody} style={{ height: DAY_HEIGHT }}>
        <div className={styles.hours}>{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: `${hour * HOUR_HEIGHT}px` }}>{timeLabel(atMinute(days[0], hour * 60), locale)}</span>)}</div>
        <div ref={surface} className={styles.dayGrid} onPointerDown={event => { if (event.target instanceof Element && !event.target.closest('[data-timeline-task]')) gesture.begin(event); }}>
          {days.map((day, index) => <div key={localDay(day)} className={styles.dayColumn} data-today={localDay(day) === today || undefined}>
            {events[index].map(event => <TimelineEvent key={event.task.id} event={event} board={board} busy={busy} dragging={gesture.preview?.taskId === event.task.id} resizing={gesture.preview?.taskId === event.task.id && gesture.preview.resizing} onBegin={gesture.begin} onOpen={onOpen} onDetails={onDetails} onUnschedule={onUnschedule} onUpdate={onUpdate} suppressClick={gesture.suppressClick} />)}
            {preview && layoutDayEvents([{ id: 'preview', schedule: preview } as BoardTask], day).map(event => <div key="preview" className={styles.selection} style={{ top: event.start / 60 * HOUR_HEIGHT, height: Math.max(20, (event.end - event.start) / 60 * HOUR_HEIGHT) }}><CalendarPlus size={14} /><span>{timeLabel(preview.startsAt, locale)} – {timeLabel(preview.endsAt, locale)}</span></div>)}
          </div>)}
          {todayIndex >= 0 && <div className={styles.nowLine} style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT }} aria-label={t('now')}><span>{timeLabel(now, locale)}</span><i style={{ left: `${todayIndex / days.length * 100}%`, width: `${100 / days.length}%` }} /></div>}
          {!events.some(events => events.length > 0) && !preview && <div className={styles.gridEmpty} style={{ top: HOUR_HEIGHT * 9 }}><CalendarPlus size={26} /><strong>{t('noTasks')}</strong>{editable && <span>{t('emptyHint')}</span>}</div>}
        </div>
      </div>
    </div>
  </div>;
}
