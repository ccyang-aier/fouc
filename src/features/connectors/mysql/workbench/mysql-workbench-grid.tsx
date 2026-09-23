"use client"

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  ArrowDown, ArrowUp, ArrowsClockwise, CaretDown, CaretLeft, CaretRight,
  Check, ClipboardText, Copy, DotsThree, DownloadSimple, Funnel, MagnifyingGlass,
  PencilSimple, Plus, Selection, Table, Trash, X,
} from "@phosphor-icons/react"

import { getColumns, type CellSelection, type DataRow } from "./mysql-workbench-data"

type Props = {
  table: string
  rows: DataRow[]
  pendingCount: number
  selectedRowId: number | null
  onSelectRow: (id: number | null) => void
  onRowsChange: (rows: DataRow[]) => void
  onCommit: () => void
  onRollback: () => void
  onShowTableInfo: () => void
  onNotice: (message: string) => void
  appliedFilter: { field: string; value: string } | null
  onClearAppliedFilter: () => void
  onSelectionChange: (selection: CellSelection | null) => void
}

type MenuState = { x: number; y: number; rowId: number; column: string }
type CellPoint = { row: number; col: number }
type Range = { anchor: CellPoint; focus: CellPoint }
type Resize = { kind: "column" | "row"; key: string | number; start: number; initial: number }

