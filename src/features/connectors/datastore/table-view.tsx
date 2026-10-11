"use client"

import { useMemo, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { DatabaseCell, DatabaseQueryResult, DatabaseTablePage, RelationalFilter, RelationalFilterOperator, RelationalProvider, RelationalSort } from '@fouc/shared'
import { DownloadSimple } from '@phosphor-icons/react'
import { useAppAlert } from '@/components/app-alert-provider'
import { DataExportMenu } from './data-export-menu'
import { XlsxExportDialog } from './result-export/xlsx-dialog'
import { useGridLayout } from './grid/layout/use-layout'
import { displayedGridColumns, gridColumnKeys } from './grid/layout/model'
import { databaseCellText } from './cell-format'
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid'
import { ResultExportDialog, type ResultExportDialogProps } from './result-export'
import { gridRowsWithDrafts, type GridEditDraft, type GridEditCell, type GridEditSelection } from './grid-editing'
import { gridRowIdentifiable, validateGridEditScope } from './grid-editing/operations'
import { compareGridPageCells, type TableGridCommandHandle } from './grid/context-actions'
import { filterGridSourceRows, gridColumnValueOptions, hasDatabaseColumnFilter, type GridColumnFilters } from './grid/column-filter-model'

export function TableView({ page, provider, schema, onSelect, scopeKey, layoutScopeKey, search = '', sort = [], sortDisabled = false, filter = null, drafts = [], onSelectionChange, onCellSelect, headerTarget, toolsTarget, viewTarget, exportMenuTarget, exportTarget, writable, editingDisabled, commandRef, onDatabaseSort, onFilter, onValuesFilter, onClearSort, onColumnDetails, onRefresh }: {
  drafts?: readonly GridEditDraft[]; onSelectionChange?: (scope: GridEditSelection | null) => void; onCellSelect?: (cell: GridEditCell | null) => void;
  page: DatabaseTablePage; provider: RelationalProvider; schema: string; scopeKey: string; layoutScopeKey?: string; onSelect: (row: number | null) => void; search?: string;
  sort?: RelationalSort[]; sortDisabled?: boolean; filter?: RelationalFilter | null
  headerTarget?: HTMLElement | null; toolsTarget?: HTMLElement | null; viewTarget?: HTMLElement | null; exportMenuTarget?: HTMLElement | null; exportTarget?: HTMLElement | null
  writable: boolean; editingDisabled: boolean; commandRef: RefObject<TableGridCommandHandle | null>;
  onDatabaseSort: (column: string, direction: 'asc' | 'desc') => void;
  onFilter: (column: string, value: DatabaseCell, operator: RelationalFilterOperator) => void;
  onValuesFilter: (column: string, values: DatabaseCell[] | null) => void; onClearSort: (column: string) => void;
  onColumnDetails: (column: string) => void; onRefresh: () => void;
}) {
  const { notify } = useAppAlert(), { layout } = useGridLayout(layoutScopeKey, message => notify('warning', message))
  const [xlsxSnapshot, setXlsxSnapshot] = useState<{ result: DatabaseQueryResult; title: string; selectedRows?: readonly number[]; selectedColumns?: readonly number[] } | null>(null)
  const [exportSnapshot, setExportSnapshot] = useState<Omit<ResultExportDialogProps, 'onClose'> | null>(null), [selectionScope, setSelectionScope] = useState<ResultGridSelectionScope | null>(null)
  type LocalQuery = { scopeKey: string; sort: { column: number; direction: 'asc' | 'desc' } | null; filters: GridColumnFilters }
  const [localQuery, setLocalQuery] = useState<LocalQuery>({ scopeKey, sort: null, filters: {} })
  const local = useMemo(() => localQuery.scopeKey === scopeKey ? localQuery : { scopeKey, sort: null, filters: {} }, [localQuery, scopeKey])
  const pageSort = local.sort, localFilters = local.filters
  function setPageSort(value: LocalQuery['sort']) { setLocalQuery({ ...local, sort: value }) }
  function setLocalFilter(column: number, selected: readonly string[] | null) { const filters = { ...local.filters }; if (selected === null) delete filters[column]; else filters[column] = selected; setLocalQuery({ ...local, filters }) }
  const model = useMemo(() => {
    const needle = search.toLocaleLowerCase()
    const rows = filterGridSourceRows(page.rows, localFilters).map(index => ({ row: page.rows[index], index })).filter(({ row }) => layout.searchMode === 'highlight' || !needle || row.some((cell) => databaseCellText(cell).toLocaleLowerCase().includes(needle)))
    if (pageSort) rows.sort((a, b) => compareGridPageCells(a.row[pageSort.column] ?? null, b.row[pageSort.column] ?? null, page.columns[pageSort.column].dataType) * (pageSort.direction === 'asc' ? 1 : -1) || a.index - b.index)
    const result: DatabaseQueryResult = { columns: page.columns.map((column) => column.name), columnTypes: page.columns.map((column) => column.dataType),
      rows: rows.map(({ row }) => row), columnSortables: page.columns.map(() => true), affectedRows: 0, executionTimeMs: 0,
      hasMore: page.hasMore, truncated: page.hasMore, sessionId: page.connectionId, messages: [] }
    return { result, indices: rows.map(({ index }) => index), rowNumbers: rows.map(({ index }) => page.offset + index + 1), primaryKeys: page.columns.filter((column) => column.isPrimaryKey).map((column) => column.name) }
  }, [page, search, pageSort, localFilters, layout.searchMode])
  const projected = useMemo(() => gridRowsWithDrafts(page, drafts), [page, drafts])
  const displayRows = useMemo(() => model.indices.map(index => projected[index]), [model.indices, projected])
  const editedCells = useMemo(() => new Set(model.indices.flatMap((rowIndex, displayIndex) => { const draft = drafts.find(value => value.row === rowIndex); return draft?.change.kind === 'update' ? Object.keys(draft.change.values).flatMap(name => { const column = page.columns.findIndex(value => value.name === name); return column >= 0 ? [`${displayIndex}:${column}`] : [] }) : [] })), [model.indices, drafts, page.columns])
  function sourceScope(scope: ResultGridSelectionScope): GridEditSelection { return { ...scope, rows: scope.rows.map(row => model.indices[row]) } }
  const selected = selectionScope ? sourceScope(selectionScope) : null
  const rowScopeValid = !!selected?.rows.length && selected.rows.length <= 50 && !selected.rows.some(row => drafts.some(draft => draft.row === row && draft.change.kind === 'delete'))
  const editValid = validateGridEditScope(page, selected) === null
  const exportAction = <button type="button" className="fouc-action" aria-label="导出当前页数据" disabled={!model.result.rows.length} onClick={() => setExportSnapshot({ result: model.result, provider, title: page.table, target: { schema, table: page.table }, selectedRows: selectionScope?.rectangular ? selectionScope.rows : undefined, selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined })}><DownloadSimple size={13} />导出</button>
  return <><ResultGrid result={model.result} scopeKey={scopeKey} layoutScopeKey={layoutScopeKey} rowOffset={page.offset} rowNumbers={model.rowNumbers} primaryKeys={model.primaryKeys} displayRows={displayRows} editedCells={editedCells} onSelectionChange={scope => { setSelectionScope(scope); onSelectionChange?.(scope ? { ...scope, rows: scope.rows.map(row => model.indices[row]) } : null) }}
    showCellDetails={false} readOnly={!writable || editingDisabled} sort={sort} sortDisabled={sortDisabled} headerTarget={headerTarget} toolsTarget={toolsTarget} viewTarget={viewTarget} highlightSearch={layout.searchMode === 'highlight' ? search : ''} columnComments={page.columns.map(column => column.comment)} uniqueKeys={page.columns.filter(column => column.isUnique).map(column => column.name)}
    columnQueryActions={{ options: column => gridColumnValueOptions(page.rows, column), localSelected: column => localFilters[column] ?? null, localSort: pageSort, databaseFiltered: column => hasDatabaseColumnFilter(filter, column), onLocalFilter: setLocalFilter, onDatabaseFilter: onValuesFilter, onClearSort: column => { if (pageSort && page.columns[pageSort.column]?.name === column) setPageSort(null); if (sort.some(rule => rule.column === column)) onClearSort(column) } }}
    tableActions={{ writable: writable && !editingDisabled, canEdit: editValid, canNull: editValid && !!selected?.columns.every(column => page.columns[column].isNullable), canClone: rowScopeValid, canDelete: rowScopeValid && !!selected?.rows.every(row => gridRowIdentifiable(page, row)), queryDisabled: sortDisabled,
      onEdit: (command, scope) => commandRef.current?.execute(command, sourceScope(scope)), onDatabaseSort: (column, direction) => { setPageSort(null); onDatabaseSort(column, direction) }, onPageSort: (column, direction) => setPageSort({ column, direction }), onFilter, onColumnDetails, onRefresh,
      onExport: (format, scope) => setExportSnapshot({ result: model.result, provider, title: page.table, target: { schema, table: page.table }, selectedRows: scope.rows, selectedColumns: scope.columns, initialFormat: format }) }}
    scopeLabel={search && layout.searchMode === 'highlight' ? '当前页显示 ' + model.indices.length + ' / 已加载 ' + page.rows.length + ' 行 · 搜索高亮' : search || Object.keys(localFilters).length ? '当前页匹配 ' + model.indices.length + ' / 已加载 ' + page.rows.length + ' 行' : '当前页已加载 ' + page.rows.length + ' 行'}
    emptyLabel={page.rows.length ? '当前页没有匹配记录' : filter ? '没有符合数据库筛选的记录' : '表中没有记录'}
    onCellSelect={(cell) => { onSelect(cell ? model.indices[cell.rowIndex] : null); onCellSelect?.(cell ? { rowIndex: model.indices[cell.rowIndex], columnIndex: cell.columnIndex } : null) }} toolbarActions={exportTarget ? undefined : exportAction} />
    {exportTarget && createPortal(exportAction, exportTarget)}
    {exportMenuTarget && createPortal(<DataExportMenu disabled={!model.result.rows.length} onExport={format => { const snapshot = { result: model.result, title: page.table, selectedColumns: displayedGridColumns(model.result, gridColumnKeys(model.result.columns), layout) }; if (format === 'xlsx') setXlsxSnapshot(snapshot); else setExportSnapshot({ ...snapshot, provider, target: { schema, table: page.table }, initialFormat: format }) }} />, exportMenuTarget)}
    {xlsxSnapshot && <XlsxExportDialog {...xlsxSnapshot} onClose={() => setXlsxSnapshot(null)} />}
    {exportSnapshot && <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />}</>
}
