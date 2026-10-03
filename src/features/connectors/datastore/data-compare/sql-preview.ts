import type { RelationalProvider } from '@fouc/shared'
import { isBinaryCell, quoteExportIdentifier, sqlCell } from '../result-export/values'
import { compareCellAt, type DataCompareCell, type DataCompareColumnMapping, type DataCompareEntry, type DataCompareResult, type DataCompareSqlPreview, type DataCompareTarget } from './model'
import { compareBinaryValue, compareJsonType } from './values'

const MAX_PREVIEW_CHARACTERS = 2_000_000
function literal(value: DataCompareCell, provider: RelationalProvider, type: string): string {
  if (value === undefined) throw new Error('源值缺失，不能推断为 NULL 或默认值。')
  if (isBinaryCell(value) && compareJsonType(type, provider)) return [...sqlCell(JSON.stringify(value), provider, type)].join('')
  return [...sqlCell(value, provider, type)].join('')
}
function predicate(column: string, value: DataCompareCell, type: string, provider: RelationalProvider): string {
  const quoted = quoteExportIdentifier(column, provider)
  if (value === null) return `${quoted} IS NULL`
  const sql = literal(value, provider, type)
  const jsonValue = value !== undefined && typeof value === 'object' && !compareBinaryValue(value, type, provider) && !(provider === 'postgres' && /^ARRAY\b/.test(sql))
  if (jsonValue && provider === 'postgres') return `to_jsonb(${quoted}) IS NOT DISTINCT FROM (${sql})::jsonb`
  if (jsonValue && provider === 'mysql') return `${quoted} <=> CAST(${sql} AS JSON)`
  return `${quoted} ${provider === 'mysql' ? '<=>' : provider === 'postgres' ? 'IS NOT DISTINCT FROM' : 'IS'} ${sql}`
}

/** One statement per explicitly selected diff, with old values guarding UPDATE/DELETE previews. */
export function buildDataCompareSqlPreview(comparison: DataCompareResult, selected: ReadonlySet<string>, provider: RelationalProvider, target: DataCompareTarget): DataCompareSqlPreview {
  const output: DataCompareSqlPreview = { sql: '', statements: 0, skipped: [], warnings: [] }
  const table = [target.schema, target.table].filter((part): part is string => part !== undefined && part !== '').map((part) => quoteExportIdentifier(part, provider)).join('.')
  if (!target.table.trim()) throw new Error('请提供真实目标表名以预览 SQL。')
  const names = comparison.mapping.map((entry) => comparison.right.columns[entry.right])
  if (new Set(names).size !== names.length) throw new Error('目标结果包含重复列名，不能把查询别名当作可写目标列。请调整映射。')
  if (target.columns && names.some((name) => !target.columns!.some((column) => column.name === name))) throw new Error('映射列与实际目标表结构不符，不能把查询别名作为目标列。')
  const generated = new Set(target.columns?.filter((column) => /^(?:generated$|(?:virtual|stored)\s+generated(?:\s|$))/i.test(column.extra?.trim() ?? '')).map((column) => column.name) ?? [])
  const writable = comparison.mapping.filter((entry) => !generated.has(comparison.right.columns[entry.right]))
  const overridesIdentity = provider === 'postgres' && writable.some((entry) => target.columns?.some((column) => column.name === comparison.right.columns[entry.right] && column.extra === 'identity'))
  if (generated.size) output.warnings.push('生成列已从 INSERT 与 UPDATE 候选中排除。')
  if (!target.columns) output.warnings.push('目标列结构未供给；请核对查询别名、生成列与完整目标表结构。')
  if (comparison.partial) output.warnings.push('输入有截断或更多数据；左右独有仅描述本次已加载范围。')
  const statements: string[] = []; let characters = 0, limitReached = false
  function value(entry: DataCompareEntry, mapping: DataCompareColumnMapping, side: 'left' | 'right') {
    const source = comparison[side], index = entry[side === 'left' ? 'leftRows' : 'rightRows'][0]
    return compareCellAt(source.rows[index], mapping[side])
  }
  function where(entry: DataCompareEntry): string {
    // Keys alone may not be globally unique outside this loaded snapshot.
    return comparison.mapping.map((mapping) => predicate(comparison.right.columns[mapping.right], value(entry, mapping, 'right'), comparison.right.columnTypes[mapping.right] ?? '', provider)).join(' AND ')
  }
  for (const entry of comparison.entries) {
    if (!selected.has(entry.id)) continue
    if (limitReached) { output.skipped.push({ entryId: entry.id, reason: 'SQL 预览超过 2,000,000 字符；请减少选择。' }); continue }
    try {
      if (entry.kind === 'unchanged' || entry.kind === 'conflict') throw new Error(entry.kind === 'conflict' ? '键冲突或原始值不可靠，不能生成写入候选。' : '该行没有差异。')
      let sql: string
      if (entry.kind === 'added') {
        sql = writable.length ? `INSERT INTO ${table} (${writable.map((mapping) => quoteExportIdentifier(comparison.right.columns[mapping.right], provider)).join(', ')})${overridesIdentity ? ' OVERRIDING SYSTEM VALUE' : ''} VALUES (${writable.map((mapping) => literal(value(entry, mapping, 'left'), provider, comparison.right.columnTypes[mapping.right] ?? '')).join(', ')});` : provider === 'mysql' ? `INSERT INTO ${table} () VALUES ();` : `INSERT INTO ${table} DEFAULT VALUES;`
      } else if (entry.kind === 'removed') sql = `DELETE FROM ${table} WHERE ${where(entry)};`
      else {
        const changedIds = new Set(entry.changes.map((change) => change.mappingId)), changed = writable.filter((mapping) => changedIds.has(mapping.id))
        if (!changed.length) throw new Error('差异只涉及生成列，没有可写修改。')
        sql = `UPDATE ${table} SET ${changed.map((mapping) => `${quoteExportIdentifier(comparison.right.columns[mapping.right], provider)} = ${literal(value(entry, mapping, 'left'), provider, comparison.right.columnTypes[mapping.right] ?? '')}`).join(', ')} WHERE ${where(entry)};`
      }
      if (characters + sql.length > MAX_PREVIEW_CHARACTERS) { limitReached = true; throw new Error('SQL 预览超过 2,000,000 字符；请减少选择。') }
      characters += sql.length; statements.push(sql)
    } catch (error) { output.skipped.push({ entryId: entry.id, reason: error instanceof Error ? error.message : String(error) }) }
  }
  output.statements = statements.length
  output.sql = statements.length ? `-- 左侧 → 右侧，仅基于本次已加载结果的审查候选\n-- UPDATE / DELETE 包含旧值条件；执行前核对目标、唯一键与受影响范围\n${statements.join('\n')}` : ''
  return output
}
