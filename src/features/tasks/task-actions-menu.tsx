'use client';

import { ArrowRight, DotsThree, PencilSimple, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSearch, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { TaskStatusIcon } from './task-status-icon';
import { messages } from './task-board.messages';
import { messages as progressMessages } from './task-progress.messages';
import styles from './task-actions-menu.module.css';

export function TaskActionsMenu({ task, board, disabled, className, onOpen, onRemove, onMove }: {
  task: BoardTask; board: TaskBoardDetail; disabled?: boolean; className: string;
  onOpen: () => void; onRemove: () => void; onMove: (columnId: string) => void;
}) {
  const { t } = useTranslation(messages);
  const { t: progressText } = useTranslation(progressMessages);
  const [query, setQuery] = useState('');
  const columns = board.columns.filter(column => column.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <span onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <DropdownMenu><DropdownMenuTrigger className={className} disabled={disabled} aria-label={t('taskMenu', { title: task.title })} draggable={false}><DotsThree size={19} weight="bold" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" density="compact">
        <DropdownMenuItem onSelect={onOpen}><PencilSimple />{t('editTask')}</DropdownMenuItem>
        <DropdownMenuSub onOpenChange={open => { if (open) setQuery(''); }}><DropdownMenuSubTrigger><ArrowRight />{t('moveTo')}</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" className={styles.columnMenu}>
          <DropdownMenuSearch value={query} onValueChange={setQuery} placeholder={progressText('searchStatuses')} clearLabel={progressText('clearSearch')} />
          <div className={styles.columnOptions}>{columns.length ? columns.map(column => <DropdownMenuItem key={column.id} disabled={column.id === task.columnId} onSelect={() => onMove(column.id)}><TaskStatusIcon column={column} />{column.name}</DropdownMenuItem>)
            : <p className={styles.menuEmpty} role="status">{progressText('noStatuses')}</p>}</div>
        </DropdownMenuSubContent></DropdownMenuSub>
        <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash />{t('removeTask')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>;
}
