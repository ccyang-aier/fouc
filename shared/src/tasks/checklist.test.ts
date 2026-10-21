import { expect, test } from 'bun:test';
import { createBoardTaskInputSchema, updateBoardTaskInputSchema } from './index';

test('subtasks have one optional assignee and retain stable IDs when edited', () => {
  const assigneeId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const created = createBoardTaskInputSchema.parse({ columnId: crypto.randomUUID(), title: 'Task', checklist: [{ title: 'Unassigned' }, { id, title: 'Assigned', assigneeId }] });
  expect(created.checklist.map(item => item.assigneeId)).toEqual([null, assigneeId]);
  expect(updateBoardTaskInputSchema.parse({ checklist: [{ id, title: 'Cleared', assigneeId: null }] }).checklist?.[0]).toEqual({ id, title: 'Cleared', done: false, assigneeId: null });
});

test('subtask assignments reject malformed IDs and multi-assignee payloads', () => {
  for (const item of [{ title: 'Invalid', assigneeId: 'someone' }, { title: 'Invalid', assigneeId: [crypto.randomUUID()] }, { title: 'Invalid', assigneeIds: [crypto.randomUUID()] }]) {
    expect(updateBoardTaskInputSchema.safeParse({ checklist: [item] }).success).toBe(false);
  }
});
