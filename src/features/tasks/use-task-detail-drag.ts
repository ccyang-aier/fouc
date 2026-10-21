import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';

type Position = { left: number; top: number };
type Gesture = Position & { id: number; x: number; y: number; handle: HTMLElement };

export function useTaskDetailDrag(dialogRef: RefObject<HTMLDialogElement | null>, enabled: boolean) {
  const position = useRef<Position | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const place = useCallback(({ left, top }: Position) => {
    const element = dialogRef.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const maxTop = Math.max(12, window.innerHeight - height - 12);
    position.current = {
      left: Math.min(maxLeft, Math.max(12, left)),
      top: Math.min(maxTop, Math.max(Math.min(52, maxTop), top)),
    };
    Object.assign(element.style, { left: `${position.current.left}px`, top: `${position.current.top}px`, right: 'auto', bottom: 'auto' });
  }, [dialogRef]);

  const finish = useCallback((cancel: boolean) => {
    const start = gesture.current;
    if (!start) return;
    gesture.current = null;
    if (cancel) place(start);
    setDragging(false);
    if (start.handle.hasPointerCapture(start.id)) start.handle.releasePointerCapture(start.id);
  }, [place]);

  useEffect(() => {
    if (!enabled) return;
    if (position.current) place(position.current);
    const resize = () => {
      finish(true);
      if (position.current) place(position.current);
    };
    const cancel = () => finish(true);
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !gesture.current) return;
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    };
    window.addEventListener('resize', resize);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', keydown, true);
    return () => {
      finish(true);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', keydown, true);
    };
  }, [enabled, finish, place]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!enabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    if (event.target instanceof Element && event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
    const bounds = dialogRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    suppressClick.current = true;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top, handle: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    place({ left: start.left + event.clientX - start.x, top: start.top + event.clientY - start.y });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const bounds = dialogRef.current?.getBoundingClientRect();
    if (!offset || !bounds) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    place({ left: bounds.left + offset[0] * step, top: bounds.top + offset[1] * step });
  }

  return {
    dragging,
    onKeyDown,
    dialogProps: {
      onPointerDownCapture: () => { suppressClick.current = false; },
      onClickCapture: (event: MouseEvent<HTMLDialogElement>) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLElement>) => { if (gesture.current?.id === event.pointerId) finish(false); },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => { if (gesture.current?.id === event.pointerId) finish(true); },
      onLostPointerCapture: (event: PointerEvent<HTMLElement>) => { if (gesture.current?.id === event.pointerId) finish(false); },
    },
  };
}
