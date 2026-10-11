"use client"

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { GRID_COLUMN_MAX_WIDTH, GRID_COLUMN_MIN_WIDTH, moveGridColumn, type GridLayout } from './model'

type ActiveColumnPointer = { kind: 'resize' | 'move'; column: number; source: number; startX: number; startY: number; startWidth: number; width: number; target: number; slot: number; active: boolean; timer?: ReturnType<typeof setTimeout>; element: HTMLElement; pointerId: number }
export type GridColumnPreview = { kind: 'resize' | 'move'; column: number; width: number; target: number; slot: number }

/** Short header clicks select; a held header reorders, while the edge resizes immediately. */
export function useGridColumnInteractions({ viewport, keys, visible, widths, layout, onChange }: { viewport: RefObject<HTMLDivElement | null>; keys: readonly string[]; visible: readonly number[]; widths: readonly number[]; layout: GridLayout; onChange: (layout: GridLayout) => void }) {
  const active = useRef<ActiveColumnPointer | null>(null), frame = useRef<number | null>(null), pointer = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const [preview, setPreview] = useState<GridColumnPreview | null>(null)
  const release = useCallback(() => {
    const gesture = active.current
    active.current = null
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    if (gesture) {
      clearTimeout(gesture.timer)
      if (gesture.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId)
    }
    return gesture
  }, [])
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !active.current) return
      event.preventDefault(); event.stopPropagation()
      suppressClick.current = true
      release(); setPreview(null)
    }
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('keydown', escape, true); release() }
  }, [release])
  function paint(gesture: ActiveColumnPointer) {
    setPreview({ kind: gesture.kind, column: gesture.column, width: gesture.width, target: gesture.target, slot: gesture.slot })
  }
  function start(event: PointerEvent<HTMLElement>, kind: 'resize' | 'move', visibleIndex: number) {
    if (event.button !== 0 || kind === 'move' && (!event.currentTarget.contains(event.target as Node) || (event.target as Element).closest('button, [data-grid-column-actions]'))) return
    event.preventDefault(); event.stopPropagation()
    release(); suppressClick.current = false
    const gesture: ActiveColumnPointer = { kind, column: visible[visibleIndex], source: visibleIndex, startX: event.clientX, startY: event.clientY, startWidth: widths[visibleIndex], width: widths[visibleIndex], target: visibleIndex, slot: visibleIndex, active: kind === 'resize', element: event.currentTarget, pointerId: event.pointerId }
    active.current = gesture
    event.currentTarget.setPointerCapture(event.pointerId)
    if (kind === 'move') gesture.timer = setTimeout(() => {
      if (active.current !== gesture) return
      gesture.active = true; suppressClick.current = true
      gesture.element.focus({ preventScroll: true }); paint(gesture)
    }, 220)
  }
  function locate(gesture: ActiveColumnPointer, point: { x: number; y: number }) {
    if (gesture.kind === 'resize') {
      gesture.width = Math.round(Math.max(GRID_COLUMN_MIN_WIDTH, Math.min(GRID_COLUMN_MAX_WIDTH, gesture.startWidth + point.x - gesture.startX)))
      return
    }
    const element = viewport.current
    if (!element) return
    const bounds = element.getBoundingClientRect(), header = document.elementFromPoint(Math.max(bounds.left + 2, Math.min(bounds.right - 2, point.x)), bounds.top + 20)?.closest<HTMLElement>('[data-grid-target="column"]')
    if (header) {
      const rect = header.getBoundingClientRect()
      gesture.slot = Number(header.dataset.gridColumn) + (point.x >= rect.left + rect.width / 2 ? 1 : 0)
    } else {
      const headers = element.querySelectorAll<HTMLElement>('[data-grid-target="column"]')
      if (point.x < headers[0].getBoundingClientRect().left) gesture.slot = 0
      else if (point.x >= headers[headers.length - 1].getBoundingClientRect().right) gesture.slot = visible.length
      else return
    }
    gesture.target = Math.max(0, Math.min(visible.length - 1, gesture.slot > gesture.source ? gesture.slot - 1 : gesture.slot))
  }
  function move(event: PointerEvent<HTMLElement>) {
    const gesture = active.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.stopPropagation(); pointer.current = { x: event.clientX, y: event.clientY }
    if (!gesture.active) {
      if (Math.abs(event.clientX - gesture.startX) > 6 || Math.abs(event.clientY - gesture.startY) > 6) release()
      return
    }
    event.preventDefault()
    if (frame.current !== null) return
    const update = () => {
      frame.current = null
      const gesture = active.current, point = pointer.current, element = viewport.current
      if (!gesture || !point || !element) return
      locate(gesture, point)
      if (gesture.kind === 'move') {
        const bounds = element.getBoundingClientRect()
        const threshold = 48, distance = point.x < bounds.left + threshold ? point.x - bounds.left : point.x > bounds.right - threshold ? bounds.right - point.x : threshold
        if (distance < threshold) {
          const direction = point.x < bounds.left + threshold ? -1 : 1, previous = element.scrollLeft
          element.scrollBy(direction * Math.max(1, Math.round(24 * (1 - Math.max(0, distance) / threshold) ** 2)), 0)
          if (element.scrollLeft !== previous) frame.current = requestAnimationFrame(update)
        }
      }
      paint(gesture)
    }
    frame.current = requestAnimationFrame(update)
  }
  function finish(event: PointerEvent<HTMLElement>, cancel = false) {
    const gesture = active.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!cancel && gesture.active) locate(gesture, { x: event.clientX, y: event.clientY })
    release(); setPreview(null)
    if (!cancel && gesture.active) {
      if (gesture.kind === 'resize' && gesture.width !== gesture.startWidth) onChange({ ...layout, widths: { ...layout.widths, [keys[gesture.column]]: gesture.width } })
      else if (gesture.kind === 'move' && gesture.target !== gesture.source) onChange(moveGridColumn(layout, keys, gesture.source, gesture.target))
    }
  }
  function click(event: MouseEvent<HTMLElement>) {
    if (!suppressClick.current) return false
    suppressClick.current = false; event.preventDefault(); event.stopPropagation()
    return true
  }
  return { preview, start, move, finish, click }
}
