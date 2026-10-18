'use client';

import { useRef, useState } from 'react';
import { ArrowsDownUp, CalendarBlank, CalendarDots, CalendarX, ClockCounterClockwise, DotsSixVertical, DotsThree, Flag, Funnel, Kanban, Lightning, ListBullets, LockSimple, MagnifyingGlass, PencilSimple, PlusCircle, ArrowClockwise, TextAa, Trash, Users, X } from '@phosphor-icons/react';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { emptyTaskFilters, hasTaskFilters, type TaskFilters, type TaskSort } from './task-board-model';
import { TaskBoardViewSwitcher } from './task-board-view-switcher';
import { TaskPriorityIcon } from './task-priority-icon';
import { TaskBoardAssigneeFilter, TaskBoardLabelFilter } from './task-board-filter-menu';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const sortLabels = { manual: 'manual', priority: 'byPriority', due: 'byDue', updated: 'byUpdated', title: 'byTitle' } as const;
const sortIcons = { manual: DotsSixVertical, priority: Flag, due: CalendarDots, updated: ClockCounterClockwise, title: TextAa };
const dueIcons = { all: CalendarBlank, overdue: CalendarX, week: CalendarDots };
export function TaskBoardToolbar({ board, actorId, filters, onFilters, sort, onSort, onRefresh, refreshing, busy, onCreate, onCreateColumn, onSettings, onRemoveBoard }: {
  board: TaskBoardDetail; actorId: string; filters: TaskFilters; onFilters: (next: TaskFilters) => void; sort: TaskSort;
  onSort: (value: TaskSort) => void; onRefresh: () => void; refreshing: boolean;
  busy: boolean; onCreate: () => void; onCreateColumn: () => void; onSettings: () => void; onRemoveBoard: () => void;
}) {
  const { t } = useTranslation(messages);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchOpen = searchExpanded || Boolean(filters.query);
  function closeSearch() { onFilters({ ...filters, query: '' }); setSearchExpanded(false); searchTrigger.current?.focus(); }
  const labels = [...new Set(board.tasks.flatMap(task => task.labels))].sort();
  const filterCount = Number(filters.priority !== 'all') + Number(filters.due !== 'all') + Number(Boolean(filters.label));
  const activeFilters = [filters.query.trim() && `“${filters.query.trim()}”`, filters.assignee !== 'all' && (filters.assignee === 'me' ? t('myTasks') : filters.assignee === 'unassigned' ? t('unassigned') : board.members.find(member => member.userId === filters.assignee)?.name), filters.priority !== 'all' && t(filters.priority), filters.due !== 'all' && t(filters.due), filters.label].filter(Boolean);
  return <>
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <TaskBoardViewSwitcher />
        {board.permission !== 'viewer' && <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.createButton}`} data-surface="plain" onClick={onCreate} disabled={busy} aria-label={t('newTask')}><PlusCircle size={20} /></button></TooltipTrigger><TooltipContent>{t('newTask')}</TooltipContent></Tooltip>}
        {board.permission === 'viewer' && <span className={styles.readOnly}><LockSimple size={11} />{t('readOnly')}</span>}
      </div>
      <div className={styles.toolbarRight}>
        <div className={styles.toolbarControls}>
        <TaskBoardAssigneeFilter members={board.members} actorId={actorId} value={filters.assignee} onChange={assignee => onFilters({ ...filters, assignee })} />
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} data-surface="muted" aria-label={t('filter')} data-filter-active={filterCount > 0 || undefined}><Funnel size={16} />{filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}</DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t('filter')}</TooltipContent></Tooltip>
          <DropdownMenuContent align="end" density="compact"><DropdownMenuSub><DropdownMenuSubTrigger><Flag />{t('priority')}</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact">
            <DropdownMenuRadioGroup value={filters.priority} onValueChange={priority => onFilters({ ...filters, priority: priority as TaskFilters['priority'] })}>{(['all', 'urgent', 'high', 'medium', 'low'] as const).map(value => <DropdownMenuRadioItem indicator="none" key={value} value={value}>{value === 'all' ? <ListBullets /> : <TaskPriorityIcon priority={value} />}{t(value === 'all' ? 'allPriorities' : value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
          </DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSub><DropdownMenuSubTrigger><CalendarDots />{t('dueDate')}</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact"><DropdownMenuRadioGroup value={filters.due} onValueChange={due => onFilters({ ...filters, due: due as TaskFilters['due'] })}>{(['all', 'overdue', 'week'] as const).map(value => { const Icon = dueIcons[value]; return <DropdownMenuRadioItem indicator="none" key={value} value={value}><Icon />{t(value === 'all' ? 'allDates' : value)}</DropdownMenuRadioItem>; })}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>
            {labels.length > 0 && <TaskBoardLabelFilter labels={labels} value={filters.label} onChange={label => onFilters({ ...filters, label })} />}
            {hasTaskFilters(filters) && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onFilters(emptyTaskFilters)}><X />{t('reset')}</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} data-surface="muted" aria-label={t('sort')} data-filter-active={sort !== 'manual' || undefined}><ArrowsDownUp size={16} /></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t(sort === 'manual' ? 'sort' : sortLabels[sort])}</TooltipContent></Tooltip><DropdownMenuContent align="end" density="compact"><DropdownMenuRadioGroup value={sort} onValueChange={value => onSort(value as TaskSort)}>{(Object.keys(sortLabels) as TaskSort[]).map(value => { const Icon = sortIcons[value]; return <DropdownMenuRadioItem indicator="none" key={value} value={value}><Icon />{t(sortLabels[value])}</DropdownMenuRadioItem>; })}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} data-surface="muted" aria-label={t('quickFilters')}><Lightning size={16} /></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t('quickFilters')}</TooltipContent></Tooltip><DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem onSelect={() => onFilters({ ...filters, assignee: 'me' })}><Users />{t('myTasks')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onFilters({ ...filters, due: 'overdue' })}><CalendarX />{t('overdue')}</DropdownMenuItem>
          {hasTaskFilters(filters) && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onFilters(emptyTaskFilters)}><X />{t('reset')}</DropdownMenuItem></>}
        </DropdownMenuContent></DropdownMenu>
        <div className={styles.searchControl} data-expanded={searchOpen || undefined}>
          <Tooltip><TooltipTrigger asChild><button ref={searchTrigger} type="button" className={`fouc-action ${styles.toolbarIcon}`} data-surface="muted" aria-label={t('searchTasks')} aria-expanded={searchOpen} onClick={() => { setSearchExpanded(true); searchInput.current?.focus(); }}><MagnifyingGlass size={16} /></button></TooltipTrigger><TooltipContent>{t('searchTasks')}</TooltipContent></Tooltip>
          {searchOpen && <label className={styles.search}><input ref={searchInput} autoFocus value={filters.query} onChange={event => onFilters({ ...filters, query: event.target.value })} onKeyDown={event => { if (event.key === 'Escape') closeSearch(); }} placeholder={t('searchTasks')} aria-label={t('searchTasks')} /><button type="button" className={`fouc-action ${styles.searchClear}`} aria-label={t('closeSearch')} onClick={closeSearch}><X size={12} /></button></label>}
        </div>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} data-surface="muted" aria-label={t('boardActions')}><DotsThree size={16} weight="bold" /></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t('boardActions')}</TooltipContent></Tooltip><DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem disabled={refreshing} onSelect={onRefresh}><ArrowClockwise className={refreshing ? styles.refreshing : undefined} />{t('refresh')}</DropdownMenuItem>
          {board.permission !== 'viewer' && <DropdownMenuItem onSelect={onCreateColumn} disabled={board.columns.length >= 24}><Kanban />{t('addColumn')}</DropdownMenuItem>}
          {board.permission === 'owner' && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={onSettings}><PencilSimple />{t('settings')}</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={onRemoveBoard}><Trash />{t('removeBoard')}</DropdownMenuItem></>}
        </DropdownMenuContent></DropdownMenu>
        </div>
      </div>
    </div>
    {hasTaskFilters(filters) && <div className={styles.filterStrip}><span>{activeFilters.join(' · ')}</span><button type="button" className="fouc-action" onClick={() => onFilters(emptyTaskFilters)}><X size={12} />{t('reset')}</button></div>}
  </>;
}
