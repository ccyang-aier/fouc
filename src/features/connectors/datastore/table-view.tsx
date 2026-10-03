"use client"

import { useMemo, useState } from 'react'
import type { DatabaseQueryResult, DatabaseTablePage, RelationalProvider, RelationalSession, RelationalSort } from '@fouc/shared'
import { Database, DownloadSimple, X } from '@phosphor-icons/react'
import { databaseCellText } from './cell-format'
import { ResultGrid, type ResultGridSelectionScope } from './grid/result-grid'
import { ResultExportDialog, type ResultExportDialogProps } from './result-export'
import { gridRowsWithDrafts, type GridEditDraft, type GridEditCell, type GridEditSelection } from './grid-editing'
import styles from './relational.module.css'

export function TableView({ page, provider, schema, onSelect, scopeKey, layoutScopeKey, search = '', sort = [], sortDisabled = false, filtered = false, onSort, drafts = [], onSelectionChange, onCellSelect }: {
  drafts?: readonly GridEditDraft[]; onSelectionChange?: (scope: GridEditSelection | null) => void; onCellSelect?: (cell: GridEditCell | null) => void;
  page: DatabaseTablePage; provider: RelationalProvider; schema: string; scopeKey: string; layoutScopeKey?: string; onSelect: (row: number | null) => void; search?: string;
  sort?: RelationalSort[]; sortDisabled?: boolean; filtered?: boolean; onSort?: (column: string, additive: boolean) => void
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
  return <><ResultGrid result={model.result} scopeKey={scopeKey} layoutScopeKey={layoutScopeKey} rowOffset={page.offset} rowNumbers={model.rowNumbers} primaryKeys={model.primaryKeys} displayRows={displayRows} editedCells={editedCells} onSelectionChange={scope => { setSelectionScope(scope); onSelectionChange?.(scope ? { ...scope, rows: scope.rows.map(row => model.indices[row]) } : null) }}
    showCellDetails={false} sort={sort} sortDisabled={sortDisabled} onSort={onSort}
    scopeLabel={search ? '当前页匹配 ' + model.indices.length + ' / 已加载 ' + page.rows.length + ' 行' : '当前页已加载 ' + page.rows.length + ' 行'}
    emptyLabel={page.rows.length ? '当前页没有匹配记录' : filtered ? '没有符合数据库筛选的记录' : '表中没有记录'}
    onCellSelect={(cell) => { onSelect(cell ? model.indices[cell.rowIndex] : null); onCellSelect?.(cell ? { rowIndex: model.indices[cell.rowIndex], columnIndex: cell.columnIndex } : null) }} toolbarActions={<button type="button" aria-label="导出当前页数据" disabled={!model.result.rows.length} onClick={() => setExportSnapshot({ result: model.result, provider, title: page.table, target: { schema, table: page.table }, selectedRows: selectionScope?.rectangular ? selectionScope.rows : undefined, selectedColumns: selectionScope?.rectangular ? selectionScope.columns : undefined })}><DownloadSimple size={13} />导出</button>} />
    {exportSnapshot && <ResultExportDialog {...exportSnapshot} onClose={() => setExportSnapshot(null)} />}</>
}

export function RowInspector({
  session,
  name,
  onClose,
  page,
  selectedRow
}: {
  session: RelationalSession
  name: string
  onClose: () => void
  page: DatabaseTablePage | null
  selectedRow: number | null
}) {
  const selected = selectedRow !== null ? page?.rows[selectedRow] : null
  return (
    <aside className={`mw-inspector ${styles.inspector}`} aria-label="行详情">
      <div className="mw-explorer-head">
        <strong>{selected ? "行详情" : "连接信息"}</strong>
        <button type="button" aria-label="关闭详情面板" className="mw-icon-button" onClick={onClose}><X size={16} /></button>
      </div>
      {selected ? (
        page?.columns.map((column, index) => (
          <div className={styles.detailField} key={column.name}>
            <small>{column.name}</small>
            <pre>{databaseCellText(selected[index] ?? null)}</pre>
          </div>
        ))
      ) : (
        <div className={styles.connectionDetails}>
          <span className={styles.connectionMark}><Database size={23} /></span>
          <strong>{name}</strong><small>{session.info.productName}</small>
          <dl>
            <div><dt>数据库</dt><dd title={session.database}>{session.provider === 'sqlite' ? session.database.replace(/^.*[\\/]/, '') : session.database}</dd></div>
            <div><dt>驱动</dt><dd>{session.info.driverName}</dd></div>
            <div><dt>版本</dt><dd>{session.info.productVersion}</dd></div>
          </dl>
        </div>
      )}
    </aside>
  )
}
