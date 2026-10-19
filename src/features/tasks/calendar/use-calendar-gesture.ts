'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { BoardTask, TaskSchedule } from '@fouc/shared/tasks';
import { atMinute, DAY_HEIGHT, makeSchedule, SNAP_MINUTES } from './calendar-model';

type Gesture = { kind: 'create' | 'move' | 'resize'; task: BoardTask | null; x: number; y: number; origin: Date; offset: number; moved: boolean; schedule: TaskSchedule };
export type SchedulePreview = { taskId: string | null; schedule: TaskSchedule; resizing: boolean };

export function useCalendarGesture({ surface, days, disabled, onCreate, onUpdate }: {
  surface: RefObject<HTMLDivElement | null>; days: Date[]; disabled: boolean;
  onCreate: (schedule: TaskSchedule, anchor: { x: number; y: number }) => void;
  onUpdate: (task: BoardTask, schedule: TaskSchedule) => Promise<boolean>;
}) {
  const current = useRef<Gesture | null>(null);
  const lastDrag = useRef(0);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [tracking, setTracking] = useState(false);
  const callbacks = useRef({ onCreate, onUpdate });
  useEffect(() => { callbacks.current = { onCreate, onUpdate }; }, [onCreate, onUpdate]);

  function point(x: number, y: number) {
    const rect = surface.current!.getBoundingClientRect();
    const index = Math.max(0, Math.min(days.length - 1, Math.floor((x - rect.left) / rect.width * days.length)));
    const minute = Math.max(0, Math.min(1440 - SNAP_MINUTES, Math.round((y - rect.top) / DAY_HEIGHT * 1440 / SNAP_MINUTES) * SNAP_MINUTES));
    return atMinute(days[index], minute);
  }
  function begin(event: ReactPointerEvent<HTMLElement>, task: BoardTask | null = null, kind: Gesture['kind'] = 'create') {
    if (disabled || event.button !== 0 || current.current || (kind === 'create' && event.pointerType === 'touch')) return;
    event.stopPropagation();
    const origin = point(event.clientX, event.clientY);
    const schedule = task?.schedule ?? makeSchedule(origin, origin.getHours() * 60 + origin.getMinutes());
    current.current = { kind, task, x: event.clientX, y: event.clientY, origin, offset: task?.schedule ? origin.getTime() - Date.parse(task.schedule.startsAt) : 0, moved: false, schedule };
    setTracking(true);
  }

  useEffect(() => {
    if (!tracking || !surface.current) return;
    const node = surface.current;
    function locate(x: number, y: number) {
      const rect = node.getBoundingClientRect();
      const index = Math.max(0, Math.min(days.length - 1, Math.floor((x - rect.left) / rect.width * days.length)));
      return atMinute(days[index], Math.max(0, Math.min(1440, Math.round((y - rect.top) / DAY_HEIGHT * 1440 / SNAP_MINUTES) * SNAP_MINUTES)));
    }
    function move(event: PointerEvent) {
      const gesture = current.current;
      if (!gesture || (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 5)) return;
      event.preventDefault(); gesture.moved = true;
      const target = locate(event.clientX, event.clientY).getTime();
      let startsAt: number, endsAt: number;
      if (gesture.kind === 'create') { startsAt = Math.min(gesture.origin.getTime(), target); endsAt = Math.max(startsAt + SNAP_MINUTES * 60_000, gesture.origin.getTime(), target); }
      else if (gesture.kind === 'resize') { startsAt = Date.parse(gesture.schedule.startsAt); endsAt = Math.max(startsAt + SNAP_MINUTES * 60_000, target); }
      else { startsAt = target - gesture.offset; endsAt = startsAt + Date.parse(gesture.task!.schedule!.endsAt) - Date.parse(gesture.task!.schedule!.startsAt); }
      gesture.schedule = { ...gesture.schedule, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() };
      setPreview({ taskId: gesture.task?.id ?? null, schedule: gesture.schedule, resizing: gesture.kind === 'resize' });
    }
    function cancel() { current.current = null; setPreview(null); setTracking(false); }
    function finish(event: PointerEvent) {
      const gesture = current.current; if (!gesture) return;
      current.current = null; setTracking(false);
      if (gesture.moved) lastDrag.current = Date.now();
      if (gesture.kind === 'create') { setPreview(null); callbacks.current.onCreate(gesture.schedule, { x: event.clientX, y: event.clientY }); }
      else if (gesture.moved) { void callbacks.current.onUpdate(gesture.task!, gesture.schedule).finally(() => setPreview(null)); }
      else setPreview(null);
    }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); lastDrag.current = Date.now(); cancel(); } }
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key); };
  }, [tracking, surface, days]);
  return { begin, preview, tracking, suppressClick: () => Date.now() - lastDrag.current < 300 };
}
