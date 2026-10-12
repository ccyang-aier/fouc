"use client"

import type { ReactNode } from 'react'
import { IconContext, Play, PlayCircle, Stop } from '@phosphor-icons/react'
import type { SqlExecutionMode } from '@fouc/shared'
import { Button } from '@/components/ui/button'
import styles from './sql-query-toolbar.module.css'

export function SqlQueryToolbar({ running, cancelling, disabled, mode, onRun, onRunNewResult, onCancel, children, target, database, status }: {
  running: boolean; cancelling: boolean; disabled: boolean; mode: SqlExecutionMode;
  onRun: (mode: SqlExecutionMode) => void; onRunNewResult: () => void; onCancel: () => void;
  children: ReactNode; target: ReactNode; database: string; status: ReactNode;
}) {
  return <div className={styles.toolbar} aria-label="SQL 查询工具栏">
    <IconContext.Provider value={{ weight: 'bold', size: 18 }}><div className={styles.controls}>
      <Button variant="ghost" size="icon-sm" className={styles.run} data-running={running || undefined}
        aria-label={running ? '取消查询' : '运行'} title={running ? '中断数据库查询' : '运行 SQL · Ctrl / ⌘ + Enter · 选区优先'}
        loading={cancelling} disabled={disabled} onClick={() => running ? onCancel() : onRun(mode)}>
        {running ? <Stop weight="fill" /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon-sm" className={styles.runNew} aria-label="运行并保留旧结果" title="运行并保留旧结果" disabled={disabled || running} onClick={onRunNewResult}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 7L17 12L9 17Z" /></svg></Button>
      {children}
      <Button variant="ghost" size="icon-sm" className={styles.runAll} aria-label="运行全部语句" title="运行全部语句 · Ctrl / ⌘ + Shift + Enter" disabled={disabled || running} onClick={() => onRun('all')}><PlayCircle /></Button>
    </div></IconContext.Provider>
    <div className={styles.target}><span className={styles.database} title={database}>{database}</span>{target}<div className={styles.status}>{status}</div></div>
  </div>
}
