import { expect, test } from 'bun:test';
import type { TaskLabel } from '@fouc/shared/tasks';
import { appendTaskLabel, collectTaskLabels } from './task-labels-model';

const design: TaskLabel = { name: 'Design', color: 'violet' };

test('collecting labels preserves the first color per name and sorts by name', () => {
  const tasks = [{ labels: [{ name: 'Review', color: 'amber' as const }, design] }, { labels: [{ name: 'Design', color: 'rose' as const }, { name: 'Build', color: 'blue' as const }] }];
  expect(collectTaskLabels(tasks)).toEqual([{ name: 'Build', color: 'blue' }, design, { name: 'Review', color: 'amber' }]);
  expect(tasks[0].labels[0].name).toBe('Review');
});

test('new labels keep the chosen color while an existing name reuses its color', () => {
  expect(appendTaskLabel([], [design], '  Design  ', 'orange')).toEqual({ labels: [design] });
  expect(appendTaskLabel([], [design], 'Research', 'teal')).toEqual({ labels: [{ name: 'Research', color: 'teal' }] });
});

test('empty, overlong and duplicate label names leave the draft untouched', () => {
  const labels = [design];
  expect(appendTaskLabel(labels, [], '  ', 'blue')).toEqual({ error: 'nameRequired' });
  expect(appendTaskLabel(labels, [], 'x'.repeat(41), 'blue')).toEqual({ error: 'nameTooLong' });
  expect(appendTaskLabel(labels, [], 'Design ', 'rose')).toEqual({ error: 'alreadyAdded' });
  expect(labels).toEqual([design]);
});

test('twenty labels is a hard limit and removing one makes room for the next', () => {
  const labels: TaskLabel[] = Array.from({ length: 20 }, (_, index) => ({ name: `Label ${index}`, color: 'blue' }));
  expect(appendTaskLabel(labels, [], 'One more', 'cyan')).toEqual({ error: 'labelLimit' });
  const next = appendTaskLabel(labels.slice(1), [], 'One more', 'cyan');
  expect('labels' in next && next.labels).toHaveLength(20);
  expect(labels).toHaveLength(20);
});
