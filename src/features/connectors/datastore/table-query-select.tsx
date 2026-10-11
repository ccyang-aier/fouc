"use client"

import { CaretDown } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import styles from "./table-query.module.css"

/** Query forms use the same themed menu and selected-state feedback as the workbench. */
export function TableQuerySelect<Value extends string>({ label, value, placeholder, options, disabled, autoFocus, onChange }: {
  label: string
  value: Value
  placeholder?: string
  options: readonly { value: Value; label: string }[]
  disabled: boolean
  autoFocus?: boolean
  onChange: (value: Value) => void
}) {
  const selected = options.find(option => option.value === value)
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger className={styles.querySelect} aria-label={`${label}：${selected?.label ?? placeholder ?? ""}`} data-empty={!selected} data-autofocus={autoFocus || undefined} disabled={disabled}>
      <span>{selected?.label ?? placeholder}</span><CaretDown size={12} aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent className={`${styles.popoverMenu} ${styles.selectMenu}`} data-table-query-menu density="compact" sideOffset={4} align="start" aria-label={label}>
      <DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as Value)}>
        {options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}><span className={styles.selectOption} title={option.label}>{option.label}</span></DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}
