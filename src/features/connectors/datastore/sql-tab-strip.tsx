"use client"
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, DotsThree, FileCode, PushPin, X } from '@phosphor-icons/react'
import type { SqlDraftSnapshot, SqlDraftTab } from '@fouc/shared'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { sqlTabDirty } from './sql-tabs'
import { navigateWorkbenchTabs } from './workbench-tab-navigation'
import styles from './sql-tabs.module.css'

export type SqlTabAction = 'pin' | 'rename' | 'duplicate' | 'close' | 'others' | 'left' | 'right' | 'all' | 'reopen'
const dragMime = 'application/x-fouc-sql-tab'
export function SqlTabStrip({ snapshot, scope, busyIds, canBack, canForward, canReopen, onSelect, onNavigate, onAction, onReorder, active, disabled, actionsTarget }: {
  snapshot: SqlDraftSnapshot; scope: string; busyIds: ReadonlySet<string>; canBack: boolean; canForward: boolean; canReopen: boolean;
  onSelect: (id: string) => void; onNavigate: (direction: -1 | 1) => void;
  onAction: (action: SqlTabAction, tab: SqlDraftTab | null) => void; onReorder: (id: string, beforeId: string) => void
  active: boolean; disabled: boolean; actionsTarget: HTMLElement | null
}) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reveal = () => list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const resize = new ResizeObserver(reveal)
    if (list.current) resize.observe(list.current)
    reveal(); return () => resize.disconnect()
  }, [snapshot.activeTabId, active])
  function menu(tab: SqlDraftTab | null) {
    return <DropdownMenu><DropdownMenuTrigger className={styles.menu} disabled={disabled} aria-label={tab ? `${tab.title} 标签操作` : 'SQL 标签操作'}><DotsThree size={16} /></DropdownMenuTrigger><DropdownMenuContent align="end">
      {tab && <><DropdownMenuItem onSelect={() => onAction('pin', tab)}>{tab.pinned ? '取消固定标签' : '固定标签'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('rename', tab)}>重命名标签</DropdownMenuItem><DropdownMenuItem onSelect={() => onAction('duplicate', tab)}>复制为新查询</DropdownMenuItem><DropdownMenuSeparator />
        <DropdownMenuItem disabled={busyIds.has(tab.id)} onSelect={() => onAction('close', tab)}>关闭此标签</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('others', tab)}>关闭其他未固定标签</DropdownMenuItem><DropdownMenuItem onSelect={() => onAction('left', tab)}>关闭左侧未固定标签</DropdownMenuItem><DropdownMenuItem onSelect={() => onAction('right', tab)}>关闭右侧未固定标签</DropdownMenuItem><DropdownMenuSeparator /></>}
      <DropdownMenuItem onSelect={() => onAction('all', tab)}>关闭所有未固定标签</DropdownMenuItem><DropdownMenuItem disabled={!canReopen} onSelect={() => onAction('reopen', tab)}>重新打开关闭的标签</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
  }
  return <>
    <div className={styles.list} ref={list} onKeyDown={event => { if (!disabled) navigateWorkbenchTabs(event) }}>
      {snapshot.tabs.map((tab) => <div key={tab.id} className={`${styles.tab} ${active && tab.id === snapshot.activeTabId ? styles.active : ''}`} draggable={!disabled} onDragStart={(event) => { event.dataTransfer.setData(dragMime, JSON.stringify({ scope, id: tab.id })); event.dataTransfer.effectAllowed = 'move' }}
        onDragOver={(event) => { if (!disabled && event.dataTransfer.types.includes(dragMime)) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); if (disabled) return; try { const data = JSON.parse(event.dataTransfer.getData(dragMime)); if (data.scope === scope && typeof data.id === 'string') onReorder(data.id, tab.id) } catch { /* Unrelated external drag. */ } }}>
        <button type="button" className="fouc-action" role="tab" disabled={disabled} aria-selected={active && tab.id === snapshot.activeTabId} aria-controls="fouc-sql-query-document" data-tab-id={tab.id} tabIndex={active && tab.id === snapshot.activeTabId ? 0 : -1} title={`${tab.title} · ${tab.database}${tab.schema ? ` / ${tab.schema}` : ''}`} onClick={() => onSelect(tab.id)}>
          {tab.pinned ? <PushPin size={12} /> : <FileCode size={13} />}<span>{tab.title}</span>{busyIds.has(tab.id) ? <i className={styles.running} aria-label="查询执行中" /> : sqlTabDirty(tab) ? <i className={styles.dirty} aria-label="查询已修改" /> : null}
        </button>{menu(tab)}{!tab.pinned && <button type="button" className="fouc-action" aria-label={`关闭 ${tab.title}`} disabled={disabled || busyIds.has(tab.id)} onClick={() => onAction('close', tab)}><X size={12} /></button>}
      </div>)}
    </div>{actionsTarget && createPortal(<><div className={styles.navigation}>{(canBack || canForward) && <><button type="button" className="fouc-action" aria-label="上一个查询标签" disabled={disabled || !canBack} onClick={() => onNavigate(-1)}><ArrowLeft size={14} /></button><button type="button" className="fouc-action" aria-label="下一个查询标签" disabled={disabled || !canForward} onClick={() => onNavigate(1)}><ArrowRight size={14} /></button></>}</div>{menu(null)}</>, actionsTarget)}
  </>
}
