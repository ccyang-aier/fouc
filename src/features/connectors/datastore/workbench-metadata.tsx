"use client"

import type { ReactNode } from "react"
import { Table, Wrench } from "@phosphor-icons/react"
import { WorkbenchMenu } from "./workbench-menu"
import styles from "./dbx-workbench.module.css"

export function WorkbenchMetadata({ table, schema, columnCount, structureAction, onProperties, pending, tools, onGridHeader, onGridTools }: {
  table: string; schema: string; columnCount: number; structureAction: ReactNode; onProperties: () => void; pending: boolean;
  tools: ReactNode; onGridHeader: (node: HTMLSpanElement | null) => void; onGridTools: (node: HTMLDivElement | null) => void
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
        <button type="button" className="fouc-action" title="表属性" disabled={pending || !table} onClick={onProperties}><Table size={16} />表属性</button>
        <WorkbenchMenu label="数据工具" icon={<Wrench size={16} />} disabled={pending}>{tools}<div ref={onGridTools} className={styles.gridToolsSlot} /></WorkbenchMenu>
      </div>
    </div>
  </div>
}
