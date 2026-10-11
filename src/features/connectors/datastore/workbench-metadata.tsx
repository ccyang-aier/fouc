"use client"

import type { ReactNode } from "react"
import { Table } from "@phosphor-icons/react"
import { WorkbenchMenu } from "./workbench-menu"
import styles from "./dbx-workbench.module.css"

export function WorkbenchMetadata({ provider, table, schema, columnCount, structureAction, onProperties, pending, tools, onGridHeader, onGridTools }: {
  provider: string; table: string; schema: string; columnCount: number; structureAction: ReactNode; onProperties: () => void; pending: boolean;
  tools: ReactNode; onGridHeader: (node: HTMLSpanElement | null) => void; onGridTools: (node: HTMLDivElement | null) => void
}) {
  return <div className={styles.metadata}>
    <div className={styles.chips}><span title="数据库类型">{provider}</span><strong title={table}>{table || "选择数据表"}</strong><span title="当前 Schema">{schema}</span><span title="数据表的全部字段数量">{columnCount} 字段</span></div>
    <div className={styles.metadataActions}>
      {structureAction}
      <span ref={onGridHeader} className={styles.gridHeaderSlot} />
      <button type="button" className="fouc-action" data-surface="subtle" disabled={pending || !table} onClick={onProperties}><Table size={15} />表属性</button>
      <WorkbenchMenu label="数据工具" icon={<Table size={15} />} disabled={pending}>{tools}<div ref={onGridTools} className={styles.gridToolsSlot} /></WorkbenchMenu>
    </div>
  </div>
}
