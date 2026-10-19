import { expect, test } from 'bun:test';
import { createTaskBoardViewInputSchema, taskBoardViewSchema, taskBoardViewScopeSchema, updateTaskBoardViewInputSchema } from './index';

test('view creation accepts the supported kinds and a trimmed nonempty name only', () => {
  for (const kind of ['kanban', 'calendar', 'spreadsheet'] as const) {
    expect(createTaskBoardViewInputSchema.parse({ name: '  团队视图  ', kind })).toEqual({ name: '团队视图', kind });
  }
  for (const input of [
    { name: ' ', kind: 'kanban' }, { name: 'a'.repeat(121), kind: 'kanban' },
    { name: 'View', kind: 'timeline' }, { name: 'View', kind: 'calendar', id: crypto.randomUUID() },
  ]) expect(createTaskBoardViewInputSchema.safeParse(input).success).toBe(false);
});

test('view renames cannot change their identity or rendering kind', () => {
  expect(updateTaskBoardViewInputSchema.parse({ name: ' Renamed ' })).toEqual({ name: 'Renamed' });
  for (const input of [{}, { name: '' }, { name: 'View', kind: 'kanban' }, { name: 'View', id: crypto.randomUUID() }]) {
    expect(updateTaskBoardViewInputSchema.safeParse(input).success).toBe(false);
  }
  const view = { id: crypto.randomUUID(), name: 'View', kind: 'kanban' as const };
  expect(taskBoardViewSchema.parse(view)).toEqual(view);
  expect(taskBoardViewScopeSchema.safeParse({ projectId: crypto.randomUUID(), boardId: crypto.randomUUID(), viewId: 'invalid' }).success).toBe(false);
});
