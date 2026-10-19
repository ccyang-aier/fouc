'use client';

import { useId, useRef, useState } from 'react';
import { ArrowRight, CaretUp, Plus, X } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';
import { usePageScrollKey, usePageSessionState } from '@/lib/page-session-state';
import { useTranslation } from '@/lib/i18n';
import { TaskStatusIcon } from '../task-status-icon';
import { messages as boardMessages } from '../task-board.messages';
import { TaskSelectionBox, TaskTableStatusMenu } from './task-table-controls';
import { TaskTableRow } from './task-table-row';
import { messages } from './task-table.messages';
import styles from './task-table.module.css';

export type TaskTableProps = {
  board: TaskBoardDetail; tasks: BoardTask[]; busy: boolean;
  onOpen: (task: BoardTask) => void; onCreate: (columnId: string) => void; onRemove: (task: BoardTask) => void;
  onMoveTasks: (taskIds: string[], columnId: string) => Promise<boolean>;
};

export function TaskTable({ board, tasks, busy, onOpen, onCreate, onRemove, onMoveTasks }: TaskTableProps) {
  const { t } = useTranslation(messages);
  const { t: boardText } = useTranslation(boardMessages);
  const id = useId();
  const surface = useRef<HTMLDivElement>(null);
  const scrollKey = usePageScrollKey(`tasks:${board.id}:table`);
  const [collapsed, setCollapsed] = usePageSessionState<Record<string, boolean>>(`tasks:${board.id}:table:collapsed`, {});
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const editable = board.permission !== 'viewer';
  // Hidden and revoked tasks never become mutation targets, even during polling.
  const selected = editable ? tasks.filter(task => selection.has(task.id)) : [];
  const selectedIds = new Set(selected.map(task => task.id));
  function select(ids: string[], checked: boolean) {
    setSelection(() => {
      const next = new Set(selectedIds);
      ids.forEach(taskId => { if (checked) next.add(taskId); else next.delete(taskId); });
      return next;
    });
  }
  async function move(taskIds: string[], columnId: string) {
    if (busy || !editable) return;
    if (await onMoveTasks(taskIds, columnId)) {
      setSelection(new Set());
      setCollapsed(value => ({ ...value, [columnId]: false }));
      requestAnimationFrame(() => surface.current?.querySelector<HTMLButtonElement>(`[data-task-link="${taskIds[0]}"]`)?.focus({ preventScroll: true }));
    }
  }
  return <div ref={surface} className={styles.canvas} aria-label={t('table')} data-page-scroll={scrollKey}>
    {selected.length > 0 && <div className={styles.selectionBar} role="group" aria-label={t('selected', { count: selected.length })}>
      <span role="status">{t('selected', { count: selected.length })}</span>
      <TaskTableStatusMenu columns={board.columns} currentIds={selected.map(task => task.columnId)} disabled={busy} label={t('moveSelected')} className={styles.bulkMove} onChange={columnId => { void move(selected.map(task => task.id), columnId); }}><ArrowRight size={14} />{boardText('moveTo')}</TaskTableStatusMenu>
      <button type="button" className={`fouc-action ${styles.clearSelection}`} data-surface="plain" disabled={busy} aria-label={t('clearSelection')} onClick={() => setSelection(new Set())}><X size={15} /></button>
    </div>}
    <div className={styles.groups}>
      {board.columns.map(column => {
        const items = tasks.filter(task => task.columnId === column.id);
        const total = board.tasks.filter(task => task.columnId === column.id).length;
        const selectedCount = items.filter(task => selectedIds.has(task.id)).length;
        const contentId = `${id}-${column.id}`;
        return <section key={column.id} className={styles.group} aria-label={column.name}>
          <header className={styles.groupHeader}>
            <button type="button" className={`fouc-action ${styles.groupToggle}`} data-surface="plain" data-variant="collapsible" aria-label={t('toggleGroup', { name: column.name })} aria-expanded={!collapsed[column.id]} aria-controls={contentId} onClick={() => setCollapsed(value => ({ ...value, [column.id]: !value[column.id] }))}>
              <CaretUp size={14} className={styles.chevron} aria-hidden /><TaskStatusIcon column={column} /><h2>{column.name}</h2><span className={styles.count}>{items.length}{items.length !== total && <span> / {total}</span>}</span>
            </button>
            {editable && <button type="button" className={`fouc-action ${styles.addTask}`} data-surface="plain" disabled={busy} aria-label={`${boardText('addTask')} · ${column.name}`} onClick={() => onCreate(column.id)}><Plus size={16} /></button>}
          </header>
          <div id={contentId} hidden={Boolean(collapsed[column.id])}>
            <table className={styles.table} aria-label={column.name}>
              <colgroup><col className={styles.selectionColumn} /><col className={styles.titleColumn} /><col className={styles.descriptionColumn} /><col className={styles.membersColumn} /><col className={styles.dateColumn} /><col className={styles.priorityColumn} /><col className={styles.statusColumn} /><col className={styles.labelsColumn} /><col className={styles.actionsColumn} /></colgroup>
              <thead><tr>
                <th scope="col" className={styles.selectionCell}>{editable && items.length > 0 ? <TaskSelectionBox checked={selectedCount === items.length} mixed={selectedCount > 0 && selectedCount < items.length} disabled={busy} label={t('selectGroup', { name: column.name })} onChange={checked => select(items.map(task => task.id), checked)} /> : <span aria-hidden>#</span>}</th>
                {(['task', 'description', 'assignees', 'startDate', 'priority', 'status', 'labels'] as const).map(key => <th scope="col" key={key}>{t(key)}</th>)}
                <th scope="col"><span className="sr-only">{t('actions')}</span></th>
              </tr></thead>
              <tbody>{items.map(task => <TaskTableRow key={task.id} task={task} column={column} board={board} busy={busy} selected={selectedIds.has(task.id)} onSelect={checked => select([task.id], checked)} onOpen={() => onOpen(task)} onRemove={() => onRemove(task)} onMove={columnId => { void move([task.id], columnId); }} />)}
                {!items.length && <tr><td colSpan={9} className={styles.empty}><span>{t(total ? 'filteredEmpty' : 'empty')}</span>{editable && !total && <button type="button" className="fouc-action" disabled={busy} onClick={() => onCreate(column.id)}><Plus size={13} />{boardText('addTask')}</button>}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>;
      })}
    </div>
  </div>;
}
