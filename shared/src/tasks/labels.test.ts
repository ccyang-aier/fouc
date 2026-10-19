import { expect, test } from 'bun:test';
import { createBoardTaskInputSchema, TASK_LABEL_COLORS, taskLabelSchema, updateBoardTaskInputSchema } from './index';

test('task labels require a supported color and a trimmed nonempty bounded name', () => {
  for (const color of TASK_LABEL_COLORS) expect(taskLabelSchema.parse({ name: '  设计  ', color })).toEqual({ name: '设计', color });
  for (const input of [
    'Design', { name: 'Design' }, { name: ' ', color: 'blue' }, { name: 'a'.repeat(41), color: 'blue' },
    { name: 'Design', color: '#ffffff' }, { name: 'Design', color: 'blue', id: crypto.randomUUID() },
  ]) expect(taskLabelSchema.safeParse(input).success).toBe(false);
});

test('task label arrays deduplicate trimmed names while keeping their first color', () => {
  const labels = [{ name: ' Design ', color: 'violet' as const }, { name: 'Design', color: 'rose' as const }, { name: 'Review', color: 'amber' as const }];
  const expected = [{ name: 'Design', color: 'violet' as const }, { name: 'Review', color: 'amber' as const }];
  expect(createBoardTaskInputSchema.parse({ columnId: crypto.randomUUID(), title: 'Task', labels }).labels).toEqual(expected);
  expect(updateBoardTaskInputSchema.parse({ labels }).labels).toEqual(expected);
  expect(updateBoardTaskInputSchema.parse({ labels: [] })).toEqual({ labels: [] });
  expect(updateBoardTaskInputSchema.parse({ title: 'Renamed' }).labels).toBeUndefined();
  expect(createBoardTaskInputSchema.parse({ columnId: crypto.randomUUID(), title: 'Task' }).labels).toEqual([]);
  const tooMany = TASK_LABEL_COLORS.flatMap(color => Array.from({ length: 3 }, (_, index) => ({ name: `${color} ${index}`, color })));
  expect(createBoardTaskInputSchema.safeParse({ columnId: crypto.randomUUID(), title: 'Task', labels: tooMany }).success).toBe(false);
  expect(updateBoardTaskInputSchema.safeParse({ labels: tooMany }).success).toBe(false);
});
