'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './column-actions.messages';
import { useId, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
  CaretDown,
  Code,
  Database,
  Eraser,
  Funnel,
} from '@phosphor-icons/react';
import type { DatabaseCell } from '@fouc/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TableGridContextActions } from './context-actions';
import type { GridColumnValueOption } from './column-filter-model';
import { ColumnValueFilter } from './column-value-filter';
import styles from './column-actions.module.css';
export type GridColumnQueryActions = {
  options: (column: number) => GridColumnValueOption[];
  localSelected: (column: number) => readonly string[] | null;
  localSort: {
    column: number;
    direction: 'asc' | 'desc';
  } | null;
  databaseFiltered: (column: string) => boolean;
  onLocalFilter: (column: number, selected: readonly string[] | null) => void;
  onDatabaseFilter: (column: string, values: DatabaseCell[] | null) => void;
  onClearSort: (column: string) => void;
};
export function GridColumnActions({
  name,
  column,
  direction,
  priority,
  sortable,
  disabled,
  formatted,
  actions,
  queryActions,
  onFormat,
  onClearFormat,
}: {
  name: string;
  column: number;
  direction?: 'asc' | 'desc';
  priority?: number;
  sortable: boolean;
  disabled: boolean;
  formatted: boolean;
  actions?: TableGridContextActions;
  queryActions?: GridColumnQueryActions;
  onFormat: () => void;
  onClearFormat: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const anchor = useRef<HTMLDivElement>(null),
    returnFocus = useRef<HTMLButtonElement>(null),
    id = useId();
  const [filterMode, setFilterMode] = useState<'local' | 'database' | null>(null);
  const [sortOpen, setSortOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const localDirection =
    queryActions?.localSort?.column === column ? queryActions.localSort.direction : undefined;
  const shownDirection = localDirection ?? direction;
  const filtered =
    (queryActions?.localSelected(column) !== null &&
      queryActions?.localSelected(column) !== undefined) ||
    queryActions?.databaseFiltered(name);
  function clear() {
    if (formatted) onClearFormat();
    queryActions?.onLocalFilter(column, null);
    if (queryActions?.databaseFiltered(name)) queryActions.onDatabaseFilter(name, null);
  }
  return (
    <div
      ref={anchor}
      className={styles.actions}
      data-grid-column-actions
      onClick={(event) => event.stopPropagation()}
    >
      {sortable && (
        <DropdownMenu
          modal={false}
          open={sortOpen}
          onOpenChange={(open) => {
            setSortOpen(open);
            if (open) setFilterMode(null);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`fouc-action ${styles.icon}`}
              data-variant="nested"
              disabled={disabled || !actions}
              aria-label={tConnector('sortMenuFor', { p0: String(name) })}
              data-active={sortOpen || !!shownDirection || undefined}
            >
              {shownDirection === 'asc' ? (
                <ArrowUp size={15} />
              ) : shownDirection === 'desc' ? (
                <ArrowDown size={15} />
              ) : (
                <ArrowsDownUp size={15} />
              )}
              {priority !== undefined && <b>{priority}</b>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            density="compact"
            align="end"
            sideOffset={3}
            aria-label={tConnector('sort', { p0: String(name) })}
            className={styles.menu}
          >
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => actions?.onDatabaseSort(name, 'asc')}
            >
              <Database />
              {tConnector('sortAscendingInDatabase')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => actions?.onDatabaseSort(name, 'desc')}
            >
              <Database />
              {tConnector('sortDescendingInDatabase')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => actions?.onPageSort(column, 'asc')}
            >
              <ArrowUp />
              {tConnector('sortCurrentPageAscending')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => actions?.onPageSort(column, 'desc')}
            >
              <ArrowDown />
              {tConnector('sortCurrentPageDescending')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={disabled || !shownDirection || !queryActions}
              onSelect={() => queryActions?.onClearSort(name)}
            >
              <Eraser />
              {tConnector('clearSort')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DropdownMenu
        modal={false}
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (open) setFilterMode(null);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={returnFocus}
            type="button"
            className={`fouc-action ${styles.icon}`}
            data-variant="nested"
            aria-label={tConnector('columnMenuFor', { p0: String(name) })}
            data-active={settingsOpen || filtered || formatted || filterMode !== null || undefined}
            aria-expanded={settingsOpen || filterMode !== null}
            aria-haspopup={filterMode ? 'dialog' : 'menu'}
            aria-controls={filterMode ? id : undefined}
          >
            <CaretDown size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          density="compact"
          align="end"
          sideOffset={3}
          aria-label={tConnector('columnSettingsFor', { p0: String(name) })}
          className={styles.menu}
          onCloseAutoFocus={(event) => {
            if (filterMode) event.preventDefault();
          }}
        >
          <DropdownMenuItem onSelect={onFormat}>
            <Code />
            {tConnector('columnFormatting')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled || !queryActions}
            onSelect={() => setFilterMode('local')}
          >
            <Funnel />
            {tConnector('localValueFilter')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled || !queryActions}
            onSelect={() => setFilterMode('database')}
          >
            <Database />
            {tConnector('databaseValueFilter')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={disabled || (!formatted && !filtered)} onSelect={clear}>
            <Eraser />
            {tConnector('clear')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {filterMode && queryActions && (
        <ColumnValueFilter
          key={filterMode}
          id={id}
          name={name}
          mode={filterMode}
          anchor={anchor}
          returnFocus={returnFocus}
          options={queryActions.options(column)}
          selected={filterMode === 'local' ? queryActions.localSelected(column) : null}
          onClose={() => setFilterMode(null)}
          onApply={(selected) => {
            if (filterMode === 'local') queryActions.onLocalFilter(column, selected);
            else
              queryActions.onDatabaseFilter(
                name,
                selected === null
                  ? null
                  : queryActions
                      .options(column)
                      .filter((option) => selected.includes(option.key))
                      .map((option) => option.value),
              );
          }}
        />
      )}
    </div>
  );
}
