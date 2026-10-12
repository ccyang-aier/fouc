"use client"

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { RefreshCw, ChevronsUp, ChevronDown, ChevronRight, Database, Layers3, Eye, FolderCode, Grid2X2, Search, PanelLeftClose } from "lucide-react"
import type { DatabaseObjectInfo } from "@fouc/shared"
import type { StructureTab } from "./structure-metadata"
import { ResourceTreeControls, type ResourceKind, type ResourceSort } from "./resource-tree-controls"
import { ResourceTreeObject } from "./resource-tree-object"
import { ResourceTreeResize } from "./resource-tree-resize"
import styles from "./resource-tree.module.css"

type Props = {
  name: string; schemas: string[]; schema: string; tables: DatabaseObjectInfo[]; table: string; search: string; disabled?: boolean;
  base: string; revision: number;
  transferActions?: ReactNode;
  viewActions?: ReactNode;
  hidden: boolean; onHide: () => void;
  width?: number; onWidthChange?: (width: number | undefined) => void;
  onSearch: (value: string) => void; onSchema: (value: string) => void; onTable: (value: string) => void; onRefresh: () => void;
  onStructure?: (table: string, section: StructureTab, record?: string) => void; onQuery?: () => void
}

export function ResourceTree({ name, schemas, schema, tables, table, base, revision, search, onSearch, onSchema, onTable, onRefresh, disabled = false, transferActions, viewActions, hidden, onHide, width, onWidthChange, onStructure, onQuery }: Props) {
  const id = useId(), pane = useRef<HTMLElement>(null)
  const [sort, setSort] = useState<ResourceSort>("catalog")
  const [kinds, setKinds] = useState<ReadonlySet<ResourceKind>>(new Set(["table", "view"]))
  const visible = tables.filter(item => kinds.has(item.kind === "table" ? "table" : "view") && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  if (sort !== "catalog") visible.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }) * (sort === "asc" ? 1 : -1))
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [objects, setObjects] = useState(() => ({ selected: table, expanded: new Set(table ? [table] : []) }))
  // Opening a workbench tab also reveals its object, without collapsing its neighbours.
  if (objects.selected !== table) setObjects(current => ({ selected: table, expanded: new Set([...current.expanded, ...(table ? [table] : [])]) }))
  const [locateRequest, setLocateRequest] = useState(0)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (locateRequest) scroll.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [locateRequest])
  const groups = [
    { id: "tables", label: "表", items: visible.filter(item => item.kind === "table"), icon: Grid2X2 },
    { id: "views", label: "视图", items: visible.filter(item => item.kind !== "table"), icon: Eye },
  ]
  function toggle(key: string) { setCollapsed(value => { const next = new Set(value); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  function revealObject(value: string) { setObjects(current => ({ ...current, expanded: new Set([...current.expanded, value]) })) }
  function toggleObject(value: string) { setObjects(current => { const expanded = new Set(current.expanded); if (expanded.has(value)) expanded.delete(value); else expanded.add(value); return { ...current, expanded } }) }
  function locate() {
    const kind = tables.find(item => item.name === table)?.kind === "table" ? "table" : "view"
    onSearch("")
    setKinds(current => new Set([...current, kind]))
    setCollapsed(current => { const next = new Set(current); ["connection", `schema:${schema}`, kind === "table" ? "tables" : "views"].forEach(key => next.delete(key)); return next })
    revealObject(table)
    setLocateRequest(value => value + 1)
  }
  return <aside id={id} ref={pane} className={`${styles.tree} sidebar-material`} data-surface="database" data-hidden={hidden} style={width === undefined ? undefined : { '--resource-tree-width': `${width}px` } as CSSProperties} aria-label="数据库资源">
    <div className={styles.toolbar}>{transferActions ?? <strong>数据库资源</strong>}<div className={styles.toolbarActions}>
      <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="刷新数据库资源" title="刷新数据库资源" disabled={disabled} onClick={onRefresh}><RefreshCw size={14} /></button>
      <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="全部折叠数据库资源" title="全部折叠" disabled={disabled} onClick={() => { setCollapsed(new Set(["connection", "tables", "views", ...schemas.map(item => `schema:${item}`)])); setObjects(current => ({ ...current, expanded: new Set() })) }}><ChevronsUp size={14} /></button>
      <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="收纳数据库资源" title="收纳侧栏" onClick={onHide}><PanelLeftClose size={15} /></button>
    </div></div>
    <div className={styles.searchRow}>
      <label className={styles.search}><Search size={14} /><input aria-label="搜索表" value={search} onChange={event => {
        onSearch(event.target.value)
        if (event.target.value) setCollapsed(current => { const next = new Set(current); ["connection", `schema:${schema}`, "tables", "views"].forEach(key => next.delete(key)); return next })
      }} placeholder="搜索表或视图" /></label>
      <ResourceTreeControls disabled={disabled} canLocate={Boolean(table)} sort={sort} kinds={kinds} onSort={setSort} onLocate={locate} onKind={(kind, visible) => setKinds(current => { const next = new Set(current); if (visible) next.add(kind); else next.delete(kind); return next })} />
    </div>
    <div className={styles.scroll} ref={scroll}>
      <div className="fouc-action"><button type="button" className={`${styles.row} ${styles.connection} fouc-action`} data-variant="disclosure" aria-label={`${collapsed.has("connection") ? "展开" : "收起"}连接资源`} aria-expanded={!collapsed.has("connection")} onClick={() => toggle("connection")}>{collapsed.has("connection") ? <ChevronRight size={10} /> : <ChevronDown size={10} />}<Database size={15} /><strong title={name}>{name}</strong><i className={styles.online} aria-label="已连接" /></button></div>
      {!collapsed.has("connection") && <>
      {schemas.map(item => <div key={item}>
        <div className="fouc-action"><button className={`${styles.row} ${styles.schema} fouc-action`} data-variant="disclosure" type="button" aria-expanded={schema === item && !collapsed.has(`schema:${item}`)} disabled={disabled} onClick={() => { if (schema === item) toggle(`schema:${item}`); else { setCollapsed(current => { const next = new Set(current); next.delete(`schema:${item}`); return next }); onSchema(item) } }}>{schema === item && !collapsed.has(`schema:${item}`) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}<Layers3 size={15} /><span title={item}>{item}</span><i className={styles.online} /></button></div>
        {schema === item && !collapsed.has(`schema:${item}`) && groups.filter(group => group.items.length).map(group => <div key={group.id}>
          <div className="fouc-action"><button type="button" className={`${styles.row} ${styles.group} fouc-action`} data-variant="disclosure" aria-expanded={!collapsed.has(group.id)} onClick={() => toggle(group.id)}>{collapsed.has(group.id) ? <ChevronRight size={10} /> : <ChevronDown size={10} />}<group.icon size={15} className={group.id === "tables" ? styles.tableIcon : styles.viewIcon} /><span>{group.label}</span><small>{group.items.length}</small></button></div>
          {!collapsed.has(group.id) && group.items.map(entry => <ResourceTreeObject
            key={`${base}:${schema}:${entry.name}`} base={base} schema={schema} entry={entry} revision={revision}
            selected={table === entry.name} expanded={objects.expanded.has(entry.name)} disabled={disabled}
            onToggle={() => toggleObject(entry.name)} onOpen={() => { revealObject(entry.name); onTable(entry.name) }}
            onStructure={onStructure}
          />)}
        </div>)}
        {schema === item && !collapsed.has(`schema:${item}`) && !visible.length ? <p className={styles.empty}>{search || kinds.size !== 2 ? "没有匹配的表或视图" : "当前 Schema 没有可见对象"}</p> : null}
      </div>)}
      {onQuery ? <button type="button" className={`${styles.row} ${styles.query} fouc-action`} disabled={disabled} onClick={onQuery}><FolderCode size={15} /><span>查询</span></button> : null}
      </>}
    </div>
    {viewActions}
    <footer className={styles.footer}><span>{schemas.length} 个 Schema</span><span>{tables.length} 个对象</span></footer>
    {!hidden && onWidthChange ? <ResourceTreeResize paneRef={pane} controls={id} onChange={onWidthChange} /> : null}
  </aside>
}
