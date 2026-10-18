import { expect, test } from 'bun:test';
import type { TaskChecklistItem } from '@fouc/shared/tasks';
import { taskProgress } from './task-progress-model';

function checklist(total: number, done: number): TaskChecklistItem[] {
  return Array.from({ length: total }, (_, index) => ({ id: String(index), title: `Item ${index}`, done: index < done }));
}
const today = new Date(2026, 9, 19, 12);

test('progress follows the actual checklist, while a completed status is always 100%', () => {
  expect(taskProgress({ checklist: checklist(4, 1), dueDate: null }, false, today)).toMatchObject({ done: 1, total: 4, percent: 25, fraction: .25, risk: null });
  expect(taskProgress({ checklist: [], dueDate: null }, false, today)).toMatchObject({ done: 0, total: 0, percent: 0, fraction: 0 });
  expect(taskProgress({ checklist: checklist(4, 1), dueDate: '2026-10-01' }, true, today)).toMatchObject({ done: 1, total: 4, percent: 100, fraction: 1, risk: null });
  expect(taskProgress({ checklist: checklist(4, 4), dueDate: '2026-10-01' }, false, today)).toMatchObject({ percent: 100, risk: null });
});

test('deadline risk includes today, overdue and exactly two calendar days, below 70% only', () => {
  const incomplete = checklist(10, 6);
  expect(taskProgress({ checklist: incomplete, dueDate: '2026-10-19' }, false, today)).toMatchObject({ daysRemaining: 0, risk: 'dueSoon' });
  expect(taskProgress({ checklist: incomplete, dueDate: '2026-10-21' }, false, today)).toMatchObject({ daysRemaining: 2, risk: 'dueSoon' });
  expect(taskProgress({ checklist: incomplete, dueDate: '2026-10-22' }, false, today).risk).toBeNull();
  expect(taskProgress({ checklist: incomplete, dueDate: '2026-10-18' }, false, today)).toMatchObject({ daysRemaining: -1, risk: 'overdue' });
  expect(taskProgress({ checklist: checklist(10, 7), dueDate: '2026-10-18' }, false, today).risk).toBeNull();
  // Rounding the display to 70% must not suppress a still-below-70% warning.
  expect(taskProgress({ checklist: checklist(23, 16), dueDate: '2026-10-19' }, false, today)).toMatchObject({ percent: 70, risk: 'dueSoon' });
});

test('calendar cutoffs use local date fields rather than UTC dates or elapsed hours', () => {
  expect(taskProgress({ checklist: [], dueDate: '2026-10-21' }, false, new Date(2026, 9, 19, 0, 5))).toMatchObject({ daysRemaining: 2, risk: 'dueSoon' });
  expect(taskProgress({ checklist: [], dueDate: '2026-10-22' }, false, new Date(2026, 9, 19, 23, 59))).toMatchObject({ daysRemaining: 3, risk: null });
  expect(taskProgress({ checklist: [], dueDate: '2027-01-01' }, false, new Date(2026, 11, 30, 23, 59))).toMatchObject({ daysRemaining: 2, risk: 'dueSoon' });
});

test('an unfinished task without a checklist is 0%, and warns only with an approaching deadline', () => {
  expect(taskProgress({ checklist: [], dueDate: null }, false, today)).toMatchObject({ percent: 0, daysRemaining: null, risk: null });
  expect(taskProgress({ checklist: [], dueDate: '2026-10-20' }, false, today)).toMatchObject({ percent: 0, risk: 'dueSoon' });
  expect(taskProgress({ checklist: [], dueDate: '2026-10-20' }, true, today)).toMatchObject({ percent: 100, risk: null });
});
