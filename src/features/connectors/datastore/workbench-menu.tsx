"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { CaretDown } from "@phosphor-icons/react"
import styles from "./dbx-workbench.module.css"

/** Keep feature dialogs mounted when their action closes the tool menu. */
export function WorkbenchMenu({ label, icon, children, disabled = false, iconOnly = false, align = "end" }: { label: string; icon?: ReactNode; children: ReactNode; disabled?: boolean; iconOnly?: boolean; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  return <div ref={host} className={styles.menu}>
    <button ref={trigger} type="button" className="fouc-action" data-surface="subtle" disabled={disabled} aria-label={label} title={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>{icon}{!iconOnly && <><span>{label}</span><CaretDown size={11} aria-hidden /></>}</button>
    <div ref={panel} className={styles.menuPanel} data-open={open} data-align={align} role={open ? "menu" : undefined} aria-label={open ? label : undefined}
      onClickCapture={event => { const button = (event.target as Element).closest("button"); if (button && !button.closest("dialog") && panel.current?.contains(button)) setOpen(false) }}
      onKeyDown={event => {
        if (!open || (event.target as Element).closest("dialog")) return
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          const buttons = [...panel.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(button => !button.closest("dialog"))
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus()
        }
      }}>{children}</div>
  </div>
}
