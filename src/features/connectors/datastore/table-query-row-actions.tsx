"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, DotsSixVertical, Eye, EyeSlash, Scan, X } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import styles from "./table-query.module.css"

export function QueryRuleActions({ label, disabled, enabled, onOnly, onToggle, onRemove }: {
  label: "筛选条件" | "排序"
  disabled: boolean
  enabled: boolean
  onOnly: () => void
  onToggle: () => void
  onRemove?: () => void
}) {
  const onlyLabel = label === "筛选条件" ? "仅筛选此项" : "仅排序此项"
  return <div className={styles.ruleActions}>
    <button type="button" className="fouc-action" disabled={disabled} aria-label={onlyLabel} title={onlyLabel} onClick={onOnly}><Scan size={18} weight="bold" /></button>
    <button type="button" className="fouc-action" disabled={disabled} aria-label={`${enabled ? "停用" : "启用"}${label}`} title={`${enabled ? "停用" : "启用"}${label}`} onClick={onToggle}>{enabled ? <Eye size={18} weight="bold" /> : <EyeSlash size={18} />}</button>
    <button type="button" className="fouc-action" data-variant="destructive" disabled={disabled} aria-label={`删除${label}`} title={`删除${label}`} onClick={onRemove}><X size={18} /></button>
  </div>
}

export function QueryRuleHandle({ id, kind, index, count, disabled, onMove, children }: {
  id: string
  kind: "filter" | "sort"
  index: number
  count: number
  disabled: boolean
  onMove: (target: number) => void
  children?: ReactNode
}) {
  const label = kind === "filter" ? "条件" : "排序"
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" className={`fouc-action ${styles.grip}`} draggable={!disabled} title="拖动调整顺序；点击更多选项" aria-label={`移动${label} ${index + 1}`} disabled={disabled} onDragStart={event => { event.dataTransfer.setData(`text/x-fouc-${kind}-id`, id); event.dataTransfer.effectAllowed = "move" }}><DotsSixVertical size={16} weight="bold" /></button></DropdownMenuTrigger>
    <DropdownMenuContent className={styles.popoverMenu} data-table-query-menu="" density="compact" align="start">
      <DropdownMenuItem disabled={disabled || index === 0} onSelect={() => onMove(index - 1)}><ArrowUp />上移{label}</DropdownMenuItem>
      <DropdownMenuItem disabled={disabled || index === count - 1} onSelect={() => onMove(index + 1)}><ArrowDown />下移{label}</DropdownMenuItem>
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
}
