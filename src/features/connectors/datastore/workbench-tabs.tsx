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
  return <WorkbenchMenu label="工作台视图" icon={<Wrench size={16} />} iconOnly disabled={disabled}>{views.map(({ mode, label, icon: Icon }) => <button key={mode} type="button" role="menuitem" className="fouc-menu-item" onClick={() => onChange(mode)}><Icon size={15} />{label}</button>)}</WorkbenchMenu>
}

export function WorkbenchTabs({ table, schema, mode, disabled, onChange, onCloseTable, onNewQuery }: {
  table: string; schema: string; mode: WorkbenchMode; disabled: boolean; onChange: (mode: WorkbenchMode) => void; onCloseTable: () => void; onNewQuery: () => void
}) {
  const dataActive = mode === "data" || mode === "structure"
  const view = views.find(item => item.mode === mode)
  return <div className={styles.tabs} aria-label="工作对象标签">
    {table ? <div className={styles.objectTab} data-active={dataActive}>
      <button type="button" disabled={disabled} aria-pressed={dataActive} onClick={() => onChange("data")}><GridFour size={15} className={styles.tableIcon} /><span>{table}@{schema}</span></button>
      <button type="button" disabled={disabled} aria-label={`关闭 ${table} 数据表`} onClick={onCloseTable}><X size={12} /></button>
    </div> : <button type="button" className={styles.emptyTab} disabled={disabled} onClick={() => onChange("data")}><GridFour size={15} />数据浏览</button>}
    {!dataActive && view ? <button type="button" className={styles.viewTab} data-active="true"><view.icon size={15} />{view.label}</button> : null}
    <span className={styles.tabSpace} />
    <button type="button" className="fouc-action" aria-label="新建 SQL 查询" disabled={disabled} onClick={onNewQuery}><Plus size={16} /></button>
  </div>
}
