"use client";

import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import styles from './chat-quick-actions.module.css';

export function ChatPromptTag({ label, removeLabel, onRemove }: {
  label: string;
  removeLabel?: string;
  onRemove?: () => void;
}) {
  return onRemove ? <Button type="button" variant="ghost" className={styles.tag}
    aria-label={removeLabel} onPointerDown={event => event.preventDefault()} onClick={onRemove}>
    <X size={12} aria-hidden="true" /><span>{label}</span>
  </Button> : <span className={`${styles.tag} ${styles.messageTag}`}>{label}</span>;
}
