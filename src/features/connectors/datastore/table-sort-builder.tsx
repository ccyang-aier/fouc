'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-sort-builder.messages';
import { Check } from '@phosphor-icons/react';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { DatabaseColumnInfo } from '@fouc/shared';
import type { SortDraft } from './table-sort-model';
import { QueryRuleActions, QueryRuleHandle } from './table-query-row-actions';
import { TableQuerySelect } from './table-query-select';
import { useQueryRuleReorder } from './use-query-rule-reorder';
import styles from './table-query.module.css';
export function TableSortBuilder({
  sort,
  columns,
  disabled,
  onChange,
}: {
  sort: SortDraft[];
  columns: DatabaseColumnInfo[];
  disabled: boolean;
  onChange: (sort: SortDraft[]) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const {
    list: listRef,
    row: rowProps,
    handle: dragHandle,
  } = useQueryRuleReorder(sort.length, disabled, move);
  function update(id: string, value: Partial<SortDraft>) {
    onChange(sort.map((item) => (item.id === id ? { ...item, ...value } : item)));
  }
  function move(index: number, target: number) {
    if (target < 0 || target >= sort.length) return;
    const next = [...sort],
      [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }
  return (
    <section
      ref={listRef}
      data-query-rule-list
      className={styles.sorting}
      aria-label={tConnector('databaseCollation')}
    >
      {sort.map((item, index) => (
        <div
          key={item.id}
          {...rowProps(index)}
          className={styles.sortRow}
          data-enabled={item.enabled}
        >
          <QueryRuleHandle
            kind="sort"
            index={index}
            count={sort.length}
            disabled={disabled}
            onMove={(target) => move(index, target)}
            drag={dragHandle(index)}
          >
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => update(item.id, { nulls: 'first' })}
            >
              <span className={styles.menuCheck}>
                {item.nulls === 'first' && <Check size={16} />}
              </span>
              {tConnector('nullFirst')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => update(item.id, { nulls: 'last' })}
            >
              <span className={styles.menuCheck}>
                {item.nulls === 'last' && <Check size={16} />}
              </span>
              {tConnector('nullLast')}
            </DropdownMenuItem>
          </QueryRuleHandle>
          <div className={styles.sortFields}>
            <TableQuerySelect
              label={tConnector('sortColumn', { p0: String(index + 1) })}
              placeholder={tConnector('selectField')}
              autoFocus
              disabled={disabled || !item.enabled}
              value={item.column}
              options={columns
                .filter(
                  (column) =>
                    column.name === item.column ||
                    !sort.some((rule) => rule.column === column.name && rule.enabled),
                )
                .map((column) => ({ value: column.name, label: column.name }))}
              onChange={(column) => update(item.id, { column })}
            />
            <TableQuerySelect
              label={tConnector('sortDirection', { p0: String(index + 1) })}
              disabled={disabled || !item.enabled}
              value={item.direction}
              options={[
                { value: 'asc', label: 'ASC' },
                { value: 'desc', label: 'DESC' },
              ]}
              onChange={(direction) => update(item.id, { direction })}
            />
          </div>
          <QueryRuleActions
            kind="sort"
            disabled={disabled}
            enabled={item.enabled}
            onOnly={() => onChange(sort.map((rule) => ({ ...rule, enabled: rule.id === item.id })))}
            onToggle={() => update(item.id, { enabled: !item.enabled })}
            onRemove={() => onChange(sort.filter((rule) => rule.id !== item.id))}
          />
        </div>
      ))}
    </section>
  );
}
