'use client';

import { CaretDown } from '@phosphor-icons/react';
import { useState, type ReactNode, type Ref } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSearch, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { defineMessages, useTranslation } from '@/lib/i18n';
import styles from './task-select.module.css';

const messages = defineMessages({
  search: ['搜索选项…', 'Search options…'],
  clear: ['清除搜索', 'Clear search'],
  empty: ['没有匹配结果', 'No matching results'],
});

export type TaskSelectOption<Value extends string = string> = {
  value: Value; label: string; icon?: ReactNode; keywords?: string;
};

export function TaskSelect<Value extends string>({ value, onValueChange, options, ariaLabel, id, disabled, placeholder, searchable = false, searchPlaceholder, className = '', triggerRef }: {
  value: Value; onValueChange: (value: Value) => void; options: readonly TaskSelectOption<Value>[];
  ariaLabel: string; id?: string; disabled?: boolean; placeholder?: string; searchable?: boolean;
  searchPlaceholder?: string; className?: string; triggerRef?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation(messages);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = options.filter(option => `${option.label} ${option.keywords ?? ''}`.toLocaleLowerCase().includes(normalizedQuery));

  return <DropdownMenu onOpenChange={open => { if (open) setQuery(''); }}>
    <DropdownMenuTrigger type="button" id={id} ref={triggerRef} disabled={disabled} aria-label={ariaLabel} className={`${styles.trigger} ${className}`}>
      {selected?.icon && <span className={styles.optionIcon}>{selected.icon}</span>}
      <span className={styles.value} data-placeholder={!selected || undefined}>{selected?.label ?? placeholder}</span>
      <CaretDown className={styles.caret} size={12} aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" density="compact" className={styles.menu} aria-label={ariaLabel}>
      {searchable && <DropdownMenuSearch value={query} onValueChange={setQuery} placeholder={searchPlaceholder ?? t('search')} clearLabel={t('clear')} />}
      <DropdownMenuRadioGroup value={value} onValueChange={next => onValueChange(next as Value)} className={styles.options}>
        {matches.map(option => <DropdownMenuRadioItem key={option.value} value={option.value} indicator={option.icon ? 'none' : 'check'} className={styles.option}>
          {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
          <span className={styles.optionLabel}>{option.label}</span>
        </DropdownMenuRadioItem>)}
        {!matches.length && <p className={styles.empty}>{t('empty')}</p>}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
