'use client';

import { CalendarDots, ChatText, DotsThree, LinkSimple, Paperclip, PencilSimple, Trash, ArrowRight } from '@phosphor-icons/react';
import { useState } from 'react';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';
import { AvatarGroup } from '@/components/avatar-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSearch, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import resourceStyles from '@/components/ui/resource-card.module.css';
import { isTaskOverdue, taskReference } from './task-board-model';
import { TaskStatusIcon } from './task-status-icon';
import { TaskPriorityIcon } from './task-priority-icon';
import { TaskProgress } from './task-progress';
import { taskProgress } from './task-progress-model';
import { messages as progressMessages } from './task-progress.messages';
import { messages } from './task-board.messages';
import styles from './task-card.module.css';

export function TaskCard({ task, board, editable, draggable, dragging, insertBefore, onOpen, onRemove, onMove, onDragStart, onDragEnd }: {
  task: BoardTask; board: TaskBoardDetail; editable: boolean; draggable: boolean; dragging: boolean; insertBefore: boolean;
  onOpen: () => void; onRemove: () => void; onMove: (columnId: string) => void;
  onDragStart: (event: React.DragEvent) => void; onDragEnd: () => void;
}) {
  const { t } = useTranslation(messages);
  const { t: progressText } = useTranslation(progressMessages);
  const [columnQuery, setColumnQuery] = useState('');
  const matchingColumns = board.columns.filter(column => column.name.toLocaleLowerCase().includes(columnQuery.trim().toLocaleLowerCase()));
  const overdue = isTaskOverdue(task, board);
  const column = board.columns.find(column => column.id === task.columnId);
  const done = column?.isDone;
  const progress = taskProgress(task, Boolean(done));
  const assigned = board.members.filter(member => task.assigneeIds.includes(member.userId));
  return <article className={`${resourceStyles.card} ${styles.card}`} role="button" tabIndex={0}
    aria-label={t('openTask', { title: task.title })} data-task-id={task.id} data-dragging={dragging || undefined} data-insert-before={insertBefore || undefined}
    draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
    onClick={onOpen} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(); } }}>
    <div className={styles.cardTop}>
      <span className={styles.taskReference}><LinkSimple size={14} /><span>{taskReference(task)}</span><TaskProgress progress={progress} /></span>
      {editable && <span onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <DropdownMenu><DropdownMenuTrigger className={styles.cardMenu} aria-label={t('taskMenu', { title: task.title })} draggable={false}><DotsThree size={19} weight="bold" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem onSelect={onOpen}><PencilSimple />{t('editTask')}</DropdownMenuItem>
          <DropdownMenuSub onOpenChange={open => { if (open) setColumnQuery(''); }}><DropdownMenuSubTrigger><ArrowRight />{t('moveTo')}</DropdownMenuSubTrigger><DropdownMenuSubContent density="compact" className={styles.columnMenu}>
            <DropdownMenuSearch value={columnQuery} onValueChange={setColumnQuery} placeholder={progressText('searchStatuses')} clearLabel={progressText('clearSearch')} />
            <div className={styles.columnOptions}>{matchingColumns.length ? matchingColumns.map(column => <DropdownMenuItem key={column.id} disabled={column.id === task.columnId} onSelect={() => onMove(column.id)}><TaskStatusIcon column={column} />{column.name}</DropdownMenuItem>)
              : <p className={styles.menuEmpty} role="status">{progressText('noStatuses')}</p>}</div>
          </DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash />{t('removeTask')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>}</div>
    <div className={styles.cardHeading}><h3 data-completed={done || undefined}>{task.title}</h3></div>
    {task.description && <p className={styles.cardDescription}>{task.description}</p>}
    <div className={styles.cardTags}>
      <div className={styles.labels}>{task.labels.slice(0, 3).map(label => <span key={label} className={styles.label}>{label}</span>)}</div>
      <span className={styles.priority} data-priority={task.priority}><TaskPriorityIcon priority={task.priority} size={12} />{t(task.priority)}</span>
    </div>
    <div className={styles.cardFooter}>
      <div className={styles.assigneesRow}>
        <span className={styles.assignedLabel}>{progressText('assignedFor')}</span>
        {assigned.length > 0 ? <AvatarGroup members={assigned.map(({ userId, name, image }) => ({ id: userId, name, image }))} maxVisible={3} size={24} />
          : <span className={styles.unassigned}>{t('unassigned')}</span>}
      </div>
      <div className={styles.metadataRow}>
        <span className={styles.date} data-overdue={overdue || undefined} data-empty={!task.dueDate || undefined}>
          <CalendarDots size={18} />{task.dueDate ? <time dateTime={task.dueDate}>{task.dueDate.split('-').reverse().join('/')}</time> : progressText('noDueDate')}
        </span>
        <div className={styles.metrics}>
          {/* Tasks do not yet accept attachments, so their current count is zero. */}
          <span aria-label={t('attachments', { count: 0 })}><Paperclip size={18} />0</span>
          <span aria-label={t('comments', { count: task.commentCount })}><ChatText size={18} />{task.commentCount}</span>
        </div>
      </div>
    </div>
  </article>;
}
