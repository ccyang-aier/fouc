'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'

export type DirectoryColumn = 'name' | 'target' | 'projects' | 'tags' | 'account' | 'authSource' | 'status' | 'actions'
type Widths = Partial<Record<DirectoryColumn, number>>
const minimum: Record<DirectoryColumn, number> = { name: 130, target: 100, projects: 80, tags: 80, account: 96, authSource: 90, status: 110, actions: 120 }
const prefix = 'fouc:connection-directory:widths:'
const empty: Widths = {}, snapshots = new Map<string, Widths>(), listeners = new Set<() => void>()

function snapshot(scope: string): Widths {
  const cached = snapshots.get(scope)
  if (cached) return cached
  const widths: Widths = {}
  try {
    const raw = JSON.parse(window.localStorage.getItem(prefix + scope) ?? '{}')
    for (const column of Object.keys(minimum) as DirectoryColumn[]) {
      const width = raw?.[column]
      if (typeof width === 'number' && Number.isFinite(width) && width > 0) widths[column] = Math.round(width)
    }
  } catch { /* Browser preferences may be unavailable; resizing still works in this session. */ }
  snapshots.set(scope, widths)
  return widths
}
function changed(event: StorageEvent) {
  if (event.key !== null && !event.key.startsWith(prefix)) return
  if (event.key === null) snapshots.clear()
  else snapshots.delete(event.key.slice(prefix.length))
  for (const notify of listeners) notify()
}
function subscribe(notify: () => void) {
  if (!listeners.size) window.addEventListener('storage', changed)
  listeners.add(notify)
  return () => { listeners.delete(notify); if (!listeners.size) window.removeEventListener('storage', changed) }
}
function save(scope: string, widths: Widths) {
  snapshots.set(scope, widths)
  try { window.localStorage.setItem(prefix + scope, JSON.stringify(widths)) } catch { /* Keep the applied in-memory layout. */ }
  for (const notify of listeners) notify()
}
type Gesture = { column: DirectoryColumn; startX: number; widths: Widths; element: HTMLButtonElement; pointerId: number }

/** Freeze measured columns during a gesture, then persist once under provider. */
export function useDirectoryColumnWidths(scope: string, table: RefObject<HTMLTableElement | null>, columns: readonly DirectoryColumn[]) {
  const getSnapshot = useCallback(() => snapshot(scope), [scope])
  const saved = useSyncExternalStore(subscribe, getSnapshot, () => empty)
  const [preview, setPreview] = useState<Widths | null>(null)
  const [resizing, setResizing] = useState<DirectoryColumn | null>(null)
  const active = useRef<Gesture | null>(null)
  const widths = preview ?? saved

  function measure(): Widths {
    const measured = { ...saved }
    table.current?.querySelectorAll<HTMLElement>('[data-directory-column]').forEach(header => {
      const column = header.dataset.directoryColumn as DirectoryColumn
      measured[column] = Math.round(header.getBoundingClientRect().width)
    })
    return measured
  }
  function resized(gesture: Gesture, x: number): Widths {
    return { ...gesture.widths, [gesture.column]: Math.max(minimum[gesture.column], Math.round(gesture.widths[gesture.column]! + x - gesture.startX)) }
  }
  function stop(cancel: boolean, x?: number) {
    const gesture = active.current
    if (!gesture) return
    active.current = null
    if (!cancel && x !== undefined) save(scope, resized(gesture, x))
    if (gesture.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId)
    setPreview(null); setResizing(null)
  }
  useEffect(() => () => {
    const gesture = active.current
    active.current = null
    if (gesture?.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId)
  }, [])

  function start(event: PointerEvent<HTMLButtonElement>, column: DirectoryColumn) {
    if (event.button !== 0 || active.current) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus()
    active.current = { column, startX: event.clientX, widths: measure(), element: event.currentTarget, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(column)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (active.current?.pointerId === event.pointerId) setPreview(resized(active.current, event.clientX))
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    if (active.current?.pointerId !== event.pointerId) return
    event.stopPropagation(); stop(cancel, event.clientX)
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, column: DirectoryColumn) {
    if (event.key === 'Escape' && active.current) { event.preventDefault(); event.stopPropagation(); stop(true); return }
    if (active.current || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault(); event.stopPropagation()
    const measured = measure(), step = event.shiftKey ? 40 : 10
    save(scope, { ...measured, [column]: Math.max(minimum[column], measured[column]! + (event.key === 'ArrowRight' ? step : -step)) })
  }
  const fixed = columns.every(column => widths[column] !== undefined)
  return {
    widths, resizing,
    tableStyle: fixed ? { width: 48 + columns.reduce((total, column) => total + widths[column]!, 0), minWidth: 0 } : undefined,
    handleProps: (column: DirectoryColumn) => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, column),
      onPointerMove: move,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => key(event, column),
      onClick: (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation(),
      'data-resizing': resizing === column,
    }),
  }
}
