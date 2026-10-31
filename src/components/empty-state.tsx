import { cn } from '@/lib/utils';
import { Files } from '@/components/icons';
import styles from './empty-state.module.css';

export function EmptyState({ label, className }: { label: string; className?: string }) {
  return <div className={cn(styles.empty, className)} role="status">
    <Files size={64} className={styles.illustration} aria-hidden />
    <p>{label}</p>
  </div>;
}
