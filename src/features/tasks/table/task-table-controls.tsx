'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { TaskColumn } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSearch, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { TaskStatusIcon } from '../task-status-icon';
import { messages as progressMessages } from '../task-progress.messages';
import styles from './task-table.module.css';

export function TaskSelectionBox({ checked, mixed = false, disabled, label, onChange }: {
  checked: boolean; mixed?: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { if (input.current) input.current.indeterminate = mixed; }, [mixed]);
  return <input ref={input} className={styles.checkbox} type="checkbox" aria-label={label} aria-checked={mixed ? 'mixed' : checked} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />;
}

export function TaskTableStatusMenu({ columns, currentIds, disabled, label, className, onChange, children }: {
  columns: TaskColumn[]; currentIds: string[]; disabled: boolean; label: string; className?: string;
  onChange: (columnId: string) => void; children: ReactNode;
}) {
  const { t } = useTranslation(progressMessages);
  const [query, setQuery] = useState('');
  const matching = columns.filter(column => column.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <DropdownMenu onOpenChange={open => { if (open) setQuery(''); }}>
    <DropdownMenuTrigger disabled={disabled} aria-label={label} className={className ?? styles.statusTrigger} data-surface="plain">{children}<CaretDown size={12} aria-hidden /></DropdownMenuTrigger>
    <DropdownMenuContent align="start" density="compact" className={styles.statusMenu}>
      <DropdownMenuSearch value={query} onValueChange={setQuery} placeholder={t('searchStatuses')} clearLabel={t('clearSearch')} />
      <div className={styles.statusOptions}>{matching.map(column => <DropdownMenuItem key={column.id} disabled={currentIds.every(id => id === column.id)} onSelect={() => onChange(column.id)}><TaskStatusIcon column={column} />{column.name}</DropdownMenuItem>)}
        {!matching.length && <p className={styles.menuEmpty} role="status">{t('noStatuses')}</p>}</div>
    </DropdownMenuContent>
  </DropdownMenu>;
}
