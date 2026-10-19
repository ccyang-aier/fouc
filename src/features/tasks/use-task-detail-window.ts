'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

export type TaskDetailRect = { left: number; top: number; width: number; height: number };
export type TaskDetailResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type Viewport = { width: number; height: number };
type Gesture = { edge: TaskDetailResizeEdge | null; start: TaskDetailRect; x: number; y: number; pointerId: number; target: HTMLElement };
const MARGIN = 12;
const TOP = 52;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(value, maximum));
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

export function fitTaskDetailRect(rect: TaskDetailRect, size: Viewport): TaskDetailRect {
  const availableWidth = Math.max(1, size.width - MARGIN * 2);
  const availableHeight = Math.max(1, size.height - TOP - MARGIN);
  const width = clamp(rect.width, Math.min(520, availableWidth), availableWidth);
  const height = clamp(rect.height, Math.min(420, availableHeight), availableHeight);
  return { width, height, left: clamp(rect.left, MARGIN, size.width - width - MARGIN), top: clamp(rect.top, TOP, size.height - height - MARGIN) };
}

function initialRect(size: Viewport) {
  return fitTaskDetailRect({ left: size.width - 904, top: 76, width: 880, height: 660 }, size);
}

function resizeRect(start: TaskDetailRect, edge: TaskDetailResizeEdge, dx: number, dy: number, size: Viewport): TaskDetailRect {
  let left = start.left, top = start.top, right = left + start.width, bottom = top + start.height;
  const minWidth = Math.min(520, size.width - MARGIN * 2), minHeight = Math.min(420, size.height - TOP - MARGIN);
  if (edge.includes('e')) right = clamp(right + dx, left + minWidth, size.width - MARGIN);
  if (edge.includes('w')) left = clamp(left + dx, MARGIN, right - minWidth);
  if (edge.includes('s')) bottom = clamp(bottom + dy, top + minHeight, size.height - MARGIN);
  if (edge.includes('n')) top = clamp(top + dy, TOP, bottom - minHeight);
  return { left, top, width: right - left, height: bottom - top };
}

export function useTaskDetailWindow(visible: boolean) {
  const [rect, setRect] = useState<TaskDetailRect | null>(null);
  const [tracking, setTracking] = useState<'move' | TaskDetailResizeEdge | null>(null);
  const currentRect = useRef(rect);
  const gesture = useRef<Gesture | null>(null);
  const apply = useCallback((next: TaskDetailRect) => { currentRect.current = next; setRect(next); }, []);
  const finish = useCallback((cancel: boolean) => {
    const current = gesture.current;
    if (!current) return false;
    gesture.current = null;
    if (cancel) apply(fitTaskDetailRect(current.start, viewport()));
    setTracking(null);
    if (current.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
    return true;
  }, [apply]);

  useLayoutEffect(() => {
    if (!visible) return;
    function fit() { const next = fitTaskDetailRect(currentRect.current ?? initialRect(viewport()), viewport()); currentRect.current = next; setRect(next); }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [visible]);

  useEffect(() => {
    if (!tracking || !visible) return;
    function move(event: PointerEvent) {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - active.x, dy = event.clientY - active.y;
      apply(fitTaskDetailRect(active.edge ? resizeRect(active.start, active.edge, dx, dy, viewport()) : { ...active.start, left: active.start.left + dx, top: active.start.top + dy }, viewport()));
    }
    function release(event: PointerEvent) { if (event.pointerId === gesture.current?.pointerId) finish(false); }
    function cancel() { finish(true); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); finish(true); } }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel); window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', escape, true);
    };
  }, [tracking, visible, apply, finish]);

  useEffect(() => { if (!visible) finish(true); }, [visible, finish]);

  function begin(event: ReactPointerEvent<HTMLElement>, edge: TaskDetailResizeEdge | null) {
    if (event.button !== 0 || gesture.current || !visible) return;
    if (!edge && event.target instanceof Element && event.target.closest('input, textarea, button, a, [contenteditable="true"]')) return;
    event.preventDefault(); event.stopPropagation();
    const start = currentRect.current ?? initialRect(viewport());
    gesture.current = { edge, start, x: event.clientX, y: event.clientY, pointerId: event.pointerId, target: event.currentTarget };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setTracking(edge ?? 'move');
  }
  function key(event: ReactKeyboardEvent<HTMLElement>, edge: TaskDetailResizeEdge | null) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 40 : 10;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const start = currentRect.current ?? initialRect(viewport());
    apply(edge ? resizeRect(start, edge, dx, dy, viewport()) : fitTaskDetailRect({ ...start, left: start.left + dx, top: start.top + dy }, viewport()));
  }

  return {
    rect, tracking, cancelGesture: () => finish(true),
    style: rect ? { ...rect, right: 'auto', bottom: 'auto' } : undefined,
    moveProps: { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => begin(event, null), onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => key(event, null) },
    resizeProps: (edge: TaskDetailResizeEdge) => ({ onPointerDown: (event: ReactPointerEvent<HTMLElement>) => begin(event, edge), onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => key(event, edge), onLostPointerCapture: () => finish(true) }),
  };
}
