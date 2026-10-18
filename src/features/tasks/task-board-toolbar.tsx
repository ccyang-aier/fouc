'use client';

import { ArrowClockwise, CalendarBlank, CaretDown, Check, FunnelSimple, Kanban, ListBullets, LockSimple, MagnifyingGlass, SortAscending, Users, X } from '@phosphor-icons/react';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { emptyTaskFilters, hasTaskFilters, type TaskFilters, type TaskSort } from './task-board-model';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const sortLabels = { manual: 'manual', priority: 'byPriority', due: 'byDue', updated: 'byUpdated', title: 'byTitle' } as const;
export function TaskBoardToolbar({ board, filters, onFilters, sort, onSort, onRefresh, refreshing }: {
  board: TaskBoardDetail; filters: TaskFilters; onFilters: (next: TaskFilters) => void; sort: TaskSort;
  onSort: (value: TaskSort) => void; onRefresh: () => void; refreshing: boolean;
}) {
  const { t } = useTranslation(messages);
  const completion = board.taskCount ? Math.round(board.completedCount / board.taskCount * 100) : 0;
  const labels = [...new Set(board.tasks.flatMap(task => task.labels))].sort();
  const filterCount = Number(filters.priority !== 'all') + Number(filters.due !== 'all') + Number(Boolean(filters.label));
  const activeFilters = [filters.query.trim() && `“${filters.query.trim()}”`, filters.assignee !== 'all' && (filters.assignee === 'me' ? t('myTasks') : filters.assignee === 'unassigned' ? t('unassigned') : board.members.find(member => member.userId === filters.assignee)?.name), filters.priority !== 'all' && t(filters.priority), filters.due !== 'all' && t(filters.due), filters.label].filter(Boolean);
  return <>
    <div className={styles.toolbar}>
      <div className={styles.summary}>
        <span>{t('summary', { total: board.taskCount })}</span><span className={styles.summaryDivider} />
        <span><Check size={12} />{t('completed', { count: board.completedCount })}</span>
        <span className={styles.summaryProgress} role="progressbar" aria-label={t('completion', { percent: completion })} aria-valuenow={board.completedCount} aria-valuemax={Math.max(1, board.taskCount)} aria-valuemin={0}><i style={{ width: `${completion}%` }} /></span>
        {board.permission === 'viewer' && <span className={styles.readOnly}><LockSimple size={11} />{t('readOnly')}</span>}
      </div>
      <div className={styles.toolbarRight}>
        <label className={styles.search}><MagnifyingGlass size={15} /><input value={filters.query} onChange={event => onFilters({ ...filters, query: event.target.value })} placeholder={t('searchTasks')} aria-label={t('searchTasks')} />{filters.query && <button type="button" className={`fouc-action ${styles.searchClear}`} aria-label={t('reset')} onClick={() => onFilters({ ...filters, query: '' })}><X size={12} /></button>}</label>
        <DropdownMenu><DropdownMenuTrigger className={styles.toolbarButton} aria-label={t('allMembers')} data-filter-active={filters.assignee !== 'all' || undefined}><Users size={15} weight="duotone" /><span className={styles.memberFilterLabel}>{filters.assignee === 'all' ? t('allMembers') : filters.assignee === 'me' ? t('myTasks') : filters.assignee === 'unassigned' ? t('unassigned') : board.members.find(member => member.userId === filters.assignee)?.name}</span><CaretDown size={10} /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.filterMenu}><DropdownMenuRadioGroup value={filters.assignee} onValueChange={assignee => onFilters({ ...filters, assignee })}>
            <DropdownMenuRadioItem value="all">{t('allMembers')}</DropdownMenuRadioItem><DropdownMenuRadioItem value="me">{t('myTasks')}</DropdownMenuRadioItem><DropdownMenuRadioItem value="unassigned">{t('unassigned')}</DropdownMenuRadioItem>
            <DropdownMenuSeparator />{board.members.map(member => <DropdownMenuRadioItem key={member.userId} value={member.userId}>{member.name}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup></DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger className={styles.toolbarButton} data-filter-active={filterCount > 0 || undefined}><FunnelSimple size={15} weight="duotone" /><span>{t('filter')}</span>{filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}</DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuSub><DropdownMenuSubTrigger>{t('priority')}</DropdownMenuSubTrigger><DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={filters.priority} onValueChange={priority => onFilters({ ...filters, priority: priority as TaskFilters['priority'] })}>{(['all', 'urgent', 'high', 'medium', 'low'] as const).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(value === 'all' ? 'allPriorities' : value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
          </DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSub><DropdownMenuSubTrigger>{t('dueDate')}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={filters.due} onValueChange={due => onFilters({ ...filters, due: due as TaskFilters['due'] })}>{(['all', 'overdue', 'week'] as const).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(value === 'all' ? 'allDates' : value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>
            {labels.length > 0 && <DropdownMenuSub><DropdownMenuSubTrigger>{t('label')}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={filters.label} onValueChange={label => onFilters({ ...filters, label })}><DropdownMenuRadioItem value="">{t('allLabels')}</DropdownMenuRadioItem>{labels.map(label => <DropdownMenuRadioItem key={label} value={label}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>}
            {hasTaskFilters(filters) && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onFilters(emptyTaskFilters)}><X />{t('reset')}</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger className={styles.toolbarButton} aria-label={t('sort')}><SortAscending size={15} /><span>{t(sort === 'manual' ? 'sort' : sortLabels[sort])}</span></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{t('sort')}</DropdownMenuLabel><DropdownMenuRadioGroup value={sort} onValueChange={value => onSort(value as TaskSort)}>{(Object.keys(sortLabels) as TaskSort[]).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(sortLabels[value])}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger className={styles.viewButton} aria-label={t('views')}><Kanban size={16} weight="duotone" /><span>{t('kanban')}</span><CaretDown size={11} /></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuItem><Kanban weight="duotone" />{t('kanban')}</DropdownMenuItem><DropdownMenuSeparator />
            <DropdownMenuItem disabled><CalendarBlank weight="duotone" />{t('timeline')}<span className={styles.planned}>{t('planned')}</span></DropdownMenuItem>
            <DropdownMenuItem disabled><ListBullets />{t('list')}<span className={styles.planned}>{t('planned')}</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" className={`fouc-action ${styles.iconButton}`} aria-label={t('refresh')} onClick={onRefresh} disabled={refreshing}><ArrowClockwise size={16} className={refreshing ? styles.refreshing : undefined} /></button>
      </div>
    </div>
    {hasTaskFilters(filters) && <div className={styles.filterStrip}><span>{activeFilters.join(' · ')}</span><button type="button" className="fouc-action" onClick={() => onFilters(emptyTaskFilters)}><X size={12} />{t('reset')}</button></div>}
  </>;
}
