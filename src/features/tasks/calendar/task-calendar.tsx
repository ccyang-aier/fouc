'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight, Clock, Plus, Tray } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskSchedule } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSearch, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { usePageSessionState } from '@/lib/page-session-state';
import { usePageVisible } from '@/lib/page-visibility';
import type { TaskDraft } from '../task-board-client';
import { localDay, taskReference } from '../task-board-model';
import { CalendarGrid } from './calendar-grid';
import { CalendarMonth } from './calendar-month';
import { CalendarScheduleForm, type ScheduleEditor } from './calendar-schedule-form';
import { dayDate, makeSchedule, shiftAnchor, calendarDays, type CalendarRange } from './calendar-model';
import { messages } from './calendar.messages';
import styles from './calendar.module.css';

export function TaskCalendar({ board, tasks, busy, onSave, onSchedule, onDetails }: {
  board: TaskBoardDetail; tasks: BoardTask[]; busy: boolean;
  onSave: (draft: TaskDraft, original?: BoardTask) => Promise<boolean>;
  onSchedule: (task: BoardTask, schedule: TaskSchedule | null) => Promise<boolean>;
  onDetails: (task: BoardTask) => void;
}) {
  const { t, locale } = useTranslation(messages);
  const visible = usePageVisible();
  const [range, setRange] = usePageSessionState<CalendarRange>(`tasks:${board.id}:calendar:range`, 'week');
  const [anchor, setAnchor] = usePageSessionState<string>(`tasks:${board.id}:calendar:anchor`, localDay());
  const [editor, setEditor] = useState<ScheduleEditor | null>(null);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => new Date());
  const create = useRef<HTMLButtonElement>(null);
  const days = useMemo(() => calendarDays(anchor, range), [anchor, range]);
  const editable = board.permission !== 'viewer';
  const unscheduled = tasks.filter(task => !task.schedule);
  const matching = unscheduled.filter(task => `${taskReference(task)} ${task.title} ${task.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  useEffect(() => { if (!visible) return; const timer = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer); }, [visible]);
  const formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: range === 'month' ? 'long' : 'short', ...(range === 'month' ? {} : { day: 'numeric' }) });
  const heading = range === 'week' ? formatter.formatRange(days[0], days[6]) : formatter.format(dayDate(anchor));
  function open(task: BoardTask, point: { x: number; y: number }) {
    if (busy) return;
    if (!editable) { onDetails(task); return; }
    setEditor({ task, schedule: task.schedule ?? makeSchedule(dayDate(anchor)), anchor: point });
  }
  function newSchedule(schedule = makeSchedule(dayDate(anchor)), point?: { x: number; y: number }) {
    if (!editable || busy) return;
    const rect = create.current?.getBoundingClientRect();
    setEditor({ task: null, schedule, anchor: point ?? { x: rect?.left ?? 600, y: (rect?.bottom ?? 160) + 8 } });
  }
  const unschedule = (task: BoardTask) => onSchedule(task, null);
  return <section className={styles.calendar} aria-label={t('calendar')}>
    <div className={styles.calendarToolbar}>
      <div className={styles.dateNavigation}><h2 aria-live="polite">{heading}</h2><div className={styles.periodArrows}>
        <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.navButton}`} aria-label={t('previous')} onClick={() => setAnchor(shiftAnchor(anchor, range, -1))}><CaretLeft size={16} /></button></TooltipTrigger><TooltipContent>{t('previous')}</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.navButton}`} aria-label={t('next')} onClick={() => setAnchor(shiftAnchor(anchor, range, 1))}><CaretRight size={16} /></button></TooltipTrigger><TooltipContent>{t('next')}</TooltipContent></Tooltip>
      </div><Button variant="outline" size="sm" className={styles.todayButton} onClick={() => { setNow(new Date()); setAnchor(localDay()); }}>{t('today')}</Button><label className={styles.datePicker}><CalendarBlank size={16} /><input type="date" aria-label={t('chooseDate')} value={anchor} onChange={event => { if (event.target.value) setAnchor(event.target.value); }} /></label></div>
      <div className={styles.calendarTools}><div className={styles.rangeSwitcher} role="group" aria-label={t('range')}>{(['day', 'week', 'month'] as const).map(value => <button key={value} type="button" className={`fouc-action ${styles.rangeButton}`} aria-pressed={range === value} onClick={() => setRange(value)}>{t(value)}</button>)}</div>
        <DropdownMenu onOpenChange={open => { if (open) setSearch(''); }}><DropdownMenuTrigger className={styles.unscheduledTrigger} aria-label={t('unscheduledCount', { count: unscheduled.length })}><Tray size={16} /><span>{t('unscheduled')}</span><span className={styles.unscheduledBadge}>{unscheduled.length}</span></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact" className={styles.unscheduledMenu}><DropdownMenuSearch value={search} onValueChange={setSearch} placeholder={t('searchUnscheduled')} clearLabel={t('clearSearch')} /><div className={styles.unscheduledList}>{matching.map(task => <DropdownMenuItem key={task.id} className={styles.unscheduledItem} onSelect={event => { const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); open(task, { x: rect.right, y: rect.top }); }}><Clock size={16} /><span><strong>{task.title}</strong><small>{taskReference(task)}{task.dueDate ? ` · ${task.dueDate}` : ''}</small></span></DropdownMenuItem>)}{!matching.length && <p className={styles.menuEmpty}>{t(unscheduled.length ? 'noResults' : 'allScheduled')}</p>}</div></DropdownMenuContent></DropdownMenu>
        {editable && <Button ref={create} size="sm" className={styles.newSchedule} disabled={busy} onClick={() => newSchedule()}><Plus size={15} />{t('newSchedule')}</Button>}
      </div>
    </div>
    {range === 'month' ? <CalendarMonth days={days} anchor={anchor} tasks={tasks} board={board} today={localDay(now)} busy={busy} onDay={day => { setAnchor(day); setRange('day'); }} onOpen={open} onCreate={newSchedule} />
      : <CalendarGrid days={days} tasks={tasks} board={board} now={now} busy={busy} onCreate={newSchedule} onOpen={open} onDetails={onDetails} onUpdate={onSchedule} onUnschedule={unschedule} />}
    <footer className={styles.calendarLegend}>{board.columns.map(column => <span key={column.id}><i data-color={column.isDone ? 'green' : column.color} />{column.name}</span>)}{editable && <Tooltip><TooltipTrigger asChild><span className={styles.dragHelp} tabIndex={0}><Clock size={12} />{t('schedule')}</span></TooltipTrigger><TooltipContent>{t('dragHint')}</TooltipContent></Tooltip>}</footer>
    {editor && editable && (!editor.task || board.tasks.some(task => task.id === editor.task!.id)) && <CalendarScheduleForm key={`${editor.task?.id ?? 'new'}:${editor.schedule.startsAt}`} editor={editor} board={board} onClose={() => setEditor(null)} onSave={onSave} onUnschedule={unschedule} onDetails={task => { setEditor(null); onDetails(task); }} />}
  </section>;
}
