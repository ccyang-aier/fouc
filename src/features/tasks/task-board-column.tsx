'use client';

import { useEffect, useRef, useState, type DragEventHandler, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { ArrowLeft, ArrowRight, DotsSix, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import type { TaskColumn } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { TaskStatusIcon } from './task-status-icon';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardColumn({ column, index, columnCount, count, total, editable, disabled, dragging, dropActive, onEdit, onCreate, onRemove, onShift, onDragReady, onDragFinish, onDragCancel, onDragOver, onDrop, children }: {
  column: TaskColumn; index: number; columnCount: number; count: number; total: number;
  editable: boolean; disabled: boolean; dragging: boolean; dropActive: boolean;
  onEdit: () => void; onCreate: () => void; onRemove: () => void; onShift: (direction: -1 | 1) => void;
  onDragReady: () => void; onDragFinish: () => void; onDragCancel: () => void;
  onDragOver: DragEventHandler<HTMLElement>; onDrop: DragEventHandler<HTMLElement>; children: ReactNode;
}) {
  const { t } = useTranslation(messages);
  const controls = useDragControls();
  const [open, setOpen] = useState(false);
  const stopPress = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => stopPress.current?.(), []);
  useEffect(() => { if (disabled || !editable) stopPress.current?.(); }, [disabled, editable]);

  function press(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    // Radix normally opens on pointerdown. Wait for the short click instead,
    // leaving a long press free to pick up the entire column.
    event.preventDefault();
    if (disabled) return;
    stopPress.current?.();
    suppressClick.current = false;
    const pointer = event.nativeEvent;
    let held = false;
    const timer = window.setTimeout(() => {
      held = true;
      suppressClick.current = true;
      setOpen(false);
      onDragReady();
      controls.start(pointer, { distanceThreshold: 0 });
    }, 400);
    function clear() {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape, true);
      stopPress.current = null;
    }
    function cancel() {
      clear();
      suppressClick.current = true;
      // stop also snaps the dragged motion value back and ends Reorder's
      // auto-scroll; the parent restores the draft without saving it.
      if (held) { controls.stop(); onDragCancel(); }
    }
    function release(next: PointerEvent) {
      if (next.pointerId !== pointer.pointerId) return;
      clear();
      if (held) { controls.stop(); onDragFinish(); }
    }
    function move(next: PointerEvent) {
      if (next.pointerId === pointer.pointerId && !held && Math.hypot(next.clientX - pointer.clientX, next.clientY - pointer.clientY) > 6) cancel();
    }
    function escape(next: KeyboardEvent) {
      if (next.key === 'Escape') { next.preventDefault(); cancel(); }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape, true);
    stopPress.current = cancel;
  }

  return <Reorder.Item as="section" value={column.id} layout="position" dragListener={false} dragControls={controls} dragMomentum={false} dragElastic={0}
    dragTransition={{ bounceStiffness: 500, bounceDamping: 50 }} transition={{ layout: { duration: .26, ease: [.22, 1, .36, 1] } }}
    className={styles.column} aria-label={column.name} data-column-id={column.id} data-column-dragging={dragging || undefined} data-drop-active={dropActive || undefined}
    onDragOver={onDragOver} onDrop={onDrop}>
    <header className={styles.columnHeader}><TaskStatusIcon column={column} /><h2>{column.name}</h2><span className={styles.columnCount}>{count}{count !== total && <span>/{total}</span>}</span>
      {editable && <div className={styles.columnActions}>
        <DropdownMenu open={open} onOpenChange={setOpen}><DropdownMenuTrigger asChild>
          <button type="button" className={`fouc-action ${styles.iconButton} ${styles.columnHandle}`} aria-label={t('statusActions', { name: column.name })} disabled={disabled} data-held={dragging || undefined}
            onPointerDown={press} onClick={event => { if (event.detail === 0 || !suppressClick.current) setOpen(value => !value); else { event.preventDefault(); event.stopPropagation(); } }}
            onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()}><DotsSix size={17} weight="bold" /></button>
        </DropdownMenuTrigger><DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem disabled={disabled} onSelect={onEdit}><PencilSimple />{t('editColumn')}</DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0 || disabled} onSelect={() => onShift(-1)}><ArrowLeft />{t('moveLeft')}</DropdownMenuItem>
          <DropdownMenuItem disabled={index === columnCount - 1 || disabled} onSelect={() => onShift(1)}><ArrowRight />{t('moveRight')}</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={total > 0 || columnCount === 1 || disabled} onSelect={onRemove}><Trash />{t('removeColumn')}</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
        <button className={`fouc-action ${styles.iconButton}`} type="button" disabled={disabled} aria-label={`${t('addTask')} · ${column.name}`} onClick={onCreate}><Plus size={16} /></button>
      </div>}
    </header>
    {children}
  </Reorder.Item>;
}
