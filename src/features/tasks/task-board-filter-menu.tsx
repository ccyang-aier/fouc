'use client';

import { useState } from 'react';
import { Tag, UserRound, UserRoundMinus, Users } from 'lucide-react';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import { UserAvatar } from '@/components/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSearch, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardAssigneeFilter({ members, value, onChange }: {
  members: TaskBoardDetail['members']; value: string; onChange: (value: string) => void;
}) {
  const { t } = useTranslation(messages);
  const [query, setQuery] = useState('');
  const options: { value: string; label: string; icon: typeof Users; member?: TaskBoardDetail['members'][number] }[] = [
    { value: 'all', label: t('allMembers'), icon: Users },
    { value: 'me', label: t('myTasks'), icon: UserRound },
    { value: 'unassigned', label: t('unassigned'), icon: UserRoundMinus },
    ...members.map(member => ({ value: member.userId, label: member.name, member, icon: UserRound })),
  ];
  const term = query.trim().toLocaleLowerCase();
  const matching = options.filter(option => `${option.label} ${option.member?.email ?? ''}`.toLocaleLowerCase().includes(term));
  return <DropdownMenu onOpenChange={open => { if (open) setQuery(''); }}>
    <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger className={styles.toolbarIcon} data-surface="plain" aria-label={t('allMembers')} data-filter-active={value !== 'all' || undefined}><Users size={16} />{value !== 'all' && <span className={styles.filterCount}>1</span>}</DropdownMenuTrigger></TooltipTrigger><TooltipContent>{options.find(option => option.value === value)?.label}</TooltipContent></Tooltip>
    <DropdownMenuContent align="end" density="compact" className={styles.selectionMenu}>
      <DropdownMenuSearch value={query} onValueChange={setQuery} placeholder={t('searchAssignees')} clearLabel={t('reset')} />
      <div className={styles.filterOptions}><DropdownMenuRadioGroup value={value} onValueChange={onChange}>
        {matching.map(option => <DropdownMenuRadioItem key={option.value} value={option.value} className={styles.filterOption}>{option.member ? <UserAvatar className={styles.filterAvatar} name={option.member.name} image={option.member.image} /> : <option.icon size={16} />}<span>{option.label}</span></DropdownMenuRadioItem>)}
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
        {matching.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>{!matching.length && <p className={styles.filterEmpty}>{t('noFilterResults')}</p>}</div>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