export function MysqlWorkbenchGrid({ table, rows, pendingCount, selectedRowId, onSelectRow, onRowsChange, onCommit, onRollback, onShowTableInfo, onNotice, appliedFilter, onClearAppliedFilter, onSelectionChange }: Props) {
  const [fieldQuery, setFieldQuery] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState("name")
  const [filterValue, setFilterValue] = useState("")
  const [where, setWhere] = useState<{ field: string; value: string } | null>(null)
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [menu, setMenu] = useState<MenuState | null>(table === "customers" ? { x: 385, y: 159, rowId: 1003, column: "name" } : null)
  const [editing, setEditing] = useState<{ rowId: number; key: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [batchEdit, setBatchEdit] = useState(false)
  const [batchValue, setBatchValue] = useState("")
  const [canvasMode, setCanvasMode] = useState(false)
  const [toolMenu, setToolMenu] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [rowScope, setRowScope] = useState<"all" | "selected" | "normal">("all")
  const [range, setRange] = useState<Range | null>(table === "customers" ? { anchor: { row: 2, col: 1 }, focus: { row: 4, col: 4 } } : null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({})
  const dragging = useRef(false)
  const resizing = useRef<Resize | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const allColumns = getColumns(table)
  const columns = allColumns.filter((column) => column.label.toLowerCase().includes(fieldQuery.toLowerCase()))
  const totalGridWidth = 38 + columns.reduce((total, column) => total + (columnWidths[column.key] ?? column.width), 0)
  const gridColumns = `38px ${columns.map((column, index) => index === columns.length - 1 ? `minmax(${columnWidths[column.key] ?? column.width}px, 1fr)` : `${columnWidths[column.key] ?? column.width}px`).join(" ")}`

  const effectiveWhere = appliedFilter ?? where
  const filtered = useMemo(() => {
    let result = effectiveWhere ? rows.filter((row) => String(row[effectiveWhere.field] ?? "").toLowerCase().includes(effectiveWhere.value.toLowerCase())) : rows
    if (rowScope === "selected") result = result.filter((row) => Number(row.id) === selectedRowId)
    if (rowScope === "normal") result = result.filter((row) => row.status === "正常")
    if (sort) {
      result = result.toSorted((a, b) => {
        const left = a[sort.key]
        const right = b[sort.key]
        const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""), "zh-CN", { numeric: true })
        return sort.direction === "asc" ? comparison : -comparison
      })
    }
    return result
  }, [rows, sort, effectiveWhere, rowScope, selectedRowId])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const queryText = `SELECT * FROM \`orders\`.\`${table}\`${effectiveWhere ? ` WHERE \`${effectiveWhere.field}\` LIKE '%${effectiveWhere.value}%'` : ""}${sort ? ` ORDER BY \`${sort.key}\` ${sort.direction.toUpperCase()}` : ""} LIMIT ${pageSize}`
  const selectedRowIds = range ? visibleRows.slice(Math.min(range.anchor.row, range.focus.row), Math.max(range.anchor.row, range.focus.row) + 1).map((row) => Number(row.id)) : selectedRowId === null ? [] : [selectedRowId]
  const selectedColumns = range ? columns.slice(Math.min(range.anchor.col, range.focus.col), Math.max(range.anchor.col, range.focus.col) + 1) : []

  function clearRange() {
    setRange(null)
    onSelectionChange(null)
  }

  function selectRange(anchor: CellPoint, focus: CellPoint) {
    const next = { anchor, focus }
    setRange(next)
    const rowIds = visibleRows.slice(Math.min(anchor.row, focus.row), Math.max(anchor.row, focus.row) + 1).map((row) => Number(row.id))
    const columnKeys = columns.slice(Math.min(anchor.col, focus.col), Math.max(anchor.col, focus.col) + 1).map((column) => column.key)
    onSelectionChange({ rowIds, columnKeys })
    onSelectRow(rowIds[0] ?? null)
  }

  function startResize(event: ReactPointerEvent<HTMLElement>, kind: Resize["kind"], key: Resize["key"], initial: number) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizing.current = { kind, key, start: kind === "column" ? event.clientX : event.clientY, initial }
  }

  function moveResize(event: ReactPointerEvent<HTMLElement>) {
    const active = resizing.current
    if (!active) return
    const size = Math.max(active.kind === "column" ? 58 : 24, active.initial + (active.kind === "column" ? event.clientX : event.clientY) - active.start)
    if (active.kind === "column") setColumnWidths((current) => ({ ...current, [active.key]: size }))
    else setRowHeights((current) => ({ ...current, [active.key]: size }))
  }

  function updateCell(rowId: number, key: string, value: string) {
    onRowsChange(rows.map((row) => Number(row.id) === rowId ? { ...row, [key]: key === "id" || key === "customer_id" || key === "total_amount" ? Number(value) || 0 : value } : row))
    setEditing(null)
    onNotice("单元格已修改，点击「提交」保存更改")
  }

  function setSorting(key: string, direction: "asc" | "desc") {
    setSort({ key, direction })
    setPage(1)
    setMenu(null)
    clearRange()
  }

  function exportRows(format: "csv" | "json", exportedRows = filtered, exportColumns = allColumns) {
    const data = exportedRows.map((row) => Object.fromEntries(exportColumns.map((column) => [column.key, row[column.key]])))
    const content = format === "json" ? JSON.stringify(data, null, 2) : [exportColumns.map((column) => column.key).join(","), ...exportedRows.map((row) => exportColumns.map((column) => `"${String(row[column.key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n")
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${table}.${format}`
    link.click()
    URL.revokeObjectURL(url)
    setMenu(null)
    setToolMenu(false)
    onNotice(`已导出 ${exportedRows.length} 行 ${format.toUpperCase()} 数据`)
  }

  async function copyCell() {
    const row = rows.find((item) => Number(item.id) === menu?.rowId)
    if (!row || !menu) return
    const copyRange = selectedRowIds.includes(menu.rowId) && selectedColumns.length > 0
    const text = copyRange ? selectedRowIds.map((id) => { const item = rows.find((candidate) => Number(candidate.id) === id); return selectedColumns.map((column) => String(item?.[column.key] ?? "")).join("\t") }).join("\n") : String(row[menu.column] ?? "")
    await navigator.clipboard.writeText(text)
    setMenu(null)
    onNotice(copyRange ? "选中内容已复制" : "单元格内容已复制")
  }

  function addRow() {
    const id = Math.max(...rows.map((row) => Number(row.id))) + 1
    const created = Object.fromEntries(allColumns.map((column) => [column.key, column.key === "id" ? id : column.key === "created_at" ? "2026-09-23 14:30:00" : column.key === "status" ? "正常" : ""])) as DataRow
    onRowsChange([created, ...rows])
    onSelectRow(id)
    setPage(1)
    setMenu(null)
    onNotice("已新增草稿行，请填写字段后提交")
  }

  function deleteSelected() {
    if (!menu) return
    const ids = selectedRowIds.includes(menu.rowId) ? selectedRowIds : [menu.rowId]
    onRowsChange(rows.filter((row) => !ids.includes(Number(row.id))))
    onSelectRow(null)
    clearRange()
    setMenu(null)
    onNotice(`${ids.length} 行已标记删除，提交后保存`)
  }

  function applyBatchEdit() {
    if (!menu) return
    const ids = selectedRowIds.includes(menu.rowId) ? selectedRowIds : [menu.rowId]
    onRowsChange(rows.map((row) => ids.includes(Number(row.id)) ? { ...row, [menu.column]: batchValue } : row))
    setBatchEdit(false)
    setMenu(null)
    onNotice(`已修改 ${ids.length} 行，等待提交`)
  }

  return <div className="mw-grid-workspace">
    <div className="mw-table-heading">
      <div className="mw-table-identity"><Table size={17} className="mw-blue" /><strong>{table}</strong><span>生产订单库&nbsp; / &nbsp;orders&nbsp; / &nbsp;{table}</span></div>
      <div className="mw-table-heading-end"><span>{allColumns.length} 字段</span><span>{rows.length} 行</span><label className="mw-field-search"><MagnifyingGlass size={13} /><input aria-label="筛选字段" placeholder="筛选字段..." value={fieldQuery} onChange={(event) => { setFieldQuery(event.target.value); clearRange() }} /></label><button type="button" className="mw-tool-button" onClick={onShowTableInfo}><Table size={14} />表结构</button><button type="button" className="mw-tool-button" onClick={() => setToolMenu((open) => !open)}><ClipboardText size={14} />数据工具</button><button type="button" className="mw-icon-button mw-outline" aria-label="更多数据工具" onClick={() => setToolMenu((open) => !open)}><DotsThree size={16} /></button></div>
      {toolMenu && <div className="mw-tool-popover"><button type="button" onClick={() => exportRows("csv")}>导出 CSV</button><button type="button" onClick={() => exportRows("json")}>导出 JSON</button><button type="button" onClick={() => { void navigator.clipboard.writeText(queryText); setToolMenu(false); onNotice("查询 SQL 已复制") }}>复制查询 SQL</button></div>}
    </div>
    <div className="mw-grid-toolbar">
      <button type="button" className="mw-row-filter" aria-expanded={scopeOpen} onClick={() => setScopeOpen((open) => !open)}>{rowScope === "all" ? "全部行" : rowScope === "selected" ? "所选行" : "正常行"} <CaretDown size={12} /></button>
      {scopeOpen && <div className="mw-scope-menu" role="menu" aria-label="行范围">{([ ["all", "全部行"], ["selected", "仅所选行"], ["normal", "仅正常行"] ] as const).map(([scope, label]) => <button type="button" role="menuitemradio" aria-checked={rowScope === scope} key={scope} onClick={() => { if (scope === "selected" && selectedRowId === null) { onNotice("请先选中一行"); return } setRowScope(scope); if (scope === "all") { setWhere(null); onClearAppliedFilter() } setPage(1); setScopeOpen(false); clearRange(); setMenu(null) }}>{label}{rowScope === scope && <Check size={13} />}</button>)}</div>}
      <div className="mw-toolbar-segment mw-where"><button type="button" onClick={() => setFilterOpen((open) => !open)}><Funnel size={14} />{effectiveWhere ? `${effectiveWhere.field}: ${effectiveWhere.value}` : "WHERE"}</button></div>
      <div className="mw-toolbar-segment mw-order"><button type="button" onClick={() => setSorting(sort?.key ?? "id", sort?.direction === "asc" ? "desc" : "asc")}>ORDER BY {sort ? `${sort.key} ${sort.direction === "asc" ? "↑" : "↓"}` : ""}</button></div>
      <div className="mw-grid-actions"><button type="button" className="mw-plain-tool" onClick={() => { setPage(1); onNotice("数据已刷新") }}><ArrowsClockwise size={14} />刷新</button>
        <button type="button" className={`mw-plain-tool mw-canvas ${canvasMode ? "mw-canvas-on" : ""}`} aria-pressed={canvasMode} onClick={() => setCanvasMode((value) => !value)}><Selection size={14} />Canvas</button>
        <button type="button" className="mw-plain-tool" onClick={addRow}><Plus size={14} />新增行</button>
        <button type="button" className="mw-submit" onClick={onCommit}><ClipboardText size={14} />提交{pendingCount > 0 ? ` (${pendingCount})` : ""}</button>
        <button type="button" className="mw-plain-tool" onClick={onRollback} disabled={pendingCount === 0}><ArrowsClockwise size={14} />回滚</button></div>
      {filterOpen && <form className="mw-filter-popover" onSubmit={(event) => { event.preventDefault(); onClearAppliedFilter(); setWhere(filterValue ? { field: filterField, value: filterValue } : null); setPage(1); setFilterOpen(false); setMenu(null); clearRange() }}><strong>筛选数据</strong><select aria-label="筛选字段" value={filterField} onChange={(event) => setFilterField(event.target.value)}>{allColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select><input aria-label="筛选值" placeholder="包含..." value={filterValue} onChange={(event) => setFilterValue(event.target.value)} /><div><button type="button" onClick={() => { onClearAppliedFilter(); setWhere(null); setFilterValue(""); setFilterOpen(false); setMenu(null); clearRange() }}>清除</button><button type="submit">应用</button></div></form>}
    </div>
    {pendingCount > 0 && <div className="mw-pending-bar"><span>{pendingCount} 项待提交更改</span><button type="button" onClick={onRollback}>撤销全部</button></div>}
    <div className={`mw-sheet-body ${canvasMode ? "mw-sheet-canvas" : ""}`} ref={bodyRef} onPointerUp={() => { dragging.current = false }} onPointerLeave={() => { dragging.current = false }} onKeyDown={(event) => { if (event.key === "Escape") { setMenu(null); setFilterOpen(false); setBatchEdit(false); clearRange() } }}>
      <div className="mw-sheet-scroll" onClick={() => setMenu(null)}>
        <div role="grid" aria-label={`${table} 数据表`} className="mw-data-grid" style={{ width: `max(100%, ${totalGridWidth}px)` }}>
          <div role="row" className="mw-grid-header" style={{ gridTemplateColumns: gridColumns }}><div className="mw-row-number">#</div>{columns.map((column) => <button type="button" role="columnheader" key={column.key} className="mw-column-head" onClick={() => setSorting(column.key, sort?.key === column.key && sort.direction === "asc" ? "desc" : "asc")}><strong>{column.label}</strong><small>{column.type}</small>{sort?.key === column.key ? sort.direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : null}<span className="mw-column-resizer" role="separator" aria-label={`调整 ${column.label} 列宽`} aria-orientation="vertical" onClick={(event) => { event.preventDefault(); event.stopPropagation() }} onPointerDown={(event) => startResize(event, "column", column.key, columnWidths[column.key] ?? column.width)} onPointerMove={moveResize} onPointerUp={() => { resizing.current = null }} /></button>)}</div>
          {visibleRows.map((row, rowIndex) => <div role="row" className={`mw-grid-row ${selectedRowId === Number(row.id) ? "mw-row-active" : ""}`} key={row.id} style={{ gridTemplateColumns: gridColumns, height: rowHeights[Number(row.id)] ?? 29 }}><div role="rowheader" className="mw-row-number" onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); dragging.current = true; selectRange({ row: rowIndex, col: 0 }, { row: rowIndex, col: columns.length - 1 }) }} onPointerEnter={() => { if (dragging.current && range) selectRange(range.anchor, { row: rowIndex, col: columns.length - 1 }) }}>{(page - 1) * pageSize + rowIndex + 1}<span className="mw-row-resizer" role="separator" aria-label={`调整第 ${(page - 1) * pageSize + rowIndex + 1} 行高度`} aria-orientation="horizontal" onPointerDown={(event) => startResize(event, "row", Number(row.id), rowHeights[Number(row.id)] ?? 29)} onPointerMove={moveResize} onPointerUp={() => { resizing.current = null }} /></div>{columns.map((column, columnIndex) => {
            const inRange = !!range && rowIndex >= Math.min(range.anchor.row, range.focus.row) && rowIndex <= Math.max(range.anchor.row, range.focus.row) && columnIndex >= Math.min(range.anchor.col, range.focus.col) && columnIndex <= Math.max(range.anchor.col, range.focus.col)
            const activeEdit = editing?.rowId === Number(row.id) && editing.key === column.key
            return <div role="gridcell" key={column.key} tabIndex={0} aria-selected={inRange} className={`mw-grid-cell ${inRange ? "mw-range-cell" : ""}`} onPointerDown={(event) => { if (event.button !== 0 || event.target instanceof HTMLInputElement) return; event.preventDefault(); dragging.current = true; const point = { row: rowIndex, col: columnIndex }; selectRange(event.shiftKey && range ? range.anchor : point, point); setMenu(null) }} onPointerEnter={() => { if (dragging.current && range) selectRange(range.anchor, { row: rowIndex, col: columnIndex }) }} onDoubleClick={() => { setEditing({ rowId: Number(row.id), key: column.key }); setEditValue(String(row[column.key] ?? "")) }} onContextMenu={(event) => { event.preventDefault(); if (!inRange) selectRange({ row: rowIndex, col: columnIndex }, { row: rowIndex, col: columnIndex }); const bounds = bodyRef.current?.getBoundingClientRect(); setMenu({ x: Math.min(event.clientX - (bounds?.left ?? 0), (bounds?.width ?? 600) - 185), y: Math.min(event.clientY - (bounds?.top ?? 0), (bounds?.height ?? 500) - 322), rowId: Number(row.id), column: column.key }) }}>
              {activeEdit ? <input autoFocus aria-label={`编辑 ${column.label}`} value={editValue} onChange={(event) => setEditValue(event.target.value)} onBlur={(event) => { if (event.currentTarget.dataset.cancelled !== "true") updateCell(Number(row.id), column.key, editValue) }} onKeyDown={(event) => { if (event.key === "Enter") updateCell(Number(row.id), column.key, editValue); if (event.key === "Escape") { event.currentTarget.dataset.cancelled = "true"; setEditing(null) } }} /> : <span className={column.key === "status" && String(row[column.key]) === "正常" ? "mw-status-good" : ""}>{String(row[column.key] ?? "")}</span>}
            </div>
          })}</div>)}
        </div>
      </div>
      {menu && <div role="menu" aria-label="单元格操作" className="mw-context-menu" style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }} onClick={(event) => event.stopPropagation()}>
        <MenuAction icon={<ArrowUp size={15} />} label="升序排序" onClick={() => setSorting(menu.column, "asc")} />
        <MenuAction icon={<ArrowDown size={15} />} label="降序排序" onClick={() => setSorting(menu.column, "desc")} />
        <div className="mw-menu-separator" />
        <MenuAction icon={<Funnel size={15} />} label="按该列筛选" suffix={<CaretRight size={13} />} onClick={() => { setFilterField(menu.column); setFilterValue(String(rows.find((row) => Number(row.id) === menu.rowId)?.[menu.column] ?? "")); setFilterOpen(true); setMenu(null) }} />
        <div className="mw-menu-separator" />
        <MenuAction icon={<ClipboardText size={15} />} label="单元格详情" onClick={() => { onSelectRow(menu.rowId); onNotice(`${menu.column}：${String(rows.find((row) => Number(row.id) === menu.rowId)?.[menu.column] ?? "")}`); setMenu(null) }} />
        <MenuAction icon={<Table size={15} />} label="行详情" onClick={() => { onSelectRow(menu.rowId); setMenu(null) }} />
        <div className="mw-menu-separator" />
        <MenuAction icon={<Copy size={15} />} label="复制" suffix="⌘C" onClick={() => void copyCell()} />
        <MenuAction icon={<PencilSimple size={15} />} label="批量修改所选" onClick={() => { setBatchValue(""); setBatchEdit(true) }} />
        <MenuAction icon={<Trash size={15} />} label="删除选中行" danger onClick={deleteSelected} />
        <MenuAction icon={<DownloadSimple size={15} />} label="导出选中数据" onClick={() => { const ids = selectedRowIds.includes(menu.rowId) ? selectedRowIds : [menu.rowId]; exportRows("csv", rows.filter((row) => ids.includes(Number(row.id))), selectedColumns.length ? selectedColumns : allColumns) }} />
      </div>}
      {batchEdit && <form className="mw-batch-dialog" onSubmit={(event) => { event.preventDefault(); applyBatchEdit() }}><div><strong>批量修改 {menu?.column}</strong><button type="button" aria-label="关闭" onClick={() => setBatchEdit(false)}><X size={14} /></button></div><input autoFocus aria-label="新值" value={batchValue} onChange={(event) => setBatchValue(event.target.value)} placeholder="输入新值" /><button type="submit"><Check size={13} />应用到所选行</button></form>}
    </div>
    <div className="mw-grid-footer"><span className="mw-sql-preview" title={queryText}>{queryText}</span><span>共 {filtered.length} 行（查询耗时 86 ms）</span><div className="mw-pagination"><button type="button" aria-label="上一页" disabled={page === 1} onClick={() => { setPage(page - 1); clearRange() }}><CaretLeft size={14} /></button>{Array.from({ length: Math.min(5, totalPages) }, (_, index) => <button type="button" aria-label={`第 ${index + 1} 页`} aria-current={page === index + 1 ? "page" : undefined} className={page === index + 1 ? "mw-page-current" : ""} key={index} onClick={() => { setPage(index + 1); clearRange() }}>{index + 1}</button>)}{totalPages > 5 && <span>… {totalPages}</span>}<button type="button" aria-label="下一页" disabled={page >= totalPages} onClick={() => { setPage(page + 1); clearRange() }}><CaretRight size={14} /></button><select aria-label="每页行数" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); clearRange() }}><option value={20}>20 条/页</option><option value={50}>50 条/页</option><option value={100}>100 条/页</option><option value={1000}>1000 条/页</option></select></div></div>
  </div>
}

function MenuAction({ icon, label, suffix, danger, onClick }: { icon: React.ReactNode; label: string; suffix?: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return <button type="button" role="menuitem" className={`mw-menu-action ${danger ? "mw-danger" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{suffix && <small>{suffix}</small>}</button>
}
