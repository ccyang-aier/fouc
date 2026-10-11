"use client"

import { useState } from 'react'
import { CaretRight, UploadSimple } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ResultExportFormat } from './result-export/model'
import styles from './data-tools-menu.module.css'
export type DataExportFormat = ResultExportFormat | 'xlsx'
export function DataExportMenu({ disabled, onExport }: { disabled: boolean; onExport: (format: DataExportFormat) => void }) {
  const [open, setOpen] = useState(false)
  return <DropdownMenu modal={false} open={open} onOpenChange={setOpen}><DropdownMenuTrigger className={styles.exportTrigger} data-menu-keep-open disabled={disabled} onClick={() => setOpen(true)} onPointerEnter={() => { if (!disabled) setOpen(true) }} onPointerDown={event => { if (open && event.button === 0) event.preventDefault() }} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setOpen(true) } }}><UploadSimple size={16} /><span>导出数据</span><CaretRight size={13} /></DropdownMenuTrigger><DropdownMenuContent data-workbench-menu side="right" align="start" sideOffset={4} className={styles.exportMenu} onInteractOutside={event => { if ((event.target as Element).closest('[data-menu-keep-open]')) event.preventDefault() }} density="compact" aria-label="导出数据格式">{[{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }, { value: 'sql', label: 'SQL INSERT' }, { value: 'xlsx', label: 'XLSX' }].map(item => <DropdownMenuItem key={item.value} onSelect={() => { onExport(item.value as DataExportFormat); setOpen(false) }}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
}
