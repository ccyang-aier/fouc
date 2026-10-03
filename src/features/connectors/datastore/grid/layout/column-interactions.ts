"use client"

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { GRID_COLUMN_MAX_WIDTH, GRID_COLUMN_MIN_WIDTH, moveGridColumn, type GridLayout } from './model'

type ActiveColumnPointer = { kind: 'resize' | 'move'; column: number; startX: number; startWidth: number; width: number; target: number; moved: boolean; element: HTMLButtonElement; pointerId: number }
export type GridColumnPreview = { kind: 'resize' | 'move'; column: number; width: number; target: number; moved: boolean }

/** Separate handles preserve header selection and sorting. One layout write happens when the gesture ends. */
export function useGridColumnInteractions({ viewport, keys, visible, widths, layout, onChange }: { viewport: RefObject<HTMLDivElement | null>; keys: readonly string[]; visible: readonly number[]; widths: readonly number[]; layout: GridLayout; onChange: (layout: GridLayout) => void }) {
  const active = useRef<ActiveColumnPointer | null>(null), frame = useRef<number | null>(null), pointer = useRef<{ x: number; y: number } | null>(null)
  const [preview, setPreview] = useState<GridColumnPreview | null>(null)
  function commit(gesture: ActiveColumnPointer) {
    if (gesture.kind === 'resize') onChange({ ...layout, widths: { ...layout.widths, [keys[gesture.column]]: gesture.width } })
    else if (gesture.moved) onChange(moveGridColumn(layout, keys, visible.indexOf(gesture.column), gesture.target))
  }
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); const gesture = active.current; active.current = null; if (gesture?.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId) }, [])
  function start(event: PointerEvent<HTMLButtonElement>, kind: 'resize' | 'move', visibleIndex: number) {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    active.current = { kind, column: visible[visibleIndex], startX: event.clientX, startWidth: widths[visibleIndex], width: widths[visibleIndex], target: visibleIndex, moved: false, element: event.currentTarget, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!active.current) return
    event.stopPropagation(); pointer.current = { x: event.clientX, y: event.clientY }
    if (frame.current !== null) return
    const update = () => {
      frame.current = null
      const gesture = active.current, point = pointer.current, element = viewport.current
      if (!gesture || !point || !element) return
      gesture.moved ||= Math.abs(point.x - gesture.startX) >= 4
      if (gesture.kind === 'resize') gesture.width = Math.round(Math.max(GRID_COLUMN_MIN_WIDTH, Math.min(GRID_COLUMN_MAX_WIDTH, gesture.startWidth + point.x - gesture.startX)))
      else if (gesture.moved) {
        const bounds = element.getBoundingClientRect(), header = document.elementFromPoint(Math.max(bounds.left + 2, Math.min(bounds.right - 2, point.x)), bounds.top + 20)?.closest<HTMLElement>('[data-grid-target="column"]')
        if (header) gesture.target = Number(header.dataset.gridColumn)
        const threshold = 48, distance = point.x < bounds.left + threshold ? point.x - bounds.left : point.x > bounds.right - threshold ? bounds.right - point.x : threshold
        if (distance < threshold) { const direction = point.x < bounds.left + threshold ? -1 : 1; element.scrollBy(direction * Math.max(1, Math.round(24 * (1 - Math.max(0, distance) / threshold) ** 2)), 0); frame.current = requestAnimationFrame(update) }
      }
      setPreview({ kind: gesture.kind, column: gesture.column, width: gesture.width, target: gesture.target, moved: gesture.moved })
    }
    frame.current = requestAnimationFrame(update)
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const gesture = active.current
    if (!gesture) return
    event.stopPropagation(); active.current = null
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    if (!cancel) {
      if (gesture.kind === 'resize') gesture.width = Math.round(Math.max(GRID_COLUMN_MIN_WIDTH, Math.min(GRID_COLUMN_MAX_WIDTH, gesture.startWidth + event.clientX - gesture.startX)))
      commit(gesture)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setPreview(null)
  }
  return { preview, start, move, finish }
}
