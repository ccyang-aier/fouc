'use client';

import { useRef, useState } from 'react';
import { ArrowDownUp, ChartGantt, Check, ChevronDown, Clock3, Columns2, Ellipsis, Funnel, LockKeyhole, Pencil, Plus, RotateCw, Search, Table2, Trash2, Users, X, Zap } from 'lucide-react';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { emptyTaskFilters, hasTaskFilters, type TaskFilters, type TaskSort } from './task-board-model';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

const sortLabels = { manual: 'manual', priority: 'byPriority', due: 'byDue', updated: 'byUpdated', title: 'byTitle' } as const;
export function TaskBoardToolbar({ board, filters, onFilters, sort, onSort, onRefresh, refreshing, busy, onCreate, onCreateColumn, onSettings, onRemoveBoard }: {
  board: TaskBoardDetail; filters: TaskFilters; onFilters: (next: TaskFilters) => void; sort: TaskSort;
  onSort: (value: TaskSort) => void; onRefresh: () => void; refreshing: boolean;
  busy: boolean; onCreate: () => void; onCreateColumn: () => void; onSettings: () => void; onRemoveBoard: () => void;
}) {
  const { t } = useTranslation(messages);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchOpen = searchExpanded || Boolean(filters.query);
  function closeSearch() { onFilters({ ...filters, query: '' }); setSearchExpanded(false); searchTrigger.current?.focus(); }
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
        {board.permission === 'viewer' && <span className={styles.readOnly}><LockKeyhole size={11} />{t('readOnly')}</span>}
      </div>
      <div className={styles.toolbarRight}>
        <DropdownMenu><DropdownMenuTrigger className={styles.toolbarButton} aria-label={t('allMembers')} data-filter-active={filters.assignee !== 'all' || undefined}><Users size={15} /><span className={styles.memberFilterLabel}>{filters.assignee === 'all' ? t('allMembers') : filters.assignee === 'me' ? t('myTasks') : filters.assignee === 'unassigned' ? t('unassigned') : board.members.find(member => member.userId === filters.assignee)?.name}</span><ChevronDown size={10} /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.filterMenu}><DropdownMenuRadioGroup value={filters.assignee} onValueChange={assignee => onFilters({ ...filters, assignee })}>
            <DropdownMenuRadioItem value="all">{t('allMembers')}</DropdownMenuRadioItem><DropdownMenuRadioItem value="me">{t('myTasks')}</DropdownMenuRadioItem><DropdownMenuRadioItem value="unassigned">{t('unassigned')}</DropdownMenuRadioItem>
            <DropdownMenuSeparator />{board.members.map(member => <DropdownMenuRadioItem key={member.userId} value={member.userId}>{member.name}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup></DropdownMenuContent>
        </DropdownMenu>
        <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
          {([{ key: 'list', icon: Table2 }, { key: 'timeline', icon: ChartGantt }, { key: 'kanban', icon: Columns2 }] as const).map(({ key, icon: Icon }) => key === 'kanban'
            ? <button key={key} type="button" className={`fouc-action ${styles.viewSegment}`} aria-pressed="true"><span>{t(key)}</span><Icon size={16} /></button>
            : <Tooltip key={key}><TooltipTrigger asChild><span className={styles.plannedView}><button type="button" className={styles.viewSegment} disabled aria-label={`${t(key)} · ${t('planned')}`}><span>{t(key)}</span><Icon size={16} /></button></span></TooltipTrigger><TooltipContent>{t('planned')}</TooltipContent></Tooltip>)}
        </div>
        <div className={styles.toolbarControls}>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} aria-label={t('filter')} data-filter-active={filterCount > 0 || undefined}><Funnel size={18} />{filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}</DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t('filter')}</TooltipContent></Tooltip>
          <DropdownMenuContent align="end"><DropdownMenuSub><DropdownMenuSubTrigger>{t('priority')}</DropdownMenuSubTrigger><DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={filters.priority} onValueChange={priority => onFilters({ ...filters, priority: priority as TaskFilters['priority'] })}>{(['all', 'urgent', 'high', 'medium', 'low'] as const).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(value === 'all' ? 'allPriorities' : value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
          </DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSub><DropdownMenuSubTrigger>{t('dueDate')}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={filters.due} onValueChange={due => onFilters({ ...filters, due: due as TaskFilters['due'] })}>{(['all', 'overdue', 'week'] as const).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(value === 'all' ? 'allDates' : value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>
            {labels.length > 0 && <DropdownMenuSub><DropdownMenuSubTrigger>{t('label')}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuRadioGroup value={filters.label} onValueChange={label => onFilters({ ...filters, label })}><DropdownMenuRadioItem value="">{t('allLabels')}</DropdownMenuRadioItem>{labels.map(label => <DropdownMenuRadioItem key={label} value={label}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>}
            {hasTaskFilters(filters) && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onFilters(emptyTaskFilters)}><X />{t('reset')}</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} aria-label={t('sort')} data-filter-active={sort !== 'manual' || undefined}><ArrowDownUp size={18} /></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t(sort === 'manual' ? 'sort' : sortLabels[sort])}</TooltipContent></Tooltip><DropdownMenuContent align="end"><DropdownMenuLabel>{t('sort')}</DropdownMenuLabel><DropdownMenuRadioGroup value={sort} onValueChange={value => onSort(value as TaskSort)}>{(Object.keys(sortLabels) as TaskSort[]).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(sortLabels[value])}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} aria-label={t('quickFilters')}><Zap size={18} /></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t('quickFilters')}</TooltipContent></Tooltip><DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onFilters({ ...filters, assignee: 'me' })}><Users />{t('myTasks')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onFilters({ ...filters, due: 'overdue' })}><Clock3 />{t('overdue')}</DropdownMenuItem>
          {hasTaskFilters(filters) && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onFilters(emptyTaskFilters)}><X />{t('reset')}</DropdownMenuItem></>}
        </DropdownMenuContent></DropdownMenu>
        <div className={styles.searchControl} data-expanded={searchOpen || undefined}>
          <Tooltip><TooltipTrigger asChild><button ref={searchTrigger} type="button" className={`fouc-action ${styles.toolbarIcon}`} aria-label={t('searchTasks')} aria-expanded={searchOpen} onClick={() => { setSearchExpanded(true); searchInput.current?.focus(); }}><Search size={18} /></button></TooltipTrigger><TooltipContent>{t('searchTasks')}</TooltipContent></Tooltip>
          {searchOpen && <label className={styles.search}><input ref={searchInput} autoFocus value={filters.query} onChange={event => onFilters({ ...filters, query: event.target.value })} onKeyDown={event => { if (event.key === 'Escape') closeSearch(); }} placeholder={t('searchTasks')} aria-label={t('searchTasks')} /><button type="button" className={`fouc-action ${styles.searchClear}`} aria-label={t('closeSearch')} onClick={closeSearch}><X size={12} /></button></label>}
        </div>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} aria-label={t('boardActions')}><Ellipsis size={18} /></DropdownMenuTrigger></TooltipTrigger><TooltipContent>{t('boardActions')}</TooltipContent></Tooltip><DropdownMenuContent align="end">
          <DropdownMenuItem disabled={refreshing} onSelect={onRefresh}><RotateCw className={refreshing ? styles.refreshing : undefined} />{t('refresh')}</DropdownMenuItem>
          {board.permission === 'owner' && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={onSettings}><Pencil />{t('settings')}</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={onRemoveBoard}><Trash2 />{t('removeBoard')}</DropdownMenuItem></>}
        </DropdownMenuContent></DropdownMenu>
        {board.permission !== 'viewer' && <div className={styles.createGroup}>
          <Button size="sm" className={styles.createButton} onClick={onCreate} disabled={busy} aria-label={t('newTask')}>{t('create')}</Button>
          <DropdownMenu><DropdownMenuTrigger className={styles.createMenu} aria-label={t('createOptions')} disabled={busy}><ChevronDown size={12} /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onCreate}><Plus />{t('newTask')}</DropdownMenuItem><DropdownMenuItem onSelect={onCreateColumn} disabled={board.columns.length >= 24}><Columns2 />{t('addColumn')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>}
        </div>
      </div>
    </div>
    {hasTaskFilters(filters) && <div className={styles.filterStrip}><span>{activeFilters.join(' · ')}</span><button type="button" className="fouc-action" onClick={() => onFilters(emptyTaskFilters)}><X size={12} />{t('reset')}</button></div>}
  </>;
}
