'use client';

import type { BoardTask, TaskBoardDetail, TaskColumn } from '@fouc/shared/tasks';
import { AvatarGroup } from '@/components/avatar-group';
import { useTranslation } from '@/lib/i18n';
import { TaskActionsMenu } from '../task-actions-menu';
import { taskReference } from '../task-board-model';
import { TaskLabelBadge } from '../task-labels';
import { TaskPriorityIcon } from '../task-priority-icon';
import { TaskStatusIcon } from '../task-status-icon';
import { messages as boardMessages } from '../task-board.messages';
import { TaskSelectionBox, TaskTableStatusMenu } from './task-table-controls';
import { messages } from './task-table.messages';
import styles from './task-table.module.css';

export function TaskTableRow({ task, column, board, busy, selected, onSelect, onOpen, onMove, onRemove }: {
  task: BoardTask; column: TaskColumn; board: TaskBoardDetail; busy: boolean; selected: boolean;
  onSelect: (checked: boolean) => void; onOpen: () => void; onMove: (columnId: string) => void; onRemove: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const { t: boardText } = useTranslation(boardMessages);
  const editable = board.permission !== 'viewer';
  const assigned = board.members.filter(member => task.assigneeIds.includes(member.userId));
  const status = <span className={styles.status} data-color={column.isDone ? 'green' : column.color}><TaskStatusIcon column={column} /><span>{column.name}</span></span>;
  return <tr className={styles.row} data-selected={selected || undefined} data-task-row={task.id}>
    <td className={styles.selectionCell}>{editable && <TaskSelectionBox checked={selected} disabled={busy} label={t('selectTask', { title: task.title })} onChange={onSelect} />}</td>
    <th scope="row" className={styles.taskCell}>
      <button type="button" className={`fouc-action ${styles.taskTitle}`} data-surface="plain" data-task-link={task.id} onClick={onOpen} aria-label={boardText('openTask', { title: task.title })} title={task.title}>
        <span className={styles.reference}>{taskReference(task)}</span><span>{task.title}</span>
      </button>
    </th>
    <td><span className={styles.truncate} title={task.description || t('noDescription')} data-empty={!task.description || undefined}>{task.description || '—'}</span></td>
    <td>{assigned.length ? <AvatarGroup members={assigned.map(({ userId, name, image }) => ({ id: userId, name, image }))} maxVisible={3} size={24} /> : <span className={styles.placeholder}>{boardText('unassigned')}</span>}</td>
    <td className={styles.date}>{task.schedule ? <time dateTime={task.schedule.startsAt} title={new Date(task.schedule.startsAt).toLocaleString(locale)}>{new Date(task.schedule.startsAt).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })}</time> : <span className={styles.placeholder}>{t('notScheduled')}</span>}</td>
    <td><span className={styles.priority} data-priority={task.priority}><TaskPriorityIcon priority={task.priority} size={12} />{boardText(task.priority)}</span></td>
    <td>{editable ? <TaskTableStatusMenu columns={board.columns} currentIds={[task.columnId]} disabled={busy} label={t('changeStatus', { title: task.title })} onChange={onMove}>{status}</TaskTableStatusMenu> : status}</td>
    <td><div className={styles.labels}>{task.labels.length ? <>{task.labels.slice(0, 2).map(label => <TaskLabelBadge key={label.name} label={label} className={styles.label} />)}{task.labels.length > 2 && <span className={styles.labelOverflow} title={task.labels.slice(2).map(label => label.name).join(' · ')}>+{task.labels.length - 2}</span>}</> : <span className={styles.placeholder} aria-label={t('noLabels')}>—</span>}</div></td>
    <td className={styles.actionsCell}>{editable && <TaskActionsMenu task={task} board={board} disabled={busy} className={styles.rowMenu} onOpen={onOpen} onMove={onMove} onRemove={onRemove} />}</td>
  </tr>;
}
