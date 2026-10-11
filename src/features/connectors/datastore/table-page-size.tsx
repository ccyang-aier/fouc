"use client"

import { useId, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { RELATIONAL_PAGE_LIMITS } from '@fouc/shared'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { tablePageSize, TABLE_PAGE_SIZE_OPTIONS } from './table-pagination-model'
import styles from './table-pagination.module.css'

export function TablePageSize({ size, defaultSize, disabled, onChange, onDefault }: { size: number; defaultSize: number; disabled: boolean; onChange: (size: number) => void; onDefault: (size: number) => void }) {
  const id = useId()
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(String(size)), [error, setError] = useState('')
  const value = tablePageSize(draft)
  function apply(persist = false) {
    if (disabled) return
    if (value === null) { setError(`请输入 1–${RELATIONAL_PAGE_LIMITS.rows} 的整数`); return }
    if (persist) onDefault(value); else onChange(value)
    setOpen(false)
  }
  return <DropdownMenu modal={false} open={open} onOpenChange={next => { if (disabled && next) return; setOpen(next); if (next) { setDraft(String(size)); setError('') } }}>
    <DropdownMenuTrigger asChild><button type="button" className={`${styles.sizeTrigger} fouc-action`} disabled={disabled} aria-label="每页行数" title="每页行数">{size} 行/页<CaretDown size={10} /></button></DropdownMenuTrigger>
    <DropdownMenuContent className={styles.sizeMenu} side="top" align="end" sideOffset={5} collisionPadding={8} density="compact" aria-label="每页行数选项">
      {TABLE_PAGE_SIZE_OPTIONS.map(option => <DropdownMenuItem key={option} disabled={disabled} onSelect={() => onChange(option)}>{option} 行/页</DropdownMenuItem>)}
      <DropdownMenuSeparator />
      <div className={styles.customSize} onKeyDown={event => event.stopPropagation()}>
        <label htmlFor={id}>自定义行数</label><small>当前：{size} · 默认：{defaultSize}</small>
        <div><input id={id} aria-label="自定义每页行数" inputMode="numeric" value={draft} disabled={disabled} aria-invalid={Boolean(error)} onChange={event => { setDraft(event.target.value); setError('') }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); apply() } }} /><button type="button" className="fouc-action" aria-label="应用每页行数" title="应用每页行数" disabled={disabled || (value !== null && value === size)} onClick={() => apply()}><Check size={14} /></button></div>
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <div className={styles.sizeActions}><button type="button" className="fouc-action" disabled={disabled || (value !== null && value === size)} onClick={() => apply()}>仅本次</button><button type="button" className={styles.defaultButton} disabled={disabled} onClick={() => apply(true)}>设为默认</button></div>
    </DropdownMenuContent>
  </DropdownMenu>
}
