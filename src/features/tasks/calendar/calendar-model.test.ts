import { expect, test } from 'bun:test';
import type { BoardTask } from '@fouc/shared/tasks';
import { localDay } from '../task-board-model';
import { addDays, dayDate, layoutDayEvents, makeSchedule, scheduleTaskPatch, shiftAnchor, tasksOnDay, calendarDays } from './calendar-model';

const monday = dayDate('2026-10-19');
test('quick editing patches only changed scheduling fields, preserving other task work', () => {
  const original = { title: 'Review', description: 'Context', columnId: 'todo', priority: 'high', assigneeIds: ['owner'], schedule: null, dueDate: '2026-10-23', labels: ['design'], checklist: [] } as unknown as BoardTask;
  const schedule = makeSchedule(monday);
  expect(scheduleTaskPatch(original, { ...original, schedule })).toEqual({ schedule });
  expect(scheduleTaskPatch(original, { ...original })).toEqual({});
  expect(scheduleTaskPatch(original, { ...original, title: 'New review', assigneeIds: ['editor'] })).toEqual({ title: 'New review', assigneeIds: ['editor'] });
});
function task(id: string, start: number, duration: number): BoardTask {
  return { id, schedule: makeSchedule(monday, start, duration), dueDate: null } as BoardTask;
}

test('day, Monday-based week and month navigate across month and year boundaries', () => {
  expect(calendarDays('2026-10-25', 'week').map(localDay)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  expect(calendarDays('2026-10-19', 'month').map(localDay)).toHaveLength(42);
  expect(localDay(calendarDays('2026-10-19', 'month')[0])).toBe('2026-09-28');
  expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01');
  expect(shiftAnchor('2026-12-29', 'week', 1)).toBe('2027-01-05');
  expect(shiftAnchor('2026-01-01', 'day', -1)).toBe('2025-12-31');
});

test('overlap groups use separate lanes, recycle available lanes, and reset after a gap', () => {
  const events = layoutDayEvents([task('a', 9 * 60, 120), task('b', 9 * 60 + 30, 30), task('c', 10 * 60, 60), task('d', 12 * 60, 60)], monday);
  expect(events.map(event => [event.task.id, event.lane, event.lanes])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 1, 2], ['d', 0, 1]]);
  expect(layoutDayEvents([task('a', 9 * 60, 60), task('b', 10 * 60, 60)], monday).map(event => event.lanes)).toEqual([1, 1]);
});

test('overnight tasks split at local midnight and do not spill onto the exclusive end day', () => {
  const overnight = task('night', 23 * 60, 120);
  expect(layoutDayEvents([overnight], monday)[0]).toMatchObject({ start: 1380, end: 1440, continuesBefore: false, continuesAfter: true });
  expect(layoutDayEvents([overnight], addDays(monday, 1))[0]).toMatchObject({ start: 0, end: 60, continuesBefore: true, continuesAfter: false });
  const endsAtMidnight = task('midnight', 23 * 60, 60);
  expect(tasksOnDay([endsAtMidnight], addDays(monday, 1))).toEqual([]);
});

test('deadlines appear in date views without inventing reserved times or changing task data', () => {
  const due = { id: 'due', dueDate: '2026-10-19', schedule: null } as BoardTask;
  const floating = { ...due, id: 'floating', dueDate: null };
  const timed = task('timed', 9 * 60, 60);
  expect(tasksOnDay([due, floating, timed], monday).map(task => task.id)).toEqual(['due', 'timed']);
  expect(layoutDayEvents([due, floating, timed], monday).map(event => event.task.id)).toEqual(['timed']);
  expect(due.schedule).toBeNull();
});
