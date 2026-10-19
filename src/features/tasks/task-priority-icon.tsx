import { Flag } from '@phosphor-icons/react';
import type { TaskPriority } from '@fouc/shared/tasks';
import styles from './task-priority-icon.module.css';

export function TaskPriorityIcon({ priority, size = 16 }: { priority: TaskPriority; size?: number }) {
  return <Flag className={styles.icon} data-priority={priority} data-static-color aria-hidden size={size} weight={priority === 'low' ? 'regular' : 'fill'} />;
}
