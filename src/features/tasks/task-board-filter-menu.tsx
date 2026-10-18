'use client';

import { useState } from 'react';
import { Tag, Users } from '@phosphor-icons/react';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import { UserAvatar } from '@/components/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSearch, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardAssigneeFilter({ members, actorId, value, onChange }: {
  members: TaskBoardDetail['members']; actorId: string; value: string; onChange: (value: string) => void;
}) {
  const { t } = useTranslation(messages);
  const [query, setQuery] = useState('');
  const ordered = members.toSorted((a, b) => Number(b.userId === actorId) - Number(a.userId === actorId));
  const selectedId = value === 'me' ? actorId : value;
  const term = query.trim().toLocaleLowerCase();
  const matching = ordered.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase().includes(term));
  return <DropdownMenu onOpenChange={open => { if (open) setQuery(''); }}>
    <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} data-surface="muted" aria-label={t('allMembers')} data-filter-active={value !== 'all' || undefined}><Users size={16} />{value !== 'all' && <span className={styles.filterCount}>1</span>}</DropdownMenuTrigger></TooltipTrigger><TooltipContent>{members.find(member => member.userId === selectedId)?.name ?? t('allMembers')}</TooltipContent></Tooltip>
    <DropdownMenuContent align="end" density="compact" className={styles.selectionMenu}>
      <DropdownMenuSearch value={query} onValueChange={setQuery} placeholder={t('searchAssignees')} clearLabel={t('reset')} />
      <div className={styles.filterOptions}><DropdownMenuRadioGroup value={selectedId}>
        {matching.map(member => <DropdownMenuRadioItem indicator="none" key={member.userId} value={member.userId} onSelect={() => onChange(selectedId === member.userId ? 'all' : member.userId)} className={styles.filterOption}><UserAvatar className={styles.filterAvatar} name={member.name} image={member.image} /><span>{member.name}</span></DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>{!matching.length && <p className={styles.filterEmpty}>{t('noFilterResults')}</p>}</div>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function TaskBoardLabelFilter({ labels, value, onChange }: { labels: string[]; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation(messages);
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase();
  const matching = [{ value: '', label: t('allLabels') }, ...labels.map(label => ({ value: label, label }))].filter(option => option.label.toLocaleLowerCase().includes(term));
  return <DropdownMenuSub onOpenChange={open => { if (open) setQuery(''); }}>
    <DropdownMenuSubTrigger><Tag />{t('label')}</DropdownMenuSubTrigger>
    <DropdownMenuSubContent density="compact" className={styles.selectionMenu}>
      <DropdownMenuSearch value={query} onValueChange={setQuery} placeholder={t('searchLabels')} clearLabel={t('reset')} />
      <div className={styles.filterOptions}><DropdownMenuRadioGroup value={value} onValueChange={onChange}>
        {matching.map(option => <DropdownMenuRadioItem indicator="none" key={option.value} value={option.value}><Tag />{option.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>{!matching.length && <p className={styles.filterEmpty}>{t('noFilterResults')}</p>}</div>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
