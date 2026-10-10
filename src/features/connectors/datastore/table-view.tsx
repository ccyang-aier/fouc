"use client"

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DatabaseQueryResult, DatabaseTablePage, RelationalProvider, RelationalSort } from '@fouc/shared'
import { DownloadSimple } from '@phosphor-icons/react'
import { databaseCellText } from './cell-format'
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid'
import { ResultExportDialog, type ResultExportDialogProps } from './result-export'
import { gridRowsWithDrafts, type GridEditDraft, type GridEditCell, type GridEditSelection } from './grid-editing'

export function TableView({ page, provider, schema, onSelect, scopeKey, layoutScopeKey, search = '', sort = [], sortDisabled = false, filtered = false, onSort, drafts = [], onSelectionChange, onCellSelect, headerTarget, toolsTarget, exportTarget }: {
  drafts?: readonly GridEditDraft[]; onSelectionChange?: (scope: GridEditSelection | null) => void; onCellSelect?: (cell: GridEditCell | null) => void;
  page: DatabaseTablePage; provider: RelationalProvider; schema: string; scopeKey: string; layoutScopeKey?: string; onSelect: (row: number | null) => void; search?: string;
  sort?: RelationalSort[]; sortDisabled?: boolean; filtered?: boolean; onSort?: (column: string, additive: boolean) => void
  headerTarget?: HTMLElement | null; toolsTarget?: HTMLElement | null; exportTarget?: HTMLElement | null
}) {
  const [exportSnapshot, setExportSnapshot] = useState<Omit<ResultExportDialogProps, 'onClose'> | null>(null), [selectionScope, setSelectionScope] = useState<ResultGridSelectionScope | null>(null)
  const model = useMemo(() => {
    const needle = search.toLocaleLowerCase()
    const rows = page.rows.map((row, index) => ({ row, index })).filter(({ row }) => !needle || row.some((cell) => databaseCellText(cell).toLocaleLowerCase().includes(needle)))
    const result: DatabaseQueryResult = { columns: page.columns.map((column) => column.name), columnTypes: page.columns.map((column) => column.dataType),
      rows: rows.map(({ row }) => row), columnSortables: page.columns.map(() => true), affectedRows: 0, executionTimeMs: 0,
      hasMore: page.hasMore, truncated: page.hasMore, sessionId: page.connectionId, messages: [] }
    return { result, indices: rows.map(({ index }) => index), rowNumbers: rows.map(({ index }) => page.offset + index + 1), primaryKeys: page.columns.filter((column) => column.isPrimaryKey).map((column) => column.name) }
  }, [page, search])
  const projected = useMemo(() => gridRowsWithDrafts(page, drafts), [page, drafts])
  const displayRows = useMemo(() => model.indices.map(index => projected[index]), [model.indices, projected])
  const editedCells = useMemo(() => new Set(model.indices.flatMap((rowIndex, displayIndex) => { const draft = drafts.find(value => value.row === rowIndex); return draft?.change.kind === 'update' ? Object.keys(draft.change.values).flatMap(name => { const column = page.columns.findIndex(value => value.name === name); return column >= 0 ? [`${displayIndex}:${column}`] : [] }) : [] })), [model.indices, drafts, page.columns])
  const exportAction = <button type="button" className="fouc-action" aria-label="导出当前页数据" disabled={!model.result.rows.length} onClick={() => setExportSnapshot({ result: model.result, provider, title: page.table, target: { schema, table: page.table }, selectedRows: selectionScope?.rectangular ? selectionScope.rows : undefined, selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined })}><DownloadSimple size={13} />导出</button>
  return <><ResultGrid result={model.result} scopeKey={scopeKey} layoutScopeKey={layoutScopeKey} rowOffset={page.offset} rowNumbers={model.rowNumbers} primaryKeys={model.primaryKeys} displayRows={displayRows} editedCells={editedCells} onSelectionChange={scope => { setSelectionScope(scope); onSelectionChange?.(scope ? { ...scope, rows: scope.rows.map(row => model.indices[row]) } : null) }}
    showCellDetails={false} sort={sort} sortDisabled={sortDisabled} onSort={onSort} headerTarget={headerTarget} toolsTarget={toolsTarget} uniqueKeys={page.columns.filter(column => column.isUnique).map(column => column.name)}
    scopeLabel={search ? '当前页匹配 ' + model.indices.length + ' / 已加载 ' + page.rows.length + ' 行' : '当前页已加载 ' + page.rows.length + ' 行'}
    emptyLabel={page.rows.length ? '当前页没有匹配记录' : filtered ? '没有符合数据库筛选的记录' : '表中没有记录'}
    onCellSelect={(cell) => { onSelect(cell ? model.indices[cell.rowIndex] : null); onCellSelect?.(cell ? { rowIndex: model.indices[cell.rowIndex], columnIndex: cell.columnIndex } : null) }} toolbarActions={exportTarget ? undefined : exportAction} />
    {exportTarget && createPortal(exportAction, exportTarget)}
    {exportSnapshot && <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />}</>
}
