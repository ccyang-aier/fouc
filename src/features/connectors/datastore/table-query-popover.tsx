"use client"

import { useEffectEvent, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { getOverlayRoot } from "@/lib/overlay-root"
import styles from "./table-query.module.css"

/** Non-modal query forms share anchoring, dismissal and focus restoration. */
export function TableQueryPopover({ id, open, anchor, returnFocus, interactionScope, onClose, label, children, className, width = 660 }: {
  id: string
  open: boolean
  anchor: RefObject<HTMLElement | null>
  returnFocus?: RefObject<HTMLElement | null>
  interactionScope?: string
  onClose: () => void
  label: string
  children: ReactNode
  className?: string
  width?: number
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(onClose)
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" })
  useLayoutEffect(() => {
    if (!open || !panel.current || !anchor.current) return
    const surface = panel.current
    const anchorNode = anchor.current
    const focusTarget = returnFocus?.current
    const previous = document.activeElement as HTMLElement | null
    let restore = true
    function place() {
      const bounds = anchorNode.getBoundingClientRect()
      const inset = 12, gap = 4
      const actualWidth = Math.min(width, window.innerWidth - inset * 2)
      const below = window.innerHeight - bounds.bottom - gap - inset
      const above = bounds.top - gap - inset
      const height = surface.scrollHeight
      const useAbove = below < Math.min(height, 180) && above > below
      const maxHeight = Math.max(80, useAbove ? above : below)
      const next = { width: actualWidth, left: Math.max(inset, Math.min(bounds.left, window.innerWidth - actualWidth - inset)), top: useAbove ? Math.max(inset, bounds.top - gap - Math.min(height, maxHeight)) : bounds.bottom + gap, maxHeight }
      setPosition(current => current.width === next.width && current.left === next.left && current.top === next.top && current.maxHeight === next.maxHeight ? current : next)
    }
    function outside(event: PointerEvent) {
      const target = event.target as HTMLElement
      if (surface.contains(target) || anchorNode.contains(target) || target.closest("[data-table-query-menu]")) return
      if (interactionScope && target.closest("[data-table-query-trigger]")?.getAttribute("data-table-query-trigger") === interactionScope) return
      restore = false
      close()
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      event.preventDefault()
      close()
    }
    place()
    ;(surface.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ?? surface.querySelector<HTMLElement>("input:not(:disabled)") ?? surface.querySelector<HTMLElement>("button:not(:disabled)") ?? surface).focus({ preventScroll: true })
    const observer = new ResizeObserver(place)
    observer.observe(surface)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
      const focus = focusTarget ?? (previous?.isConnected ? previous : anchorNode.querySelector<HTMLElement>("button[aria-expanded]"))
      if (restore && focus?.isConnected && (surface.contains(document.activeElement) || document.activeElement === document.body)) focus.focus({ preventScroll: true })
    }
  }, [open, anchor, returnFocus, interactionScope, width])
  if (!open) return null
  return createPortal(<div ref={panel} id={id} role="dialog" aria-label={label} tabIndex={-1} className={`${styles.popover} ${className ?? ""}`} style={position}>{children}</div>, getOverlayRoot() ?? document.body)
}
