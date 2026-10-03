import { tokenizeSqlSemantic, type DatabaseColumnInfo, type RelationalIndex, type RelationalTrigger } from '@fouc/shared'
import { createIndexDdl, ddlLiteral, qualifiedTable, quoteSchemaId, rewriteSchemaReferences, rewriteTriggerTarget, terminateDdl } from './ddl'
import { generatedColumn, parseTableDdl } from './ddl-source'
import type { SchemaDiffChange, SchemaDiffIssue, SchemaDiffStep, SchemaDiffTable } from './model'

export interface SqliteRebuildResult { steps: SchemaDiffStep[]; issues: SchemaDiffIssue[] }
function applyNamed<T extends RelationalIndex | RelationalTrigger>(initial: T[], changes: SchemaDiffChange[], kind: 'index' | 'trigger'): T[] {
  const entries = new Map(initial.map((entry) => [entry.name, entry]))
  for (const change of changes.filter((entry) => entry.kind === kind)) {
    if (change.operation === 'remove') entries.delete(change.name)
    // Comparison emits the same metadata type for the selected index/trigger kind.
    else entries.set(change.name, change.source as unknown as T)
  }
  return [...entries.values()]
}

/** SQLite's documented create-copy-drop-rename procedure, with explicit data and commit review. */
export function buildSqliteRebuild(table: SchemaDiffTable, chosen: SchemaDiffChange[], tables: SchemaDiffTable[]): SqliteRebuildResult {
  const issues: SchemaDiffIssue[] = [], steps: SchemaDiffStep[] = []
  const source = table.source!, target = table.target!
  const src = parseTableDdl(source.definition.sql, 'sqlite'), dst = parseTableDdl(target.definition.sql, 'sqlite')
  const structural = chosen.filter((change) => ['column', 'foreign', 'constraint', 'property'].includes(change.kind))
  const ids = structural.map((change) => change.id)
  const issue = (severity: SchemaDiffIssue['severity'], message: string) => issues.push({ severity, message, tableId: table.id })
  if (!src || !dst || source.definition.origin !== 'native' || target.definition.origin !== 'native') {
    issue('unsupported', `${table.name} 重建需要两端真实 CREATE TABLE，不能从不完整目录猜测 CHECK、生成列或表选项。`)
    return { steps, issues }
  }
  const complete = table.changes.filter((change) => ['column', 'foreign', 'constraint', 'property'].includes(change.kind)).every((change) => ids.includes(change.id))
  const desired = new Map<string, DatabaseColumnInfo>(target.columns.map((column) => [column.name, column]))
  const definitions = new Map(dst.columns)
  for (const change of structural.filter((entry) => entry.kind === 'column')) {
    if (change.operation === 'remove') { desired.delete(change.name); definitions.delete(change.name) }
    else {
      const column = change.source as DatabaseColumnInfo, definition = src.columns.get(column.name)
      if (!definition) { issue('unsupported', `字段 ${column.name} 缺少原始定义，不能重建。`); return { steps, issues } }
      desired.set(column.name, column); definitions.set(column.name, definition)
    }
  }
  if (!desired.size) { issue('unsupported', 'SQLite 表至少需要一列，不能生成删除全部字段的重建。'); return { steps, issues } }
  const ordered = complete ? source.columns.filter((column) => desired.has(column.name)).map((column) => column.name) : [...desired.keys()]
  const constraints = complete ? src.clauses : dst.clauses
  const suffix = complete ? src.suffix : dst.suffix
  if (/\bSTRICT\b/i.test(suffix) && [...desired.values()].some((column) => !/^(?:INT|INTEGER|REAL|TEXT|BLOB|ANY)$/i.test(column.dataType.trim()))) {
    issue('unsupported', '选定类型不符合目标 STRICT 表规则；请同时选择相应表属性变更。')
    return { steps, issues }
  }
  const writable = ordered.filter((name) => !generatedColumn(desired.get(name)!, definitions.get(name) ?? null))
  for (const name of writable) {
    const column = desired.get(name)!
    if (!target.columns.some((entry) => entry.name === name) && !column.isNullable && (column.columnDefault === null || /^\(?\s*NULL\s*\)?$/i.test(column.columnDefault))) {
      issue('unsupported', `新增 NOT NULL 字段 ${name} 没有有效默认值；现有行的数据回填规则未提供，暂不生成破坏性步骤。`)
      return { steps, issues }
    }
  }
  const tempName = `__fouc_diff_${target.table}`
  const temp = qualifiedTable({ schema: target.schema, table: tempName }, 'sqlite'), physical = qualifiedTable(target, 'sqlite')
  const raw = complete ? src : dst
  const create = rewriteSchemaReferences(terminateDdl(raw.sql.slice(0, raw.nameStart) + temp + raw.sql.slice(raw.nameEnd, raw.bodyStart) + '\n  ' + [...ordered.map((name) => definitions.get(name)!), ...constraints].join(',\n  ') + '\n)' + (suffix ? ' ' + suffix : '')), table, tables)
  const step = (key: string, phase: number, label: string, sql: string) => {
    const id = `${table.id}:rebuild:${key}`
    steps.push({ id, tableId: table.id, changeIds: ids, phase, label, sql, risk: 'review', dependsOn: steps.length ? [steps.at(-1)!.id] : [] })
  }
  step('create', 30, '创建目标定义的临时表', create)
  const oldAuto = tokenizeSqlSemantic(dst.sql.slice(0, dst.end), 'sqlite').some((token) => token.kind === 'word' && token.text.toUpperCase() === 'AUTOINCREMENT')
  const newAuto = tokenizeSqlSemantic(create, 'sqlite').some((token) => token.kind === 'word' && token.text.toUpperCase() === 'AUTOINCREMENT')
  const sequenceTemp = quoteSchemaId(`${tempName}_sequence`, 'sqlite')
  if (oldAuto && newAuto) step('sequence-save', 32, '保存 AUTOINCREMENT 高水位', `CREATE TEMP TABLE ${sequenceTemp} AS SELECT seq FROM ${quoteSchemaId(target.schema, 'sqlite')}.sqlite_sequence WHERE name=${ddlLiteral(target.table, 'sqlite')};`)
  const common = writable.filter((name) => target.columns.some((entry) => entry.name === name))
  const names = common.map((name) => quoteSchemaId(name, 'sqlite')), expressions = [...names]
  const rowidAliases = new Set(['rowid', '_rowid_', 'oid'])
  const hasRowid = target.properties.withoutRowid !== 'true' && !/WITHOUT\s+ROWID/i.test(suffix)
  const aliasesHidden = [...target.columns, ...desired.values()].some((column) => rowidAliases.has(column.name.toLowerCase()))
  if (hasRowid && !aliasesHidden) { names.unshift('"_rowid_"'); expressions.unshift('"_rowid_"') }
  if (!names.length) {
    const fallback = writable.find((name) => desired.get(name)!.isNullable || desired.get(name)!.columnDefault !== null)
    if (!fallback) { issue('unsupported', '没有可写的复制字段，不能确定如何保留已有行。'); return { steps: [], issues } }
    names.push(quoteSchemaId(fallback, 'sqlite')); expressions.push(desired.get(fallback)!.columnDefault ?? 'NULL')
  }
  step('copy', 35, '按字段名复制原始数据，跳过生成列', `INSERT INTO ${temp} (${names.join(', ')})\nSELECT ${expressions.join(', ')} FROM ${physical};`)
  if (structural.some((change) => change.kind === 'column' && change.operation === 'remove')) issue('warning', '选定删除的字段不会复制到新表，其数据会随旧表删除；请先保存备份。')
  if (structural.some((change) => change.kind === 'column' && change.fields.some((entry) => entry.key === 'nullable' && entry.after === 'false'))) issue('warning', '已有 NULL 行可能使数据复制失败；失败后应 ROLLBACK，不继续提交。')
  if (!hasRowid || aliasesHidden) issue('info', '本次按声明字段复制；隐式 rowid 无法统一映射，请核对依赖 rowid 的应用和虚拟表。')
  step('drop', 40, '删除旧表（数据已在事务内复制）', `DROP TABLE ${physical};`)
  step('rename', 45, '将临时表改为原目标名', `ALTER TABLE ${temp} RENAME TO ${quoteSchemaId(target.table, 'sqlite')};`)
  if (oldAuto && newAuto) {
    step('sequence-restore', 47, '恢复 AUTOINCREMENT 高水位', `UPDATE ${quoteSchemaId(target.schema, 'sqlite')}.sqlite_sequence SET seq=MAX(seq, COALESCE((SELECT seq FROM ${sequenceTemp}), seq)) WHERE name=${ddlLiteral(target.table, 'sqlite')};\nDROP TABLE ${sequenceTemp};`)
  }
  const indexes = applyNamed<RelationalIndex>(target.indexes.filter((index) => !index.constraintBacked && !index.primary), chosen, 'index')
  for (const index of indexes) {
    try { step(`index:${index.name}`, 50, `重建索引 ${index.name}`, createIndexDdl(index, target)) }
    catch (error) { issue('unsupported', error instanceof Error ? error.message : String(error)) }
  }
  const triggers = applyNamed<RelationalTrigger>(target.triggers, chosen, 'trigger')
  for (const trigger of triggers) {
    try { step(`trigger:${trigger.name}`, 55, `恢复触发器 ${trigger.name}`, rewriteTriggerTarget(trigger.definition, target)) }
    catch (error) { issue('unsupported', error instanceof Error ? error.message : String(error)) }
  }
  issue('warning', '重建会影响外部视图、外键、触发器和虚拟表。当前表元数据未枚举全部外部依赖，须按实际数据库确认。')
  issue('info', `临时表 ${tempName} 必须不存在；脚本不使用 IF NOT EXISTS 跳过命名冲突。`)
  return { steps, issues }
}
