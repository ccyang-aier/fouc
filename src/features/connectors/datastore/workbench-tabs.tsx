"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { BookOpenText, Database, FileCode, Network, Grid2X2, Plus, Activity, PanelsTopLeft, X } from "lucide-react"
import { WorkbenchMenu } from "./workbench-menu"
import { navigateWorkbenchTabs } from './workbench-tab-navigation'
import styles from "./dbx-workbench.module.css"

export type WorkbenchMode = "data" | "structure" | "sql" | "objects" | "diagram" | "docs" | "activity"
const views = [
  { mode: "data", label: "数据浏览", icon: Grid2X2 },
  { mode: "sql", label: "SQL 查询", icon: FileCode },
  { mode: "objects", label: "Schema 对象", icon: Database },
  { mode: "diagram", label: "关系图", icon: Network },
  { mode: "docs", label: "数据库文档", icon: BookOpenText },
  { mode: "activity", label: "活动监控", icon: Activity },
] as const

export function WorkbenchViewMenu({ disabled, onChange }: { disabled: boolean; onChange: (mode: WorkbenchMode) => void }) {
  return <WorkbenchMenu label="工作台视图" icon={<PanelsTopLeft size={16} />} disabled={disabled}>{views.map(({ mode, label, icon: Icon }) => <button key={mode} type="button" role="menuitem" className="fouc-menu-item" onClick={() => onChange(mode)}><Icon size={15} />{label}</button>)}</WorkbenchMenu>
}

export function WorkbenchShortcuts({ mode, disabled, onChange }: { mode: WorkbenchMode; disabled: boolean; onChange: (mode: WorkbenchMode) => void }) {
  return <nav className={styles.shortcuts} aria-label="数据库工作台功能">{views.filter(view => view.mode !== "data" && view.mode !== "sql").map(({ mode: value, label, icon: Icon }) => <button key={value} type="button" className="fouc-action" disabled={disabled} aria-pressed={mode === value} onClick={() => onChange(value)}><Icon size={15} /><span>{label}</span></button>)}</nav>
}

function WorkbenchTab({ label, icon, selected, disabled, closeLabel, onSelect, onClose }: {
  label: string; icon: ReactNode; selected: boolean; disabled: boolean; closeLabel?: string; onSelect: () => void; onClose?: () => void
}) {
  return <div role="tab" aria-label={label} aria-selected={selected} aria-disabled={disabled} tabIndex={selected && !disabled ? 0 : -1} className={`${styles.objectTab} fouc-action`}
    onClick={() => { if (!disabled) onSelect() }} onKeyDown={event => { if (event.target === event.currentTarget && !disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect() } }}>
    {icon}<span title={label}>{label}</span>
    {onClose && <button type="button" className={`${styles.tabClose} fouc-action`} data-variant="nested" disabled={disabled} aria-label={closeLabel} onClick={event => { event.stopPropagation(); onClose() }}><X size={12} /></button>}
  </div>
}

export function WorkbenchTabs({ table, schema, mode, openedViews, disabled, sqlReady, onChange, onCloseTable, onCloseView, onNewQuery, onSqlTabsTarget }: {
  table: string; schema: string; mode: WorkbenchMode; openedViews: WorkbenchMode[]; disabled: boolean; sqlReady: boolean; onChange: (mode: WorkbenchMode) => void; onCloseTable: () => void; onCloseView: (mode: WorkbenchMode) => void; onNewQuery: () => void
  onSqlTabsTarget: (target: HTMLDivElement | null) => void;
}) {
  const dataActive = mode === "data" || mode === "structure"
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reveal = () => list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
    const observer = new ResizeObserver(reveal)
    if (list.current) observer.observe(list.current)
    reveal()
    return () => observer.disconnect()
  }, [mode, table])
  return <div className={styles.tabs} aria-label="工作对象标签">
    <div ref={list} className={styles.tabItems} role="tablist" aria-label="工作台页面" onKeyDown={event => { if (!disabled) navigateWorkbenchTabs(event) }}>
      <WorkbenchTab label={table ? `${table}@${schema}` : "数据浏览"} icon={<Grid2X2 size={15} className={styles.tableIcon} />} selected={dataActive} disabled={disabled} onSelect={() => onChange("data")} closeLabel={`关闭 ${table} 数据表`} onClose={table ? onCloseTable : undefined} />
      <div ref={onSqlTabsTarget} className={styles.sqlTabsSlot} />
      {openedViews.filter(value => value !== 'sql').map(value => {
        const view = views.find(item => item.mode === value)
        return view ? <WorkbenchTab key={value} label={view.label} icon={<view.icon size={15} />} selected={mode === value} disabled={disabled} onSelect={() => onChange(value)} closeLabel={`关闭 ${view.label} 视图`} onClose={() => onCloseView(value)} /> : null
      })}
    </div>
    <div className={`${styles.tabActions} ${styles.commandGroup}`} role="group" aria-label="工作台视图操作">
      <button type="button" className="fouc-action" aria-label="新建 SQL 查询" title={sqlReady ? '新建 SQL 查询' : 'SQL 草稿加载后可新建查询'} disabled={disabled || !sqlReady} onClick={onNewQuery}><Plus size={16} /></button>
      <WorkbenchViewMenu disabled={disabled} onChange={onChange} />
    </div>
  </div>
}
