import { expect, test } from 'bun:test';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';
import { emptyTaskFilters, hasTaskFilters, isTaskOverdue, selectTasks } from './task-board-model';

const base: BoardTask = { id: 'a', columnId: 'todo', title: '交付登录界面', description: '完善异常反馈', priority: 'medium', assigneeIds: ['alice'], labels: ['设计'], dueDate: '2026-10-17', checklist: [], position: 0, createdBy: 'alice', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', commentCount: 0 };
const board = { columns: [{ id: 'todo', isDone: false }, { id: 'done', isDone: true }], tasks: [base, { ...base, id: 'b', columnId: 'done', title: '已完成', priority: 'urgent', assigneeIds: [], position: 1 }, { ...base, id: 'c', title: '发布', labels: ['研发'], priority: 'high', dueDate: '2026-10-24', position: 2 }] } as TaskBoardDetail;
const today = new Date('2026-10-18T12:00:00');

test('search combines title, description and label terms with assignee and priority filters', () => {
  expect(selectTasks(board, { ...emptyTaskFilters, query: '登录 异常 设计', assignee: 'me' }, 'manual', 'alice', today).map(task => task.id)).toEqual(['a']);
  expect(selectTasks(board, { ...emptyTaskFilters, assignee: 'unassigned', priority: 'urgent' }, 'manual', 'alice', today).map(task => task.id)).toEqual(['b']);
  expect(selectTasks(board, { ...emptyTaskFilters, label: '研发' }, 'manual', 'alice', today).map(task => task.id)).toEqual(['c']);
  expect(hasTaskFilters({ ...emptyTaskFilters, query: '   ' })).toBe(false);
});
test('overdue excludes completed work; upcoming dates use local calendar days', () => {
  expect(isTaskOverdue(board.tasks[1], board, '2026-10-18')).toBe(false);
  expect(selectTasks(board, { ...emptyTaskFilters, due: 'overdue' }, 'manual', 'alice', today).map(task => task.id)).toEqual(['a']);
  expect(selectTasks(board, { ...emptyTaskFilters, due: 'week' }, 'manual', 'alice', today).map(task => task.id)).toEqual(['c']);
});
test('priority and date sorts preserve canonical order without modifying the source', () => {
  expect(selectTasks(board, emptyTaskFilters, 'priority', 'alice', today).map(task => task.id)).toEqual(['b', 'c', 'a']);
  expect(selectTasks(board, emptyTaskFilters, 'due', 'alice', today).map(task => task.id)).toEqual(['a', 'b', 'c']);
  expect(board.tasks.map(task => task.id)).toEqual(['a', 'b', 'c']);
});
