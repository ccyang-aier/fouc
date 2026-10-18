'use client';

import { useState } from 'react';
import { CaretDown, Check, Kanban, LockSimple, MagnifyingGlass, Plus, Users, X } from '@phosphor-icons/react';
import type { TaskBoardSummary } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardPicker({ boards, selected, onSelect, onCreate }: { boards: TaskBoardSummary[]; selected?: TaskBoardSummary; onSelect: (id: string) => void; onCreate: () => void }) {
  const { t } = useTranslation(messages);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = boards.filter(board => board.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <DropdownMenu open={open} onOpenChange={value => { setOpen(value); if (value) setQuery(''); }}>
    <DropdownMenuTrigger className={styles.boardPicker} aria-label={t('switchBoard')}><h1>{selected?.name ?? t('boards')}</h1><CaretDown size={14} /></DropdownMenuTrigger>
    <DropdownMenuContent className={styles.boardMenu} align="start" sideOffset={8}>
      <div className={styles.boardSearch}><MagnifyingGlass size={15} /><input autoFocus placeholder={t('searchBoards')} aria-label={t('searchBoards')} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
        event.stopPropagation();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const items = event.currentTarget.closest('[role="menu"]')?.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]'); items?.[event.key === 'ArrowDown' ? 0 : items.length - 1]?.focus(); }
      }} />{query && <button type="button" className="fouc-action" aria-label={t('reset')} onClick={() => setQuery('')}><X size={12} /></button>}</div>
      <div className={styles.boardOptions}>{filtered.map(board => <DropdownMenuItem className={styles.boardOption} key={board.id} role="menuitemradio" aria-checked={board.id === selected?.id} textValue={board.name} onSelect={() => onSelect(board.id)}>
        <span className={styles.boardOptionIcon}><Kanban size={19} /></span><span><strong>{board.name}</strong><small>{board.visibility === 'private' ? <LockSimple size={11} /> : <Users size={11} />}{t(board.visibility)}<span>·</span>{t('summary', { total: board.taskCount })}</small></span>{board.id === selected?.id && <Check size={15} />}
      </DropdownMenuItem>)}{!filtered.length && <p className={styles.menuEmpty}>{t('noBoardResults')}</p>}</div>
      <DropdownMenuSeparator /><DropdownMenuItem onSelect={onCreate}><Plus size={16} />{t('createBoard')}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
