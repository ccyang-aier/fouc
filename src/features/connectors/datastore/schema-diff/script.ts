import { tokenizeSqlSemantic, unquoteSqlSemanticIdentifier, type DatabaseColumnInfo, type RelationalConstraint, type RelationalForeignKey, type RelationalIndex, type RelationalTableStructure, type RelationalTrigger } from '@fouc/shared'
import { mappedReference } from './compare'
import { buildSqliteRebuild } from './sqlite-rebuild'
import { columnDefinition, constraintDefinition, createIndexDdl, ddlLiteral, dropConstraintDdl, dropIndexDdl, foreignKeyDefinition, qualifiedTable, quoteSchemaId, rewriteCreateTable, rewriteTriggerTarget, terminateDdl } from './ddl'
import { generatedColumn, parseTableDdl } from './ddl-source'
import type { SchemaDiffChange, SchemaDiffComparison, SchemaDiffIssue, SchemaDiffScript, SchemaDiffStep, SchemaDiffTable } from './model'

function objectColumns(change: SchemaDiffChange, side: 'source' | 'target'): string[] {
  const value = change[side]
  if (!value || typeof value === 'string') return []
  if (change.kind === 'column') return [(value as DatabaseColumnInfo).name]
  if (change.kind === 'index') return (value as RelationalIndex).parts.flatMap((part) => part.column ? [part.column] : [])
  if (change.kind === 'foreign' || change.kind === 'constraint') return (value as RelationalForeignKey | RelationalConstraint).columns
  return []
}
function structural(change: SchemaDiffChange) { return ['column', 'constraint', 'foreign', 'property'].includes(change.kind) }

/** DBX parent/child selection adapted to explicit, necessary native DDL dependencies. */
export function expandSchemaDiffSelection(comparison: SchemaDiffComparison, ids: readonly string[]): Set<string> {
  const selected = new Set(ids)
  for (const id of selected) if (!comparison.changes.some((change) => change.id === id)) throw new Error('选定的结构差异已变化，请重新选择。')
  let expanded = true
  while (expanded) {
    expanded = false
    const include = (id: string) => { if (!selected.has(id)) { selected.add(id); expanded = true } }
    for (const table of comparison.tables) {
      const chosen = table.changes.filter((change) => selected.has(change.id))
      if (comparison.provider === 'sqlite' && chosen.some((change) => change.kind === 'constraint' || change.kind === 'foreign' || change.kind === 'property')) {
        for (const change of table.changes.filter(structural)) include(change.id)
      }
      for (const change of chosen) {
        const sourceColumns = objectColumns(change, 'source')
        if (change.kind !== 'column') for (const added of table.changes.filter((entry) => entry.kind === 'column' && entry.operation === 'add' && sourceColumns.includes(entry.name))) include(added.id)
        if (change.kind === 'column' && change.operation === 'remove') for (const dependent of table.changes.filter((entry) => entry.kind !== 'column' && objectColumns(entry, 'target').includes(change.name))) include(dependent.id)
        if (comparison.provider === 'sqlite' && change.kind === 'column') for (const native of table.changes.filter((entry) => entry.kind === 'constraint' && entry.name === '原始 DDL 约束')) include(native.id)
      }
    }
  }
  return selected
}

function actualConstraint(value: RelationalConstraint, table: RelationalTableStructure): RelationalConstraint {
  return value.kind === 'primary' ? table.constraints.find((constraint) => constraint.kind === 'primary') ?? { ...value, name: `${table.table}_pkey` } : value
}
function topologicalSteps(steps: SchemaDiffStep[], issues: SchemaDiffIssue[]): SchemaDiffStep[] {
  const remaining = new Map(steps.map((step) => [step.id, step])), emitted = new Set<string>(), ordered: SchemaDiffStep[] = []
  while (remaining.size) {
    const ready = [...remaining.values()].filter((step) => step.dependsOn.every((id) => emitted.has(id) || !remaining.has(id))).sort((a, b) => a.phase - b.phase)
    if (!ready.length) { issues.push({ severity: 'unsupported', message: '变更存在循环依赖，须手工拆分 DDL。' }); ordered.push(...remaining.values()); break }
    const next = ready[0]
    ordered.push(next); emitted.add(next.id); remaining.delete(next.id)
  }
  return ordered
}

