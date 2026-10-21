'use client';

import { CalendarBlank, X } from '@phosphor-icons/react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import styles from './task-date-input.module.css';

export function TaskDateInput({ type = 'date', className, value, onClear, clearLabel, ...props }: Omit<ComponentProps<'input'>, 'type'> & {
  type?: 'date' | 'datetime-local'; onClear?: () => void; clearLabel?: string;
}) {
  const clearable = Boolean(onClear && value && !props.disabled);
  return <span className={styles.control} data-clearable={clearable || undefined}>
    <input {...props} type={type} value={value} className={cn(styles.input, className)} />
    {clearable && <Button type="button" variant="ghost" size="icon-sm" className={styles.clear} aria-label={clearLabel} onClick={onClear}><X size={12} /></Button>}
    <CalendarBlank className={styles.icon} size={16} aria-hidden />
  </span>;
}
