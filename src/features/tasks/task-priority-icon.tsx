import { Flag, FlagOutline } from '@/components/icons';
import type { TaskPriority } from '@fouc/shared/tasks';
import styles from './task-priority-icon.module.css';

export function TaskPriorityIcon({ priority, size = 16 }: { priority: TaskPriority; size?: number }) {
  const Icon = priority === 'low' ? FlagOutline : Flag;
  return <Icon className={styles.icon} data-priority={priority} data-static-color aria-hidden size={size} />;
}
