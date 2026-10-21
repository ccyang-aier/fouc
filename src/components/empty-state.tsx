import { Tray } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import styles from './empty-state.module.css';

export function EmptyState({ label, className }: { label: string; className?: string }) {
  return <div className={cn(styles.empty, className)} role="status">
    <Tray size={56} weight="duotone" className={styles.illustration} aria-hidden />
    <p>{label}</p>
  </div>;
}
