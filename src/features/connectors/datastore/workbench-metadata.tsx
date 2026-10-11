"use client"

import type { ReactNode } from "react"
import { Table, Toolbox } from "@phosphor-icons/react"
import { WorkbenchMenu } from "./workbench-menu"
import styles from "./dbx-workbench.module.css"
import menuStyles from './data-tools-menu.module.css'

export function WorkbenchMetadata({ table, schema, columnCount, structureAction, onProperties, propertiesOpen, pending, tools, generateAction, importAction, onGridHeader, onGridTools, onExportTools, onEditTools }: {
  table: string; schema: string; columnCount: number; structureAction: ReactNode; onProperties: () => void; pending: boolean;
  propertiesOpen: boolean; generateAction: ReactNode; importAction: ReactNode; tools: ReactNode; onGridHeader: (node: HTMLSpanElement | null) => void; onGridTools: (node: HTMLDivElement | null) => void; onExportTools: (node: HTMLDivElement | null) => void; onEditTools: (node: HTMLDivElement | null) => void
}) {
  return <div className={styles.metadata}>
    <div className={styles.objectIdentity} aria-label="当前数据表">
      <span className={styles.qualifiedName}>{table && <span title="当前 Schema">{schema}.</span>}<strong title={table}>{table || "选择数据表"}</strong></span>
      {table && <span className={styles.columnCount} title="数据表的全部字段数量">{columnCount} 字段</span>}
    </div>
    <div className={styles.metadataActions}>
      <span ref={onGridHeader} className={`${styles.gridHeaderSlot} ${styles.commandGroup}`} role="group" aria-label="表格显示" />
      <div className={styles.commandGroup} role="group" aria-label="表结构与工具">
        {structureAction}
        <button type="button" className="fouc-action" title="表属性" data-workbench-panel-trigger aria-expanded={propertiesOpen} disabled={pending || !table} onClick={onProperties}><Table size={16} />表属性</button>
        <WorkbenchMenu label="数据工具" icon={<Toolbox size={16} />} disabled={pending || !table}><h3 className={menuStyles.title}>数据工具</h3>{generateAction}{importAction}<div ref={onExportTools} className={menuStyles.exportSlot} /><details className={menuStyles.advanced}><summary>更多操作</summary><div>{tools}<div ref={onEditTools} /></div></details></WorkbenchMenu>
        <div ref={onGridTools} className={menuStyles.viewSlot} />
      </div>
    </div>
  </div>
}
