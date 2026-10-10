import type { DatabaseCell, DatabaseTablePage } from '@fouc/shared'
import { GRID_EDIT_LIMITS, type GridEditDraft, type GridEditSelection } from './model'
import { gridRowsWithDrafts, gridRowIdentifiable } from './operations'
import { gridGeneratedColumn, validateGridOriginalValue } from './values'

export function stageGridSelectedRows(page: DatabaseTablePage, drafts: readonly GridEditDraft[], scope: GridEditSelection, kind: 'clone' | 'delete', makeId = () => crypto.randomUUID()): GridEditDraft[] {
  if (!scope.rows.length || scope.rows.length > GRID_EDIT_LIMITS.rows || new Set(scope.rows).size !== scope.rows.length || scope.rows.some(row => !Number.isInteger(row) || row < 0 || row >= page.rows.length)) throw new Error('请选择当前页最多 50 个有效行')
  const projected = gridRowsWithDrafts(page, drafts)
  const added = scope.rows.map(row => {
    if (drafts.some(draft => draft.row === row && draft.change.kind === 'delete')) throw new Error('选区包含已暂存删除的行，请先撤销删除')
    page.rows[row].forEach(validateGridOriginalValue)
    if (kind === 'delete') {
      if (!gridRowIdentifiable(page, row)) throw new Error('删除需要完整主键或非空唯一键')
      return { id: makeId(), row, change: { kind: 'delete' as const, original: structuredClone(page.rows[row]) } }
    }
    const values: Record<string, DatabaseCell> = {}
    page.columns.forEach((column, index) => {
      if (column.isPrimaryKey || gridGeneratedColumn(column)) return
      const value = projected[row][index] ?? null
      validateGridOriginalValue(value)
      Object.defineProperty(values, column.name, { value: structuredClone(value), enumerable: true, configurable: true, writable: true })
    })
    return { id: makeId(), row: null, change: { kind: 'insert' as const, values } }
  })
  const next = [...drafts.filter(draft => kind === 'clone' || draft.row === null || !scope.rows.includes(draft.row)), ...added]
  if (next.length > GRID_EDIT_LIMITS.changes || JSON.stringify(next.map(draft => draft.change)).length > GRID_EDIT_LIMITS.characters) throw new Error('待提交变更超过 100 项或 1 MB，请缩小批次')
  return next
}
