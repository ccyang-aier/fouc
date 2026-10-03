import type { DatabaseTablePage, RelationalProvider } from '@fouc/shared'
import { GRID_EDIT_LIMITS, type GridCellEdit, type GridEditDraft, type GridEditSelection, type GridEditValue } from './model'
import { coerceGridEditValue, gridGeneratedColumn, sameGridEditValue, validateGridOriginalValue } from './values'

export function gridRowIdentifiable(page: DatabaseTablePage, rowIndex: number): boolean {
  const row = page.rows[rowIndex]
  if (!row || row.length !== page.columns.length) return false
  const primary = page.columns.flatMap((column, index) => column.isPrimaryKey ? [index] : [])
  return primary.length ? primary.every((index) => row[index] !== null && row[index] !== undefined) : page.columns.some((column, index) => column.isUnique && row[index] !== null && row[index] !== undefined)
}
export function validateGridEditScope(page: DatabaseTablePage, scope: GridEditSelection | null): string | null {
  if (!scope?.rows.length || !scope.columns.length) return '请选择要编辑的单元格或矩形选区'
  if (!scope.rectangular) return '离散单元格不能作为填充或粘贴矩阵，请选择完整矩形'
  if (scope.rows.length > GRID_EDIT_LIMITS.rows || scope.rows.length * scope.columns.length > GRID_EDIT_LIMITS.cells) return '每次操作最多 50 行、100 个单元格，请缩小选区'
  if (new Set(scope.rows).size !== scope.rows.length || new Set(scope.columns).size !== scope.columns.length) return '选区索引重复，请重新选择'
  if (scope.rows.some((index) => !Number.isInteger(index) || index < 0 || index >= page.rows.length) || scope.columns.some((index) => !Number.isInteger(index) || index < 0 || index >= page.columns.length)) return '选区已超出当前已加载页，请重新选择'
  if (scope.rows.some((index) => !gridRowIdentifiable(page, index))) return '修改需要完整主键或非空单列唯一键；当前选区包含不可定位的行'
  if (scope.columns.some((index) => gridGeneratedColumn(page.columns[index]))) return '选区包含数据库生成或 Identity 字段，请取消选择这些列'
  return null
}
export function fillGridSelection(scope: GridEditSelection, input: GridEditValue): GridCellEdit[] { return scope.rows.flatMap((rowIndex) => scope.columns.map((columnIndex) => ({ rowIndex, columnIndex, input }))) }
/** One value fills a matrix; a multi-cell matrix must match exactly and never spill into unseen columns/rows. */
export function pasteGridSelection(scope: GridEditSelection, matrix: readonly (readonly GridEditValue[])[]): GridCellEdit[] {
  if (!scope.rectangular || !scope.rows.length || !scope.columns.length) throw new Error('请先选择粘贴目标矩形')
  if (matrix.length === 1 && matrix[0]?.length === 1) return fillGridSelection(scope, matrix[0][0])
  if (matrix.length !== scope.rows.length || matrix.some((row) => row.length !== scope.columns.length)) throw new Error(`粘贴为 ${matrix.length} 行 × ${matrix[0]?.length ?? 0} 列，须与选区 ${scope.rows.length} 行 × ${scope.columns.length} 列一致；不会截断或覆盖选区外数据`)
  return scope.rows.flatMap((rowIndex, row) => scope.columns.map((columnIndex, column) => ({ rowIndex, columnIndex, input: matrix[row][column] })))
}
export function stageGridCellEdits(page: DatabaseTablePage, drafts: readonly GridEditDraft[], edits: readonly GridCellEdit[], provider: RelationalProvider, makeId: () => string = () => crypto.randomUUID()): GridEditDraft[] {
  if (!edits.length || edits.length > GRID_EDIT_LIMITS.cells || new Set(edits.map((edit) => edit.rowIndex)).size > GRID_EDIT_LIMITS.rows) throw new Error('每次操作须包含 1–100 个单元格，且不超过 50 行')
  const seen = new Set<string>(), validatedRows = new Set<number>(), changes = new Map<number, GridEditDraft>(), existing = new Map(drafts.filter((draft) => draft.row !== null).map((draft) => [draft.row!, draft]))
  for (const edit of edits) {
    const column = page.columns[edit.columnIndex], row = page.rows[edit.rowIndex], cellKey = `${edit.rowIndex}:${edit.columnIndex}`, prior = existing.get(edit.rowIndex)
    if (!column || !row || !Number.isInteger(edit.columnIndex) || !Number.isInteger(edit.rowIndex) || edit.columnIndex < 0 || edit.rowIndex < 0) throw new Error('原始行或列已改变，请重新选择')
    if (seen.has(cellKey)) throw new Error('同一次编辑不能重复指定单元格'); seen.add(cellKey)
    if (!gridRowIdentifiable(page, edit.rowIndex)) throw new Error(`第 ${page.offset + edit.rowIndex + 1} 行缺少完整主键或非空单列唯一键`)
    if (gridGeneratedColumn(column)) throw new Error(`${column.name} 由数据库生成，不能直接赋值`)
    if (prior?.change.kind === 'delete') throw new Error(`第 ${page.offset + edit.rowIndex + 1} 行已暂存删除，请先撤销删除`)
    if (prior?.change.kind === 'insert') throw new Error('新增记录不能绑定已加载行的索引')
    if (!validatedRows.has(edit.rowIndex)) { row.forEach((value) => validateGridOriginalValue(value)); validatedRows.add(edit.rowIndex) }
    if (prior?.change.kind === 'update' && !sameGridEditValue(prior.change.original, row)) throw new Error('待提交变更的原始行与当前已加载数据不一致，请先审查或放弃旧变更')
    let draft = changes.get(edit.rowIndex)
    if (!draft) { draft = { id: prior?.id ?? makeId(), row: edit.rowIndex, change: { kind: 'update', original: prior?.change.kind === 'update' ? prior.change.original : structuredClone(row), values: prior?.change.kind === 'update' ? { ...prior.change.values } : {} } }; changes.set(edit.rowIndex, draft) }
    if (draft.change.kind !== 'update') throw new Error('待提交行类型无效')
    if (edit.input.mode === 'restore') { delete draft.change.values[column.name]; continue }
    if (edit.input.mode === 'null' && !column.isNullable) throw new Error(`${column.name} 不允许 NULL`)
    const original = row[edit.columnIndex], value = edit.input.mode === 'null' ? null : coerceGridEditValue(edit.input.text, column, original, provider)
    validateGridOriginalValue(value)
    if (sameGridEditValue(value, original)) delete draft.change.values[column.name]
    else Object.defineProperty(draft.change.values, column.name, { value, enumerable: true, writable: true, configurable: true })
  }
  const next: GridEditDraft[] = []
  for (const draft of drafts) {
    const replacement = draft.row === null ? undefined : changes.get(draft.row)
    if (!replacement) next.push(draft)
    else if (replacement.change.kind === 'update' && Object.keys(replacement.change.values).length) next.push(replacement)
  }
  for (const [row, draft] of changes) if (!existing.has(row) && draft.change.kind === 'update' && Object.keys(draft.change.values).length) next.push(draft)
  if (next.length > GRID_EDIT_LIMITS.changes) throw new Error('当前待提交列表最多 100 项变更，请先保存或减少变更')
  if (JSON.stringify(next.map((draft) => draft.change)).length > GRID_EDIT_LIMITS.characters) throw new Error('原始行与变更超过当前保存协议的 1 MB 范围，请缩小批次')
  return next
}
/** Display projection only. Inserts/deletes remain explicit draft entries, keeping loaded row indexes stable. */
export function gridRowsWithDrafts(page: DatabaseTablePage, drafts: readonly GridEditDraft[]): DatabaseTablePage['rows'] {
  const updates = new Map(drafts.filter((draft) => draft.row !== null && draft.change.kind === 'update').map((draft) => [draft.row!, draft.change]))
  return page.rows.map((row, index) => { const change = updates.get(index); return change?.kind === 'update' ? page.columns.map((column, columnIndex) => Object.hasOwn(change.values, column.name) ? change.values[column.name] : row[columnIndex]) : row })
}
