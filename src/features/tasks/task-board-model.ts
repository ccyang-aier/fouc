import type { BoardTask, TaskBoardDetail, TaskPriority } from '@fouc/shared/tasks';

export type TaskFilters = { query: string; assignee: string; priority: TaskPriority | 'all'; due: 'all' | 'overdue' | 'week'; label: string };
export type TaskSort = 'manual' | 'priority' | 'due' | 'updated' | 'title';
export const emptyTaskFilters: TaskFilters = { query: '', assignee: 'all', priority: 'all', due: 'all', label: '' };
export const taskReference = (task: Pick<BoardTask, 'number'>) => `TASK-${task.number}`;
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function isTaskOverdue(task: BoardTask, board: TaskBoardDetail, today = localDay()) {
  return Boolean(task.dueDate && task.dueDate < today && !board.columns.find(column => column.id === task.columnId)?.isDone);
}
export function hasTaskFilters(filters: TaskFilters) {
  return Boolean(filters.query.trim() || filters.assignee !== 'all' || filters.priority !== 'all' || filters.due !== 'all' || filters.label);
}
const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export function selectTasks(board: TaskBoardDetail, filters: TaskFilters, sort: TaskSort, actorId: string, now = new Date()) {
  const today = localDay(now);
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return board.tasks.filter(task => {
    const text = `${taskReference(task)} ${task.title} ${task.description} ${task.labels.map(label => label.name).join(' ')}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term))
      && (filters.assignee === 'all' || (filters.assignee === 'unassigned' ? !task.assigneeIds.length : task.assigneeIds.includes(filters.assignee === 'me' ? actorId : filters.assignee)))
      && (filters.priority === 'all' || task.priority === filters.priority)
      && (!filters.label || task.labels.some(label => label.name === filters.label))
      && (filters.due === 'all' || (filters.due === 'overdue' ? isTaskOverdue(task, board, today) : Boolean(task.dueDate && task.dueDate >= today && task.dueDate <= localDay(weekEnd))));
  }).toSorted((a, b) => {
    const compared = sort === 'priority' ? priorityOrder[a.priority] - priorityOrder[b.priority]
      : sort === 'due' ? (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
      : sort === 'updated' ? b.updatedAt.localeCompare(a.updatedAt)
      : sort === 'title' ? a.title.localeCompare(b.title) : 0;
    return compared || a.position - b.position || a.id.localeCompare(b.id);
  });
}
