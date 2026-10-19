import type { BoardTask, TaskSchedule } from '@fouc/shared/tasks';
import { localDay } from '../task-board-model';

export type TimelineRange = 'day' | 'week' | 'month';
export const HOUR_HEIGHT = 84;
export const DAY_HEIGHT = HOUR_HEIGHT * 24;
export const SNAP_MINUTES = 15;
const scheduleFields = ['title', 'description', 'columnId', 'priority', 'assigneeIds', 'schedule'] as const;
type ScheduleTaskFields = Pick<BoardTask, typeof scheduleFields[number]>;

/** Quick scheduling never overwrites a task's checklist, tags, or deadline. */
export function scheduleTaskPatch(original: BoardTask, draft: ScheduleTaskFields): Partial<ScheduleTaskFields> {
  return Object.fromEntries(scheduleFields.filter(field => JSON.stringify(original[field]) !== JSON.stringify(draft[field])).map(field => [field, draft[field]]));
}

export function dayDate(day: string) { return new Date(`${day}T00:00:00`); }
export function addDays(date: Date, amount: number) {
  const next = new Date(date); next.setDate(next.getDate() + amount); return next;
}
export function startOfWeek(date: Date) {
  return addDays(dayDate(localDay(date)), -((date.getDay() + 6) % 7));
}
export function timelineDays(anchor: string, range: TimelineRange): Date[] {
  const date = dayDate(anchor);
  const start = range === 'month' ? startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)) : range === 'week' ? startOfWeek(date) : date;
  return Array.from({ length: range === 'month' ? 42 : range === 'week' ? 7 : 1 }, (_, index) => addDays(start, index));
}
export function shiftAnchor(anchor: string, range: TimelineRange, direction: number) {
  const date = dayDate(anchor);
  if (range === 'month') return localDay(new Date(date.getFullYear(), date.getMonth() + direction, 1));
  return localDay(addDays(date, direction * (range === 'week' ? 7 : 1)));
}
export function atMinute(day: Date, minute: number) {
  const next = new Date(day); next.setHours(0, minute, 0, 0); return next;
}
export function localDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${localDay(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function makeSchedule(day: Date, minute = 9 * 60, duration = 60): TaskSchedule {
  return { startsAt: atMinute(day, minute).toISOString(), endsAt: atMinute(day, minute + duration).toISOString(), url: '' };
}
export function timeLabel(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
export function tasksOnDay(tasks: readonly BoardTask[], date: Date) {
  const start = date.getTime(), end = addDays(date, 1).getTime();
  return tasks.filter(task => task.schedule
    ? Date.parse(task.schedule.startsAt) < end && Date.parse(task.schedule.endsAt) > start
    : task.dueDate === localDay(date));
}

export interface TimelineEvent {
  task: BoardTask;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Split overnight reservations and assign a stable column to each collision group. */
export function layoutDayEvents(tasks: readonly BoardTask[], day: Date): TimelineEvent[] {
  const dayStart = day.getTime(), dayEnd = addDays(day, 1).getTime();
  const minutes = (value: string) => { const date = new Date(value); return date.getHours() * 60 + date.getMinutes(); };
  const events: TimelineEvent[] = tasksOnDay(tasks, day).filter(task => task.schedule).map(task => {
    const schedule = task.schedule!;
    return { task, start: Date.parse(schedule.startsAt) < dayStart ? 0 : minutes(schedule.startsAt),
      end: Date.parse(schedule.endsAt) >= dayEnd ? 1440 : minutes(schedule.endsAt),
      lane: 0, lanes: 1, continuesBefore: Date.parse(schedule.startsAt) < dayStart, continuesAfter: Date.parse(schedule.endsAt) > dayEnd };
  }).sort((a, b) => a.start - b.start || b.end - a.end || a.task.id.localeCompare(b.task.id));
  let group: TimelineEvent[] = [], laneEnds: number[] = [], groupEnd = -1;
  function finishGroup() { for (const event of group) event.lanes = laneEnds.length; group = []; laneEnds = []; }
  for (const event of events) {
    if (event.start >= groupEnd) finishGroup();
    let lane = laneEnds.findIndex(end => end <= event.start);
    if (lane === -1) lane = laneEnds.length;
    event.lane = lane; laneEnds[lane] = event.end; group.push(event);
    groupEnd = Math.max(event.end, group.length === 1 ? -1 : groupEnd);
  }
  finishGroup();
  return events;
}
