import { Check } from '@phosphor-icons/react';
import type { TaskColumn } from '@fouc/shared/tasks';
import styles from './task-board.module.css';

export function TaskStatusIcon({ column }: { column: TaskColumn }) {
  return <span className={styles.statusMarker} data-color={column.color} data-done={column.isDone || undefined} aria-hidden>
    {column.isDone && <Check size={9} weight="bold" />}
  </span>;
}
