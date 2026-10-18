'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, DotsThree, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskColumn } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePageScrollKey } from '@/lib/page-session-state';
import { useTranslation } from '@/lib/i18n';
import { TaskCard } from './task-card';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

type Drop = { columnId: string; beforeTaskId: string | null };
export function KanbanBoard({ board, tasks, canDrag, busy, onOpen, onCreate, onRemove, onMove, onColumn, onRemoveColumn, onReorderColumns }: {
  board: TaskBoardDetail; tasks: BoardTask[]; canDrag: boolean; busy: boolean;
  onOpen: (task: BoardTask) => void; onCreate: (columnId: string) => void; onRemove: (task: BoardTask) => void;
  onMove: (taskId: string, columnId: string, beforeTaskId: string | null) => void;
  onColumn: (column?: TaskColumn) => void; onRemoveColumn: (column: TaskColumn) => void; onReorderColumns: (ids: string[]) => void;
}) {
  const { t } = useTranslation(messages);
  const scrollKey = usePageScrollKey(`tasks:${board.id}`);
  const editable = board.permission !== 'viewer';
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  // Native dragover/drop can arrive before React paints the next indicator.
  const gesture = useRef<{ taskId: string | null; target: Drop | null }>({ taskId: null, target: null });
  function targetDrop(target: Drop | null) { gesture.current.target = target; setDrop(target); }
  function endDrag() { gesture.current = { taskId: null, target: null }; setDraggedId(null); setDrop(null); }
  function accept(event: React.DragEvent, target: Drop) {
    if (!gesture.current.taskId || !canDrag || busy) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
    if (gesture.current.target?.columnId !== target.columnId || gesture.current.target.beforeTaskId !== target.beforeTaskId) targetDrop(target);
  }
  function moveColumn(index: number, direction: number) {
    const ids = board.columns.map(column => column.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    onReorderColumns(ids);
  }
  return <div className={styles.canvas} data-page-scroll={scrollKey} aria-label={t('kanban')}>
    <div className={styles.columns}>
      {board.columns.map((column, index) => {
        const columnTasks = tasks.filter(task => task.columnId === column.id);
        const total = board.tasks.filter(task => task.columnId === column.id).length;
        return <section className={styles.column} key={column.id} aria-label={column.name} data-column-id={column.id}
          data-drop-active={drop?.columnId === column.id || undefined}
          onDragOver={event => {
            const sourceId = gesture.current.taskId;
            if (!sourceId) return;
            const hovered = (event.target as Element).closest<HTMLElement>('[data-task-id]');
            if (hovered?.dataset.taskId === sourceId) { event.preventDefault(); event.stopPropagation(); targetDrop(null); return; }
            const before = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-task-id]')].find(card => {
              if (card.dataset.taskId === sourceId) return false;
              const rect = card.getBoundingClientRect();
              return event.clientY < rect.top + rect.height / 2;
            });
            accept(event, { columnId: column.id, beforeTaskId: before?.dataset.taskId ?? null });
          }}
          onDrop={event => { const { taskId, target } = gesture.current; if (!taskId || !target || target.columnId !== column.id) return; event.preventDefault(); event.stopPropagation(); onMove(taskId, target.columnId, target.beforeTaskId); endDrag(); }}>
          <header className={styles.columnHeader}><span className={styles.statusDot} data-color={column.color}>{column.isDone && <Check size={10} weight="bold" />}</span><h2>{column.name}</h2><span className={styles.columnCount}>{columnTasks.length}{columnTasks.length !== total && <span>/{total}</span>}</span>
            {editable && <div className={styles.columnActions}><button className={`fouc-action ${styles.iconButton}`} type="button" aria-label={`${t('addTask')} · ${column.name}`} onClick={() => onCreate(column.id)}><Plus size={16} /></button>
              <DropdownMenu><DropdownMenuTrigger className={styles.iconButton} aria-label={t('statusActions', { name: column.name })}><DotsThree size={19} weight="bold" /></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact">
                <DropdownMenuItem onSelect={() => onColumn(column)}><PencilSimple weight="duotone" />{t('editColumn')}</DropdownMenuItem>
                <DropdownMenuItem disabled={index === 0 || busy} onSelect={() => moveColumn(index, -1)}><ArrowLeft />{t('moveLeft')}</DropdownMenuItem>
                <DropdownMenuItem disabled={index === board.columns.length - 1 || busy} onSelect={() => moveColumn(index, 1)}><ArrowRight />{t('moveRight')}</DropdownMenuItem>
                <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={total > 0 || board.columns.length === 1 || busy} onSelect={() => onRemoveColumn(column)}><Trash weight="duotone" />{t('removeColumn')}</DropdownMenuItem>
                {(total > 0 || board.columns.length === 1) && <DropdownMenuLabel className={styles.menuHint}>{t(total > 0 ? 'columnHasTasks' : 'lastColumn')}</DropdownMenuLabel>}
              </DropdownMenuContent></DropdownMenu>
            </div>}
          </header>
          <div className={styles.cardList}>
            {columnTasks.map(task => <TaskCard key={task.id} task={task} board={board} editable={editable && !busy} draggable={canDrag && !busy} dragging={draggedId === task.id}
              insertBefore={drop?.beforeTaskId === task.id} onOpen={() => onOpen(task)} onRemove={() => onRemove(task)} onMove={columnId => onMove(task.id, columnId, null)}
              onDragStart={event => { if (!canDrag || busy) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-fouc-task', task.id); gesture.current = { taskId: task.id, target: null }; setDraggedId(task.id); }}
              onDragEnd={endDrag} />)}
            {!columnTasks.length && !editable && <div className={styles.columnEmpty}>{t('emptyColumn')}</div>}
            {drop?.columnId === column.id && !drop.beforeTaskId && <div className={styles.dropEnd} aria-label={t('dropHere')} />}
            {editable && <button className={`fouc-action ${styles.addTask}`} type="button" onClick={() => onCreate(column.id)}><Plus size={16} />{t('addTask')}</button>}
          </div>
        </section>;
      })}
      {editable && board.columns.length < 24 && <button type="button" className={`fouc-action ${styles.addColumn}`} aria-label={t('addColumn')} title={t('addColumn')} onClick={() => onColumn()}><Plus size={16} /><span>{t('addColumn')}</span></button>}
    </div>
  </div>;
}
