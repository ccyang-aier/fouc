"use client"

import { BookOpenText, Database, FileCode, Graph, GridFour, Plus, Pulse, Wrench, X } from "@phosphor-icons/react"
import { WorkbenchMenu } from "./workbench-menu"
import styles from "./dbx-workbench.module.css"

export type WorkbenchMode = "data" | "structure" | "sql" | "objects" | "diagram" | "docs" | "activity"
const views = [
  { mode: "data", label: "数据浏览", icon: GridFour },
  { mode: "sql", label: "SQL 查询", icon: FileCode },
  { mode: "objects", label: "Schema 对象", icon: Database },
  { mode: "diagram", label: "关系图", icon: Graph },
  { mode: "docs", label: "数据库文档", icon: BookOpenText },
  { mode: "activity", label: "活动监控", icon: Pulse },
] as const

export function WorkbenchViewMenu({ disabled, onChange }: { disabled: boolean; onChange: (mode: WorkbenchMode) => void }) {
  return <WorkbenchMenu label="工作台视图" icon={<Wrench size={15} />} disabled={disabled}>{views.map(({ mode, label, icon: Icon }) => <button key={mode} type="button" role="menuitem" className="fouc-menu-item" onClick={() => onChange(mode)}><Icon size={15} />{label}</button>)}</WorkbenchMenu>
}

export function WorkbenchShortcuts({ mode, disabled, onChange }: { mode: WorkbenchMode; disabled: boolean; onChange: (mode: WorkbenchMode) => void }) {
  return <nav className={styles.shortcuts} aria-label="数据库工作台功能">{views.filter(view => view.mode !== "data" && view.mode !== "sql").map(({ mode: value, label, icon: Icon }) => <button key={value} type="button" className="fouc-action" disabled={disabled} aria-pressed={mode === value} onClick={() => onChange(value)}><Icon size={15} /><span>{label}</span></button>)}</nav>
}

export function WorkbenchTabs({ table, schema, mode, openedViews, disabled, onChange, onCloseTable, onCloseView, onNewQuery }: {
  table: string; schema: string; mode: WorkbenchMode; openedViews: WorkbenchMode[]; disabled: boolean; onChange: (mode: WorkbenchMode) => void; onCloseTable: () => void; onCloseView: (mode: WorkbenchMode) => void; onNewQuery: () => void
}) {
  const dataActive = mode === "data" || mode === "structure"
  return <div className={styles.tabs} aria-label="工作对象标签">
    <div className={styles.tabItems}>
    {table ? <div className={styles.objectTab} data-active={dataActive}>
      <button type="button" className="fouc-action" disabled={disabled} aria-pressed={dataActive} onClick={() => onChange("data")}><GridFour size={15} className={styles.tableIcon} /><span>{table}@{schema}</span></button>
      <button type="button" className="fouc-action" disabled={disabled} aria-label={`关闭 ${table} 数据表`} onClick={onCloseTable}><X size={12} /></button>
    </div> : <button type="button" className={styles.emptyTab} disabled={disabled} onClick={() => onChange("data")}><GridFour size={15} />数据浏览</button>}
    {openedViews.map(value => {
      const view = views.find(item => item.mode === value)
      return view ? <div key={value} className={styles.objectTab} data-active={mode === value}>
        <button type="button" className="fouc-action" disabled={disabled} aria-pressed={mode === value} onClick={() => onChange(value)}><view.icon size={15} /><span>{view.label}</span></button>
        <button type="button" className="fouc-action" disabled={disabled} aria-label={`关闭 ${view.label} 视图`} onClick={() => onCloseView(value)}><X size={12} /></button>
      </div> : null
    })}
    </div>
    <button type="button" className="fouc-action" aria-label="新建 SQL 查询" disabled={disabled} onClick={onNewQuery}><Plus size={16} /></button>
    <WorkbenchViewMenu disabled={disabled} onChange={onChange} />
  </div>
}
