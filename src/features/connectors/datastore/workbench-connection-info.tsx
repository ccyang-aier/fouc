"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info, X } from "@phosphor-icons/react"
import type { RelationalSession, RelationalTablePage } from "@fouc/shared"
import { getOverlayRoot } from "@/lib/overlay-root"
import { databaseCellText } from "./cell-format"
import styles from "./dbx-workbench.module.css"

export function WorkbenchConnectionInfo({ session, name, page, selectedRow }: {
  session: RelationalSession; name: string; page: RelationalTablePage | null; selectedRow: number | null
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null)
  const selected = selectedRow === null ? null : page?.rows[selectedRow]
  const place = useCallback(() => {
    const rect = trigger.current!.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 24)
    const top = rect.bottom + 6
    setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top, maxHeight: window.innerHeight - top - 12 })
  }, [])
  const open = position !== null
  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setPosition(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setPosition(null); trigger.current?.focus() }
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    window.addEventListener("resize", place)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
      window.removeEventListener("resize", place)
    }
  }, [open, place])
  return <>
    <button ref={trigger} type="button" className="fouc-action" aria-label="连接信息与行详情" title="连接信息与行详情" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => open ? setPosition(null) : place()}><Info size={17} /></button>
    {position && createPortal(<div ref={panel} id={id} role="dialog" aria-label="连接信息与行详情" className={styles.connectionPopover} style={position}>
      <header><strong>连接信息</strong><button ref={closeButton} type="button" className="fouc-action" aria-label="关闭连接信息" onClick={() => { setPosition(null); trigger.current?.focus() }}><X size={15} /></button></header>
      <dl>
        <div><dt>连接</dt><dd>{name}</dd></div>
        <div><dt>{session.provider === "sqlite" ? "数据库位置" : "数据库"}</dt><dd>{session.database}</dd></div>
        <div><dt>类型</dt><dd>{session.info.productName}</dd></div>
        <div><dt>驱动</dt><dd>{session.info.driverName}</dd></div>
        <div><dt>版本</dt><dd>{session.info.productVersion}</dd></div>
      </dl>
      {selected && page ? <section aria-label="所选行详情"><strong>{page.table} · 第 {page.offset + selectedRow! + 1} 行</strong>{page.columns.map((column, index) => <div className={styles.detailField} key={column.name}><small>{column.name}</small><pre>{databaseCellText(selected[index] ?? null)}</pre></div>)}</section> : null}
    </div>, getOverlayRoot() ?? document.body)}
  </>
}
