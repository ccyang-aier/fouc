'use client';

import type { PointerEvent } from 'react';
import { ArrowSquareOut, DotsThree, NotePencil, Rows, X } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskSchedule } from '@fouc/shared/tasks';
import { AvatarGroup } from '@/components/avatar-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { TaskStatusIcon } from '../task-status-icon';
import { HOUR_HEIGHT, timeLabel, type CalendarEvent as EventLayout } from './calendar-model';
import { messages } from './calendar.messages';
import styles from './calendar.module.css';

export function CalendarEvent({ event, board, busy, dragging, resizing, onOpen, onDetails, onUnschedule, onBegin, onUpdate, suppressClick }: {
  event: EventLayout; board: TaskBoardDetail; busy: boolean; dragging: boolean; resizing: boolean;
  onOpen: (task: BoardTask, anchor: { x: number; y: number }) => void;
  onDetails: (task: BoardTask) => void; onUnschedule: (task: BoardTask) => Promise<boolean>;
  onBegin: (event: PointerEvent<HTMLElement>, task: BoardTask, kind: 'move' | 'resize') => void;
  onUpdate: (task: BoardTask, schedule: TaskSchedule) => Promise<boolean>; suppressClick: () => boolean;
}) {
  const { t, locale } = useTranslation(messages);
  const { task } = event;
  const column = board.columns.find(column => column.id === task.columnId)!;
  const editable = board.permission !== 'viewer';
  const height = (event.end - event.start) / 60 * HOUR_HEIGHT - 3;
  const members = board.members.filter(member => task.assigneeIds.includes(member.userId)).map(member => ({ id: member.userId, name: member.name, image: member.image }));
  function keyboard(event: React.KeyboardEvent<HTMLElement>, resize = false) {
    if (event.target !== event.currentTarget || !editable || busy || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
    const delta = direction * (event.shiftKey || ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 24 * 60 : 15) * 60_000;
    const schedule = task.schedule!;
    const startsAt = Date.parse(schedule.startsAt) + (resize ? 0 : delta), endsAt = Date.parse(schedule.endsAt) + delta;
    if (endsAt <= startsAt) return;
    const focused = event.currentTarget, scope = focused.closest('section');
    void onUpdate(task, { ...schedule, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }).then(saved => {
      if (!saved) return;
      requestAnimationFrame(() => {
        if (!scope?.isConnected || (document.activeElement !== document.body && document.activeElement !== focused)) return;
        const card = scope.querySelector<HTMLElement>(`[data-calendar-task="${task.id}"]`);
        (resize ? card?.querySelector<HTMLButtonElement>('[data-resize-handle]') : card)?.focus();
      });
    });
  }
  return <article className={styles.event} data-calendar-task={task.id} data-color={column.isDone ? 'green' : column.color} data-compact={height < 84 || undefined} data-tiny={height < 45 || undefined} data-dragging={dragging || undefined} data-editable={editable || undefined} data-continuation={event.continuesBefore || undefined}
    style={{ top: `${event.start / 60 * HOUR_HEIGHT + 2}px`, height: `${Math.max(18, height)}px`, left: `calc(${event.lane / event.lanes * 100}% + 7px)`, width: `calc(${100 / event.lanes}% - 14px)` }}
    role="button" tabIndex={0} aria-label={t(editable ? 'editTask' : 'scheduleTask', { title: task.title })}
    onPointerDown={pointer => onBegin(pointer, task, 'move')}
    onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); onOpen(task, { x: rect.right, y: rect.top }); } else keyboard(event); }}
    onClick={pointer => { if (!suppressClick()) { const rect = pointer.currentTarget.getBoundingClientRect(); onOpen(task, { x: rect.right, y: rect.top }); } }}>
    <header className={styles.eventHeader}><span className={styles.eventBadge}><TaskStatusIcon column={column} /><span>{column.name}</span></span>
      <div onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger className={styles.eventMenu} aria-label={t('taskActions', { title: task.title })}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact"><DropdownMenuItem onSelect={() => onDetails(task)}><Rows />{t('details')}</DropdownMenuItem>{editable && <DropdownMenuItem onSelect={() => { const node = document.querySelector<HTMLElement>(`[data-calendar-task="${task.id}"]`); const rect = node?.getBoundingClientRect(); onOpen(task, { x: rect?.right ?? 400, y: rect?.top ?? 200 }); }}><NotePencil />{t('editSchedule')}</DropdownMenuItem>}{task.schedule?.url && <DropdownMenuItem asChild><a href={task.schedule.url} target="_blank" rel="noopener noreferrer"><ArrowSquareOut />{t('openLink')}</a></DropdownMenuItem>}{editable && <><DropdownMenuSeparator /><DropdownMenuItem disabled={busy} onSelect={() => { void onUnschedule(task); }}><X />{t('removeSchedule')}</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div>
    </header>
    <div className={styles.eventContent}><strong>{task.title}</strong><span className={styles.eventTime}>{timeLabel(task.schedule!.startsAt, locale)} – {timeLabel(task.schedule!.endsAt, locale)}</span><p>{task.description}</p><footer><span>{members.length ? t('assignees') : t('unassigned')}</span><AvatarGroup members={members} size={22} maxVisible={3} /></footer></div>
    {editable && !event.continuesAfter && <button type="button" className={`fouc-resize-handle ${styles.resizeEvent}`} data-resize-axis="y" data-resizing={resizing || undefined} data-resize-handle aria-label={t('resize', { title: task.title })} disabled={busy} onPointerDown={pointer => onBegin(pointer, task, 'resize')} onClick={event => event.stopPropagation()} onKeyDown={event => keyboard(event, true)} />}
  </article>;
}
