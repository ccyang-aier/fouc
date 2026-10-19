import type { BoardTask, TaskLabel, TaskLabelColor } from '@fouc/shared/tasks';

export type TaskLabelIssue = 'nameRequired' | 'nameTooLong' | 'alreadyAdded' | 'labelLimit';

export function collectTaskLabels(tasks: readonly Pick<BoardTask, 'labels'>[]): TaskLabel[] {
  const labels = new Map<string, TaskLabel>();
  for (const task of tasks) for (const label of task.labels) if (!labels.has(label.name)) labels.set(label.name, label);
  return [...labels.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function appendTaskLabel(labels: TaskLabel[], availableLabels: TaskLabel[], name: string, color: TaskLabelColor): { labels: TaskLabel[] } | { error: TaskLabelIssue } {
  const trimmedName = name.trim();
  if (!trimmedName) return { error: 'nameRequired' };
  if (trimmedName.length > 40) return { error: 'nameTooLong' };
  if (labels.some(label => label.name === trimmedName)) return { error: 'alreadyAdded' };
  if (labels.length >= 20) return { error: 'labelLimit' };
  const label = availableLabels.find(label => label.name === trimmedName) ?? { name: trimmedName, color };
  return { labels: [...labels, label] };
}
