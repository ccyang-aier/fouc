'use client';

import { CalendarBlank, ChatCircle, CheckSquare, DotsThree, Flag, DotsSixVertical, LinkSimple, PencilSimple, Trash, ArrowRight } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';
import { UserAvatar } from '@/components/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import resourceStyles from '@/components/ui/resource-card.module.css';
import { isTaskOverdue, taskReference } from './task-board-model';
import { TaskStatusIcon } from './task-status-icon';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskCard({ task, board, editable, draggable, dragging, insertBefore, onOpen, onRemove, onMove, onDragStart, onDragEnd }: {
  task: BoardTask; board: TaskBoardDetail; editable: boolean; draggable: boolean; dragging: boolean; insertBefore: boolean;
  onOpen: () => void; onRemove: () => void; onMove: (columnId: string) => void;
  onDragStart: (event: React.DragEvent) => void; onDragEnd: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const checked = task.checklist.filter(item => item.done).length;
  const progress = task.checklist.length ? Math.round(checked / task.checklist.length * 100) : 0;
  const overdue = isTaskOverdue(task, board);
  const column = board.columns.find(column => column.id === task.columnId);
  const done = column?.isDone;
  const assigned = board.members.filter(member => task.assigneeIds.includes(member.userId));
  return <article className={`${resourceStyles.card} ${styles.card}`} role="button" tabIndex={0}
    aria-label={t('openTask', { title: task.title })} data-task-id={task.id} data-dragging={dragging || undefined} data-insert-before={insertBefore || undefined}
    draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
    onClick={onOpen} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(); } }}>
    <div className={styles.cardTop}>
      <span className={styles.taskReference}><LinkSimple size={14} /><span>{taskReference(task)}</span>{column && <span title={column.name}><TaskStatusIcon column={column} /></span>}</span>
      {editable && <span onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <DropdownMenu><DropdownMenuTrigger className={styles.cardMenu} aria-label={t('taskMenu', { title: task.title })} draggable={false}><DotsThree size={19} weight="bold" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem onSelect={onOpen}><PencilSimple weight="duotone" />{t('editTask')}</DropdownMenuItem>
          <DropdownMenuSub><DropdownMenuSubTrigger><ArrowRight />{t('moveTo')}</DropdownMenuSubTrigger><DropdownMenuSubContent>
            <DropdownMenuLabel>{t('statuses')}</DropdownMenuLabel>{board.columns.map(column => <DropdownMenuItem key={column.id} disabled={column.id === task.columnId} onSelect={() => onMove(column.id)}><span className={styles.statusDot} data-color={column.color} />{column.name}</DropdownMenuItem>)}
          </DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash weight="duotone" />{t('removeTask')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>}</div>
    <div className={styles.cardHeading}><h3 data-completed={done || undefined}>{task.title}</h3></div>
    {task.description && <p className={styles.cardDescription}>{task.description}</p>}
    <div className={styles.cardTags}>
      <div className={styles.labels}>{task.labels.slice(0, 3).map(label => <span key={label} className={styles.label}>{label}</span>)}</div>
      <span className={styles.priority} data-priority={task.priority}><Flag size={12} weight={task.priority === 'urgent' || task.priority === 'high' ? 'fill' : 'duotone'} />{t(task.priority)}</span>
    </div>
    {task.checklist.length > 0 && <div className={styles.checklistProgress} aria-label={`${t('progress')} ${checked}/${task.checklist.length}`}>
      <div><span><CheckSquare size={14} weight="duotone" />{t('progress')}</span><span>{checked}<span className={styles.faint}> / {task.checklist.length}</span></span></div>
      <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} data-done={progress === 100 || undefined} /></div>
    </div>}
    <div className={styles.cardFooter}>
      <div className={styles.cardMetadata}>{task.dueDate && <span className={styles.date} data-overdue={overdue || undefined} title={`${task.dueDate}${overdue ? ` · ${t('overdueDays')}` : ''}`}><CalendarBlank size={14} weight="duotone" />{new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${task.dueDate}T12:00:00`))}</span>}
        {task.commentCount > 0 && <span aria-label={t('comments', { count: task.commentCount })}><ChatCircle size={14} weight="duotone" />{task.commentCount}</span>}
      </div>
      <div className={styles.avatars} aria-label={assigned.map(member => member.name).join(', ') || t('unassigned')}>
        {assigned.slice(0, 3).map(member => <span key={member.userId} title={member.name}><UserAvatar name={member.name} image={member.image} /></span>)}
        {assigned.length > 3 && <span className={styles.extraAvatar}>+{assigned.length - 3}</span>}
        {draggable && !assigned.length && <DotsSixVertical className={styles.dragGrip} size={16} aria-label={t('dragTask')} />}
      </div>
    </div>
  </article>;
}
