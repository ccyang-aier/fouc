'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { motion, Reorder } from 'motion/react';
import { Plus } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskColumn } from '@fouc/shared/tasks';
import { usePageScrollKey } from '@/lib/page-session-state';
import { useTranslation } from '@/lib/i18n';
import { TaskCard } from './task-card';
import { TaskBoardColumn } from './task-board-column';
import { createTaskDragPreview } from './task-drag-preview';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

type Drop = { columnId: string; beforeTaskId: string | null };
export function KanbanBoard({ board, tasks, canDrag, busy, onOpen, onCreate, onRemove, onMove, onColumn, onRemoveColumn, onReorderColumns }: {
  board: TaskBoardDetail; tasks: BoardTask[]; canDrag: boolean; busy: boolean;
  onOpen: (task: BoardTask) => void; onCreate: (columnId: string) => void; onRemove: (task: BoardTask) => void;
  onMove: (taskId: string, columnId: string, beforeTaskId: string | null) => void;
  onColumn: (column?: TaskColumn) => void; onRemoveColumn: (column: TaskColumn) => void; onReorderColumns: (ids: string[]) => void | Promise<boolean>;
}) {
  const { t } = useTranslation(messages);
  const scrollKey = usePageScrollKey(`tasks:${board.id}`);
  const editable = board.permission !== 'viewer';
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dragHeight, setDragHeight] = useState(0);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const orderDraft = useRef<string[] | null>(null);
  const orderStart = useRef<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const pendingOrder = useRef(false);
  const columnIds = columnOrder ?? board.columns.map(column => column.id);
  const columns = columnIds.map(id => board.columns.find(column => column.id === id)).filter((column): column is TaskColumn => Boolean(column));
  const clearPreview = useRef<(() => void) | null>(null);
  useEffect(() => () => clearPreview.current?.(), []);
  // Native dragover/drop can arrive before React paints the next indicator.
  const gesture = useRef<{ taskId: string | null; target: Drop | null }>({ taskId: null, target: null });
  function targetDrop(target: Drop | null) { gesture.current.target = target; setDrop(target); }
  function endDrag() { clearPreview.current?.(); clearPreview.current = null; gesture.current = { taskId: null, target: null }; setDraggedId(null); setDrop(null); setDragHeight(0); }
  function accept(event: React.DragEvent, target: Drop) {
    if (!gesture.current.taskId || !canDrag || busy) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
    if (gesture.current.target?.columnId !== target.columnId || gesture.current.target.beforeTaskId !== target.beforeTaskId) targetDrop(target);
  }
  function previewOrder(ids: string[] | null) { orderDraft.current = ids; setColumnOrder(ids); }
  async function commitOrder(ids: string[]) {
    if (pendingOrder.current || busy) return;
    pendingOrder.current = true; setSavingOrder(true); previewOrder(ids);
    try { await onReorderColumns(ids); }
    finally { pendingOrder.current = false; setSavingOrder(false); previewOrder(null); }
  }
  function finishColumnDrag() {
    setDraggedColumn(null);
    const ids = orderDraft.current;
    if (ids && ids.some((id, index) => id !== orderStart.current[index])) void commitOrder(ids);
    else previewOrder(null);
  }
  function moveColumn(index: number, direction: -1 | 1) {
    const ids = [...columnIds];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void commitOrder(ids);
  }
  return <motion.div layoutScroll className={styles.canvas} data-page-scroll={scrollKey} aria-label={t('kanban')}>
    <Reorder.Group as="div" axis="x" values={columnIds} onReorder={ids => { if (draggedColumn) previewOrder(ids); }} className={styles.columns}>
      {columns.map((column, index) => {
        const columnTasks = tasks.filter(task => task.columnId === column.id);
        const total = board.tasks.filter(task => task.columnId === column.id).length;
        return <TaskBoardColumn key={column.id} column={column} index={index} columnCount={columns.length} count={columnTasks.length} total={total}
          editable={editable} disabled={busy || savingOrder} dragging={draggedColumn === column.id} dropActive={drop?.columnId === column.id}
          onEdit={() => onColumn(column)} onRemove={() => onRemoveColumn(column)} onCreate={() => onCreate(column.id)} onShift={direction => moveColumn(index, direction)}
          onDragReady={() => { orderStart.current = [...columnIds]; setDraggedColumn(column.id); }} onDragFinish={finishColumnDrag} onDragCancel={() => { setDraggedColumn(null); previewOrder(null); }}
          onDragOver={event => {
            const sourceId = gesture.current.taskId;
            if (!sourceId) return;
            // The full-size placeholder belongs to the current drop position;
            // hovering it must not re-measure and shift that position again.
            if ((event.target as Element).closest('[data-drop-placeholder]') && gesture.current.target) { accept(event, gesture.current.target); return; }
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
          <div className={styles.cardList}>
            {columnTasks.map(task => <Fragment key={task.id}>
              {drop?.columnId === column.id && drop.beforeTaskId === task.id && <div className={styles.dropPlaceholder} style={{ height: dragHeight }} data-drop-placeholder aria-label={t('dropHere')} />}
              <TaskCard task={task} board={board} editable={editable && !busy} draggable={canDrag && !busy && !draggedColumn && !savingOrder} dragging={draggedId === task.id}
                onOpen={() => onOpen(task)} onRemove={() => onRemove(task)} onMove={columnId => onMove(task.id, columnId, null)}
                onDragStart={event => {
                  if (!canDrag || busy) { event.preventDefault(); return; }
                  event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-fouc-task', task.id);
                  clearPreview.current?.(); clearPreview.current = createTaskDragPreview(event.currentTarget, event, styles.dragPreviewHost);
                  setDragHeight(event.currentTarget.getBoundingClientRect().height);
                  gesture.current = { taskId: task.id, target: null }; setDraggedId(task.id);
                }} onDragEnd={endDrag} />
            </Fragment>)}
            {!columnTasks.length && !editable && <div className={styles.columnEmpty}>{t('emptyColumn')}</div>}
            {drop?.columnId === column.id && !drop.beforeTaskId && <div className={styles.dropPlaceholder} style={{ height: dragHeight }} data-drop-placeholder aria-label={t('dropHere')} />}
            {editable && <button className={`fouc-action ${styles.addTask}`} type="button" onClick={() => onCreate(column.id)}><Plus size={16} />{t('addTask')}</button>}
          </div>
        </TaskBoardColumn>;
      })}
      {editable && board.columns.length < 24 && <button type="button" className={`fouc-action ${styles.addColumn}`} aria-label={t('addColumn')} title={t('addColumn')} onClick={() => onColumn()}><Plus size={16} /><span>{t('addColumn')}</span></button>}
    </Reorder.Group>
  </motion.div>;
}
