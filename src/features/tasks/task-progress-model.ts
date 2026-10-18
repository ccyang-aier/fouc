import type { BoardTask } from '@fouc/shared/tasks';

export type TaskProgressState = {
  done: number;
  total: number;
  percent: number;
  fraction: number;
  completed: boolean;
  daysRemaining: number | null;
  risk: 'dueSoon' | 'overdue' | null;
};

/** Due dates are calendar dates, so elapsed hours and DST do not change the cutoff. */
export function taskProgress(task: Pick<BoardTask, 'checklist' | 'dueDate'>, completed: boolean, now = new Date()): TaskProgressState {
  const total = task.checklist.length;
  const done = task.checklist.filter(item => item.done).length;
  const fraction = completed ? 1 : total ? done / total : 0;
  const percent = Math.round(fraction * 100);
  let daysRemaining: number | null = null;
  if (task.dueDate) {
    const [year, month, day] = task.dueDate.split('-').map(Number);
    daysRemaining = (Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000;
  }
  const atRisk = fraction < .7 && daysRemaining !== null && daysRemaining <= 2;
  return { done, total, percent, fraction, completed, daysRemaining, risk: atRisk ? daysRemaining! < 0 ? 'overdue' : 'dueSoon' : null };
}
