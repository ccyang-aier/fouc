"use client"

import type { ReactNode } from 'react'
import { CaretDown, Check, Play, PlayCircle, Stop } from '@phosphor-icons/react'
import type { SqlExecutionMode } from '@fouc/shared'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import styles from './sql-query-toolbar.module.css'

export function SqlQueryToolbar({ running, cancelling, disabled, mode, onModeChange, onRun, onCancel, children, target, database, status }: {
  running: boolean; cancelling: boolean; disabled: boolean; mode: SqlExecutionMode;
  onModeChange: (mode: SqlExecutionMode) => void; onRun: (mode: SqlExecutionMode) => void; onCancel: () => void;
  children: ReactNode; target: ReactNode; database: string; status: ReactNode;
}) {
  return <div className={styles.toolbar} aria-label="SQL 查询工具栏">
    <div className={styles.controls}>
      <Button variant="ghost" size="icon-sm" className={styles.run} data-running={running || undefined}
        aria-label={running ? '取消查询' : '运行'} title={running ? '中断数据库查询' : '运行 SQL · Ctrl / ⌘ + Enter · 选区优先'}
        loading={cancelling} disabled={disabled} onClick={() => running ? onCancel() : onRun(mode)}>
        {running ? <Stop size={19} weight="fill" /> : <Play size={20} />}
      </Button>
      <DropdownMenu><DropdownMenuTrigger className={`fouc-action ${styles.scope}`} disabled={disabled || running} aria-label="SQL 执行范围" title={mode === 'current' ? '当前语句 · 选区优先' : '全部语句 · 选区优先'}><CaretDown size={12} /></DropdownMenuTrigger>
        <DropdownMenuContent align="start">{(['current', 'all'] as const).map(value => <DropdownMenuItem key={value} onSelect={() => onModeChange(value)}><Check size={14} style={{ visibility: mode === value ? 'visible' : 'hidden' }} />{value === 'current' ? '当前语句' : '全部语句'}</DropdownMenuItem>)}</DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="icon-sm" className={styles.runAll} aria-label="运行全部语句" title="运行全部语句 · Ctrl / ⌘ + Shift + Enter" disabled={disabled || running} onClick={() => onRun('all')}><PlayCircle size={20} /></Button>
      {children}
    </div>
    <div className={styles.target}><span className={styles.database} title={database}>{database}</span>{target}<div className={styles.status}>{status}</div></div>
  </div>
}
