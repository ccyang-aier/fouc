"use client"

import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, DotsSixVertical, Eye, EyeSlash, Scan, X } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { QueryRuleDragHandle } from "./use-query-rule-reorder"
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
  const toggleLabel = `${enabled ? "禁用" : "启用"}${label}`
  const removeLabel = `删除${label}`
  return <div className={styles.ruleActions}>
    <Tooltip>
      <TooltipTrigger asChild><button type="button" className="fouc-action" disabled={disabled} aria-label={onlyLabel} onClick={onOnly}><Scan size={16} weight="bold" /></button></TooltipTrigger>
      <TooltipContent className="z-[90]">{onlyLabel}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild><button type="button" className="fouc-action" disabled={disabled} aria-label={toggleLabel} aria-pressed={!enabled} onClick={onToggle}>{enabled ? <Eye size={16} weight="bold" /> : <EyeSlash size={16} weight="bold" />}</button></TooltipTrigger>
      <TooltipContent className="z-[90]">{toggleLabel}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild><button type="button" className="fouc-action" data-variant="destructive" disabled={disabled} aria-label={removeLabel} onClick={onRemove}><X size={16} weight="bold" /></button></TooltipTrigger>
      <TooltipContent className="z-[90]">{removeLabel}</TooltipContent>
    </Tooltip>
  </div>
}

export function QueryRuleHandle({ kind, index, count, disabled, onMove, drag, children }: {
  kind: "filter" | "sort"
  index: number
  count: number
  disabled: boolean
  onMove: (target: number) => void
  drag: QueryRuleDragHandle
  children?: ReactNode
}) {
  const label = kind === "filter" ? "条件" : "排序"
  const [open, setOpen] = useState(false)
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild><button {...drag} type="button" className={`fouc-action ${styles.grip}`} title="长按拖动调整顺序；点击更多选项；空格拾取，方向键移动，Enter 放下" aria-label={`移动${label} ${index + 1}`} disabled={disabled} onClick={() => setOpen(value => !value)}><DotsSixVertical size={16} weight="bold" /></button></DropdownMenuTrigger>
    <DropdownMenuContent className={styles.popoverMenu} data-table-query-menu="" density="compact" align="start">
      <DropdownMenuItem disabled={disabled || index === 0} onSelect={() => onMove(index - 1)}><ArrowUp />上移{label}</DropdownMenuItem>
      <DropdownMenuItem disabled={disabled || index === count - 1} onSelect={() => onMove(index + 1)}><ArrowDown />下移{label}</DropdownMenuItem>
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
}
