"use client"

import { useId, useState } from "react"
import { ChevronDown, ChevronRight, Columns3, Eye, Grid2X2, KeyRound, Zap, Network, List } from "lucide-react"
import type { DatabaseObjectInfo, RelationalTableStructure } from "@fouc/shared"
import { Button } from "@/components/ui/button"
import type { StructureTab } from "./structure-metadata"
import { useSqlResource } from "./use-sql-resource"
import styles from "./resource-tree.module.css"

const sections = [
  { key: "columns", label: "字段", icon: List },
  { key: "indexes", label: "索引", icon: KeyRound },
  { key: "foreignKeys", label: "外键", icon: Network },
  { key: "triggers", label: "触发器", icon: Zap },
] as const
type Section = typeof sections[number]["key"]

type Props = {
  base: string; schema: string; entry: DatabaseObjectInfo; revision: number;
  selected: boolean; expanded: boolean; disabled: boolean;
  onToggle: () => void; onOpen: () => void;
  onStructure?: (table: string, section: StructureTab, record?: string) => void;
}

export function ResourceTreeObject({ base, schema, entry, revision, selected, expanded, disabled, onToggle, onOpen, onStructure }: Props) {
  const id = useId()
  const [requested, setRequested] = useState(expanded)
  const [openSections, setOpenSections] = useState<ReadonlySet<Section>>(new Set())
  const [retry, setRetry] = useState(0)
  // Keep a visited object's catalog loaded while its rows are collapsed.
  if (expanded && !requested) setRequested(true)
  const resource = useSqlResource<RelationalTableStructure>(requested && onStructure ? `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(entry.name)}/structure` : null, undefined, revision + retry)
  const structure = resource.error ? null : resource.data
  const ObjectIcon = entry.kind === "table" ? Grid2X2 : Eye
  function toggleSection(section: Section) {
    setOpenSections(current => { const next = new Set(current); if (next.has(section)) next.delete(section); else next.add(section); return next })
  }
  return <div data-resource-object={entry.name}>
    <div className={`${styles.row} ${styles.table} fouc-action`} data-selected={selected} data-active={selected}>
      <button type="button" className={`${styles.chevron} fouc-action`} data-variant="disclosure" aria-label={`${expanded ? "收起" : "展开"} ${entry.name} 对象`} disabled={disabled} aria-expanded={expanded} aria-controls={`${id}-structure`} onClick={onToggle}>{expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</button>
      <button type="button" className={`${styles.tableName} fouc-action`} data-variant="disclosure" disabled={disabled} onClick={onOpen}><ObjectIcon size={16} className={entry.kind === "table" ? styles.tableIcon : styles.viewIcon} /><span title={entry.name}>{entry.name}</span></button>
    </div>
    {expanded && onStructure ? <div id={`${id}-structure`} aria-label={`${entry.name} 结构目录`} aria-busy={resource.busy}>
      {resource.error ? <div className={styles.catalogError} role="status"><span title={resource.error}>读取结构失败</span><Button variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>重试</Button></div> : sections.map(section => {
        const open = openSections.has(section.key), records = structure?.[section.key]
        return <div key={section.key}>
          <div className={`${styles.row} ${styles.section} fouc-action`}>
            <button type="button" className={`${styles.chevron} fouc-action`} data-variant="disclosure" disabled={disabled} aria-label={`${open ? "收起" : "展开"} ${entry.name} ${section.label}`} aria-expanded={open} aria-controls={`${id}-${section.key}`} onClick={() => toggleSection(section.key)}>{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</button>
            <button type="button" className={`${styles.tableName} fouc-action`} data-variant="disclosure" disabled={disabled} aria-label={`查看 ${entry.name} ${section.label}结构`} onClick={() => onStructure(entry.name, section.key)}><section.icon size={16} className={styles[section.key]} /><span>{section.label}</span><small aria-label={`${section.label}数量`}>{records?.length ?? "—"}</small></button>
          </div>
          {open ? <div id={`${id}-${section.key}`} aria-label={`${entry.name} ${section.label}列表`}>
            {!structure ? <div className={styles.catalogLoading} role="status" aria-label={`正在读取${section.label}`}><i /><i /><i /></div> : records?.length === 0 ? <p className={styles.emptySection}>暂无{section.label}</p> : <CatalogRows structure={structure} section={section.key} disabled={disabled} onOpen={record => onStructure(entry.name, section.key, record)} />}
          </div> : null}
        </div>
      })}
    </div> : null}
  </div>
}

function CatalogRows({ structure, section, disabled, onOpen }: { structure: RelationalTableStructure; section: Section; disabled: boolean; onOpen: (record: string) => void }) {
  if (section === "columns") return structure.columns.map(column => {
    const nullable = column.isNullable ? "可空" : "非空", label = `${column.name} (${column.dataType}) · ${nullable}`
    const Icon = column.isPrimaryKey ? KeyRound : Columns3
    return <button key={column.name} type="button" disabled={disabled} className={`${styles.row} ${styles.catalogRow} fouc-action`} aria-label={`查看 ${structure.table} 字段 ${label}`} title={`${label}${column.isPrimaryKey ? " · 主键" : column.isUnique ? " · 唯一" : ""}${column.comment ? ` · ${column.comment}` : ""}`} onClick={() => onOpen(column.name)}>
      <Icon size={15} className={column.isPrimaryKey ? styles.indexes : styles.fieldIcon} />
      <span className={styles.fieldText}><strong>{column.name}</strong><small>({column.dataType})</small></span>
      <span className={styles.nullability} data-required={!column.isNullable}>{nullable}</span>
    </button>
  })
  const records = section === "indexes" ? structure.indexes.map(index => ({ name: index.name, detail: index.parts.filter(part => part.role === "key").map(part => part.column ?? part.expression ?? "表达式").join(", "), badge: index.primary ? "主键" : index.unique ? "唯一" : "" }))
    : section === "foreignKeys" ? structure.foreignKeys.map(key => ({ name: key.name, detail: `${key.columns.join(", ")} → ${key.referencedSchema}.${key.referencedTable} (${key.referencedColumns.join(", ")})`, badge: "" }))
    : structure.triggers.map(trigger => ({ name: trigger.name, detail: `${trigger.timing} ${trigger.events.join(" / ")}`, badge: "" }))
  const Icon = section === "indexes" ? KeyRound : section === "foreignKeys" ? Network : Zap
  return records.map(record => <button key={record.name} type="button" className={`${styles.row} ${styles.catalogRow} fouc-action`} disabled={disabled} aria-label={`查看 ${structure.table} ${sections.find(item => item.key === section)?.label} ${record.name}`} title={`${record.name}${record.detail ? ` · ${record.detail}` : ""}${record.badge ? ` · ${record.badge}` : ""}`} onClick={() => onOpen(record.name)}>
    <Icon size={15} className={styles[section]} /><span className={styles.catalogName}>{record.name}</span>{record.badge ? <small className={styles.catalogBadge}>{record.badge}</small> : null}
  </button>)
}