export function buildSchemaDiffScript(comparison: SchemaDiffComparison, selectedIds: readonly string[] = comparison.changes.map((change) => change.id)): SchemaDiffScript {
  const selected = expandSchemaDiffSelection(comparison, selectedIds), provider = comparison.provider
  const issues = [...comparison.issues], steps: SchemaDiffStep[] = []
  const quote = (value: string) => quoteSchemaId(value, provider)
  const issue = (change: SchemaDiffChange | null, severity: SchemaDiffIssue['severity'], message: string, tableId?: string) => issues.push({ severity, message, ...(change ? { changeId: change.id, tableId: change.tableId } : tableId ? { tableId } : {}) })
  const add = (table: SchemaDiffTable, change: SchemaDiffChange | null, suffix: string, phase: number, label: string, sql: string, dependsOn: string[] = []) => {
    const id = `${change?.id ?? table.id}:${suffix}`
    steps.push({ id, tableId: table.id, changeIds: change ? [change.id] : [], phase, label, sql, risk: change?.risk ?? 'review', dependsOn })
    return id
  }
  let sqliteRebuild = false
  for (const table of comparison.tables) {
    const chosen = table.changes.filter((change) => selected.has(change.id))
    if (!chosen.length) continue
    const target = table.target ?? table.source!, source = table.source
    const physical = qualifiedTable(target, provider)
    const rebuild = provider === 'sqlite' && source && table.target && chosen.some(structural)
    if (rebuild) {
      const plan = buildSqliteRebuild(table, chosen, comparison.tables)
      issues.push(...plan.issues); steps.push(...plan.steps)
      if (plan.steps.length) sqliteRebuild = true
      continue
    }
    for (const change of chosen) {
      const stepStart = steps.length
      try {
        switch (change.kind) {
          case 'table': {
            if (target.kind !== 'table') throw new Error('当前批次只生成普通表 DDL，不部署视图或物化视图。')
            if (change.operation === 'remove') {
              add(table, change, 'drop', 80, `删除表 ${table.name}`, `DROP TABLE ${physical};`)
              issue(change, 'warning', 'DROP TABLE 会删除全部行；当前比较没有行数据备份，也没有读取全部外部引用。')
            } else {
              let sql = rewriteCreateTable(source!, target)
              if (provider !== 'sqlite') {
                const parts = parseTableDdl(sql, provider)!
                const clauses = parts.clauses.filter((clause) => {
                  const tokens = tokenizeSqlSemantic(clause, provider).filter((token) => token.kind !== 'comment')
                  const foreign = tokens.some((token, index) => token.kind === 'word' && token.text.toUpperCase() === 'FOREIGN' && tokens[index + 1]?.text.toUpperCase() === 'KEY')
                  const regularIndex = provider === 'mysql' && /^(?:KEY|INDEX|FULLTEXT|SPATIAL)$/i.test(tokens[0]?.text ?? '')
                  return !foreign && !regularIndex
                })
                sql = terminateDdl(sql.slice(0, parts.bodyStart) + '\n  ' + [...parts.columns.values(), ...clauses].join(',\n  ') + '\n)' + (parts.suffix ? ' ' + parts.suffix : ''))
              }
              const create = add(table, change, 'create', 20, `创建表 ${table.name}`, sql)
              for (const index of source!.indexes.filter((entry) => !entry.primary && !entry.constraintBacked)) add(table, change, `index:${index.name}`, 50, `创建索引 ${index.name}`, createIndexDdl(index, target), [create])
              if (provider !== 'sqlite') for (const foreign of source!.foreignKeys) add(table, change, `foreign:${foreign.name}`, 70, `建立外键 ${foreign.name}`, `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(foreign.name)} ${foreignKeyDefinition(mappedReference(foreign, table, comparison.tables), provider)};`, [create])
              for (const trigger of source!.triggers) add(table, change, `trigger:${trigger.name}`, 75, `创建触发器 ${trigger.name}`, rewriteTriggerTarget(trigger.definition, target), [create])
            }
            break
          }
          case 'column': {
            const column = change.source as DatabaseColumnInfo | null, previous = change.target as DatabaseColumnInfo | null
            if (change.operation === 'remove') {
              add(table, change, 'drop', generatedColumn(previous!, null) ? 25 : 40, `删除字段 ${change.name}`, `ALTER TABLE ${physical} DROP COLUMN ${quote(change.name)};`)
              issue(change, 'warning', `字段 ${change.name} 的已有数据会被删除；外部依赖未完整枚举，不生成 CASCADE。`)
            } else if (change.operation === 'add') {
              // A new generated field must follow type changes of fields it references.
              add(table, change, 'add', generatedColumn(column!, null) ? 45 : 30, `新增字段 ${change.name}`, `ALTER TABLE ${physical} ADD COLUMN ${columnDefinition(column!, source!)};`)
              if (!column!.isNullable && column!.columnDefault === null && !generatedColumn(column!, null)) issue(change, 'warning', '新增非空字段无默认值，已有行需要回填，直接执行可能失败。')
              if (provider === 'postgres' && column!.comment !== null) add(table, change, 'comment', 60, `字段注释 ${change.name}`, `COMMENT ON COLUMN ${physical}.${quote(change.name)} IS ${ddlLiteral(column!.comment, provider)};`)
            } else if (provider === 'mysql') {
              let position = ''
              if (change.fields.some((field) => field.key === 'order')) {
                const index = source!.columns.findIndex((entry) => entry.name === change.name)
                position = index === 0 ? ' FIRST' : ` AFTER ${quote(source!.columns[index - 1].name)}`
              }
              add(table, change, 'modify', 35, `修改字段 ${change.name}`, `ALTER TABLE ${physical} MODIFY COLUMN ${columnDefinition(column!, source!)}${position};`)
              issue(change, 'warning', 'MySQL MODIFY 会重述字段定义，可能重建或锁住表；类型收窄须核对已有数据。')
            } else {
              const keys = new Set(change.fields.map((field) => field.key))
              if (keys.has('generated') || keys.has('identity') || keys.has('extra') || keys.has('characterSet') || keys.has('enumValues')) throw new Error(`字段 ${change.name} 的生成列 / Identity / 枚举修改需结合目标版本和数据规则手工审查。`)
              if (keys.has('order')) issue(change, 'unsupported', 'PostgreSQL 不支持 ALTER 调整物理字段顺序，此项不生成伪 DDL。')
              if (keys.has('type') || keys.has('collation')) {
                const dependency = target.columns.find((candidate) => candidate.name !== change.name && generatedColumn(candidate, null) && tokenizeSqlSemantic(candidate.columnDefault ?? '', provider).some((token, index, tokens) =>
                  (token.kind === 'quoted_identifier' ? unquoteSqlSemanticIdentifier(token) === change.name : token.kind === 'word' && token.normalized === change.name.toLowerCase() && tokens[index + 1]?.text !== '(')
                ) && !chosen.some((entry) => entry.kind === 'column' && entry.name === candidate.name && entry.operation === 'remove'))
                if (dependency) throw new Error(`字段 ${change.name} 被生成列 ${dependency.name} 依赖；必须先审查该生成列的移除与重建，不能直接 ALTER TYPE。`)
                const collation = column!.collation ? ` COLLATE ${quote(column!.collation)}` : ''
                add(table, change, 'type', 35, `字段类型 ${change.name}`, `ALTER TABLE ${physical} ALTER COLUMN ${quote(change.name)} TYPE ${column!.dataType}${collation} USING ${quote(change.name)}::${column!.dataType};`)
                issue(change, 'warning', 'USING 显式原生类型转换可能失败或丢失精度；源类型定义、依赖表达式和目标数据需核对。')
              }
              if (keys.has('default')) add(table, change, 'default', 36, `字段默认值 ${change.name}`, `ALTER TABLE ${physical} ALTER COLUMN ${quote(change.name)} ${column!.columnDefault === null ? 'DROP DEFAULT' : `SET DEFAULT ${column!.columnDefault}`};`)
              if (keys.has('nullable')) add(table, change, 'nullability', 37, `字段 NULL 约束 ${change.name}`, `ALTER TABLE ${physical} ALTER COLUMN ${quote(change.name)} ${column!.isNullable ? 'DROP' : 'SET'} NOT NULL;`)
              if (keys.has('comment')) add(table, change, 'comment', 60, `字段注释 ${change.name}`, `COMMENT ON COLUMN ${physical}.${quote(change.name)} IS ${ddlLiteral(column!.comment, provider)};`)
              if (previous && !column!.isNullable && previous.isNullable) issue(change, 'warning', 'SET NOT NULL 前须确认已有行没有 NULL。')
            }
            break
          }
          case 'index': {
            let drop: string | undefined
            if (change.target) drop = add(table, change, 'drop', 15, `移除旧索引 ${change.name}`, dropIndexDdl(change.target as RelationalIndex, target))
            if (change.source) add(table, change, 'create', 50, `建立索引 ${change.name}`, createIndexDdl(change.source as RelationalIndex, target), drop ? [drop] : [])
            break
          }
          case 'constraint': {
            if (typeof change.source === 'string' || typeof change.target === 'string') throw new Error('此原始 DDL 约束需要 SQLite 重建流程。')
            let drop: string | undefined
            if (change.target) drop = add(table, change, 'drop', 10, `移除旧约束 ${change.name}`, dropConstraintDdl(actualConstraint(change.target as RelationalConstraint, target), target))
            if (change.source) {
              const constraint = actualConstraint(change.source as RelationalConstraint, source!)
              add(table, change, 'add', 55, `建立约束 ${change.name}`, `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(constraint.name)} ${constraintDefinition(constraint, provider)};`, drop ? [drop] : [])
              issue(change, 'warning', '新增 PK / UNIQUE / CHECK 需要现有数据满足约束，可能扫描整表。')
            }
            break
          }
          case 'foreign': {
            let drop: string | undefined
            if (change.target) {
              const foreign = change.target as RelationalForeignKey
              if (foreign.nameSource !== 'catalog') throw new Error('外键名称来自推断编号，不能据此 DROP CONSTRAINT。')
              drop = add(table, change, 'drop', 5, `移除旧外键 ${change.name}`, `ALTER TABLE ${physical} DROP ${provider === 'mysql' ? 'FOREIGN KEY' : 'CONSTRAINT'} ${quote(foreign.name)};`)
            }
            if (change.source) add(table, change, 'add', 70, `建立外键 ${change.name}`, `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(change.name)} ${foreignKeyDefinition(mappedReference(change.source as RelationalForeignKey, table, comparison.tables), provider)};`, drop ? [drop] : [])
            issue(change, 'warning', '外键需引用目标库中已存在的表及可用唯一键，并核对现有数据。')
            break
          }
          case 'trigger': {
            if (provider === 'postgres') throw new Error('PostgreSQL 触发器依赖函数和启用状态；本批不部署函数，保留原定义供审查。')
            let drop: string | undefined
            if (change.target) drop = add(table, change, 'drop', 5, `移除触发器 ${change.name}`, `DROP TRIGGER ${quote(target.schema)}.${quote(change.name)};`)
            if (change.source) add(table, change, 'add', 75, `建立触发器 ${change.name}`, rewriteTriggerTarget((change.source as RelationalTrigger).definition, target), drop ? [drop] : [])
            issue(change, 'warning', '触发器正文可能引用源对象或使用不同权限，须审查正文；MySQL 客户端可能需要 DELIMITER。')
            break
          }
          case 'property': {
            const value = typeof change.source === 'string' ? change.source : null
            if (change.name === 'comment') add(table, change, 'comment', 60, '表注释', provider === 'mysql' ? `ALTER TABLE ${physical} COMMENT=${ddlLiteral(value ?? '', provider)};` : `COMMENT ON TABLE ${physical} IS ${ddlLiteral(value, provider)};`)
            else if (provider === 'mysql' && ['engine', 'collation', 'rowFormat'].includes(change.name) && value) {
              const keyword = change.name === 'engine' ? 'ENGINE' : change.name === 'collation' ? 'COLLATE' : 'ROW_FORMAT'
              if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error('表属性不是有效的原生名称。')
              add(table, change, 'option', 60, `表属性 ${change.name}`, `ALTER TABLE ${physical} ${keyword}=${value};`)
              issue(change, 'warning', '表属性变更可能重建、锁表或改变后续默认排序规则。')
            } else if (provider === 'postgres' && change.name === 'owner' && value) add(table, change, 'owner', 60, '表所有者', `ALTER TABLE ${physical} OWNER TO ${quote(value)};`)
            else if (provider === 'postgres' && change.name === 'persistence' && ['p', 'u'].includes(value ?? '')) add(table, change, 'persistence', 60, '表持久性', `ALTER TABLE ${physical} SET ${value === 'u' ? 'UNLOGGED' : 'LOGGED'};`)
            else if (provider === 'postgres' && change.name === 'tablespace') add(table, change, 'tablespace', 60, '表空间', `ALTER TABLE ${physical} SET TABLESPACE ${quote(value ?? 'pg_default')};`)
            else throw new Error(`表属性 ${change.name} 缺少可靠的原生变更规则，需手工审查。`)
            break
          }
        }
      } catch (error) { steps.splice(stepStart); issue(change, 'unsupported', error instanceof Error ? error.message : String(error)) }
    }
  }
  if (provider !== 'sqlite') {
    for (const owner of comparison.tables) {
      if (!owner.target) continue
      for (const foreign of owner.target.foreignKeys) {
        const already = owner.changes.find((change) => change.kind === 'foreign' && change.name === foreign.name && selected.has(change.id))
        if (already) continue
        const affected = comparison.tables.some((table) => table.target && table.changes.some((change) => selected.has(change.id) && (
          change.kind === 'constraint' && (change.target as RelationalConstraint | null)?.kind === 'primary' && table.target!.schema === foreign.referencedSchema && table.target!.table === foreign.referencedTable
          || change.kind === 'column' && (change.operation === 'remove' || change.fields.some((field) => field.key === 'type')) && (
            owner.id === table.id && foreign.columns.includes(change.name)
            || table.target!.schema === foreign.referencedSchema && table.target!.table === foreign.referencedTable && foreign.referencedColumns.includes(change.name)
          ))))
        if (!affected) continue
        if (foreign.nameSource !== 'catalog') { issue(null, 'unsupported', `依赖外键 ${foreign.name} 缺少真实目录名称，不能可靠地暂移。`, owner.id); continue }
        const physical = qualifiedTable(owner.target, provider)
        const drop = add(owner, null, `dependency:${foreign.name}:drop`, 1, `暂移依赖外键 ${foreign.name}`, `ALTER TABLE ${physical} DROP ${provider === 'mysql' ? 'FOREIGN KEY' : 'CONSTRAINT'} ${quote(foreign.name)};`)
        const desired = owner.source?.foreignKeys.find((entry) => entry.name === foreign.name)
        if (desired) add(owner, null, `dependency:${foreign.name}:restore`, 70, `恢复依赖外键 ${foreign.name}`, `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(foreign.name)} ${foreignKeyDefinition(mappedReference(desired, owner, comparison.tables), provider)};`, [drop])
      }
    }
  }
  if (sqliteRebuild) {
    steps.unshift({ id: 'sqlite:begin', tableId: '', changeIds: [], phase: 0, label: '记录外键设置并开启重建事务',
      sql: '-- 先记录 PRAGMA foreign_keys 的原值；必须在事务外关闭外键。\nPRAGMA foreign_keys;\nPRAGMA foreign_keys=OFF;\nBEGIN IMMEDIATE;', risk: 'review', dependsOn: [] })
    for (const step of steps) if (step.id !== 'sqlite:begin') step.dependsOn.push('sqlite:begin')
    steps.push({ id: 'sqlite:check', tableId: '', changeIds: [], phase: 95, label: '核对外键并人工确认提交',
      sql: 'PRAGMA foreign_key_check;\n-- 检查结果必须为空。确认数据与依赖后另行执行 COMMIT;\n-- 检查失败执行 ROLLBACK; 随后恢复 PRAGMA foreign_keys 的原值。', risk: 'review', dependsOn: [] })
    issues.push({ severity: 'warning', message: 'SQLite 重建脚本有意停在事务内的检查点。foreign_key_check 只返回问题，不会自动阻止 COMMIT，必须审查后另行提交或回滚。' })
  }
  for (const table of comparison.tables) {
    if (!table.source || !table.target || table.source.connectionId !== table.target.connectionId || table.source.schema !== table.target.schema || table.source.table === table.target.table) continue
    for (const change of table.changes.filter((entry) => selected.has(entry.id) && entry.source && ['index', 'constraint'].includes(entry.kind) && provider !== 'mysql')) {
      issue(change, 'unsupported', `源目标处于同一连接与 Schema，源索引 / 约束名 ${change.name} 可能已占用；请审查并为目标选择独立名称。`)
    }
  }
  const ordered = topologicalSteps(steps, issues)
  const distinctIssues = [...new Map(issues.map((entry) => [JSON.stringify(entry), entry])).values()]
  const header = `-- Fouc ${provider} 结构差异审查\n-- 方向：源结构 → 目标对象；仅生成 DDL，不执行。\n`
  const notes = distinctIssues.filter((entry) => entry.severity !== 'info').map((entry) => `-- ${entry.severity === 'unsupported' ? '需手工处理' : '影响'}：${entry.message.replace(/[\r\n]+/g, ' ')}`).join('\n')
  const body = ordered.map((step, index) => `-- ${index + 1}. ${step.label.replace(/[\r\n]+/g, ' ')}\n${step.sql}`).join('\n\n')
  return { sql: header + (notes ? notes + '\n\n' : '') + (body || '-- 当前选择没有可生成的变更。\n'), steps: ordered, issues: distinctIssues,
    selectedCount: selected.size, reviewComplete: !distinctIssues.some((entry) => entry.severity === 'unsupported') }
}
