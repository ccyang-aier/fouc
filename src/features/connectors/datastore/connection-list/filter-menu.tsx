'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './filter-menu.messages';
import { CaretDown } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './connection-list.module.css';
export function ConnectionFilterMenu({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: readonly string[];
  options: readonly {
    value: string;
    label: string;
  }[];
  onChange: (values: string[]) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={styles.filterButton}
          data-active={values.length > 0}
          aria-label={tConnector('filter', {
            p0: String(label),
            p1: String(values.length ? tConnector('selected', { p0: String(values.length) }) : ''),
          })}
        >
          <span>{label}</span>
          {values.length > 0 && <small>{values.length}</small>}
          <CaretDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={styles.filterMenu}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={values.includes(option.value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...values, option.value]
                  : values.filter((value) => value !== option.value),
              )
            }
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {!options.length && <DropdownMenuItem disabled>{tConnector('noOptions')}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!values.length}
          onSelect={(event) => {
            event.preventDefault();
            onChange([]);
          }}
        >
          {tConnector('clearFilters')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
