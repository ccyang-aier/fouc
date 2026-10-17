import type { ReactNode, RefObject } from 'react';
import { XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import styles from './chat-context-toolbar.module.css';

export function ChatContextChip({ selected, label, accessibleLabel, clearLabel, icon, triggerRef, onClear }: {
  selected: boolean;
  label: string;
  accessibleLabel: string;
  clearLabel: string;
  icon: ReactNode;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClear: () => void;
}) {
  return <div className={`fouc-action ${styles.contextChip}`} data-selected={selected}>
    <DropdownMenuTrigger asChild>
      <Button ref={triggerRef} type="button" variant="ghost" className={styles.resourceButton} aria-label={accessibleLabel}>
        <span className={styles.contextIcon} aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </Button>
    </DropdownMenuTrigger>
    {selected ? <button type="button" className={`fouc-action ${styles.clearContext}`} aria-label={clearLabel}
      title={clearLabel} onClick={onClear}>
      <XCircle size={16} weight="fill" aria-hidden="true" />
    </button> : null}
  </div>;
}
