import { tokenizeSqlSemantic, type DatabaseColumnInfo, type RelationalConstraint, type RelationalForeignKey, type RelationalIndex, type RelationalProvider, type RelationalTableStructure, type RelationalTrigger } from '@fouc/shared'
import { generatedColumn, generationSignature, normalizeSchemaSql, parseTableDdl } from './ddl-source'
import { rewriteSchemaReferences } from './ddl'
import { schemaChangeId, schemaObjectKey, type SchemaDiffChange, type SchemaDiffComparison, type SchemaDiffField, type SchemaDiffInput, type SchemaDiffKind, type SchemaDiffOptions, type SchemaDiffTable, type SchemaDiffValue } from './model'

function inputTables(input: SchemaDiffInput): readonly RelationalTableStructure[] { return input === null ? [] : Array.isArray(input) ? input : [input as RelationalTableStructure] }
function print(value: unknown): string { return value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value) }
function field(fields: SchemaDiffField[], key: string, label: string, before: unknown, after: unknown, equal = before === after) {
  if (!equal) fields.push({ key, label, before: print(before), after: print(after) })
}
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function canonicalType(type: string, provider: RelationalProvider) {
  let value = type.trim().toLowerCase().replace(/\s+/g, ' ')
  if (provider === 'mysql') value = value.replace(/\b(tinyint|smallint|mediumint|int|integer|bigint)\(\d+\)/g, '$1').replace(/^integer\b/, 'int')
  if (provider === 'postgres') value = value.replace(/^(int2|int4|int8|float4|float8|bool|character varying)\b/, (name) => ({ int2: 'smallint', int4: 'integer', int8: 'bigint', float4: 'real', float8: 'double precision', bool: 'boolean', 'character varying': 'varchar' })[name]!)
  return value
}
function addChange(table: SchemaDiffTable, kind: SchemaDiffKind, name: string, source: SchemaDiffValue, target: SchemaDiffValue, fields: SchemaDiffField[] = []) {
  if (source !== null && target !== null && !fields.length) return
  const operation = source === null ? 'remove' : target === null ? 'add' : 'modify'
  const change: SchemaDiffChange = { id: schemaChangeId(table.id, kind, name), tableId: table.id, kind, name, source, target, fields, operation,
    risk: operation === 'remove' && (kind === 'column' || kind === 'table') ? 'destructive' : kind === 'column' && fields.some((entry) => entry.key === 'type') ? 'review' : kind === 'foreign' || kind === 'constraint' || kind === 'trigger' ? 'review' : 'low' }
  table.changes.push(change)
}

function columnFields(source: DatabaseColumnInfo, target: DatabaseColumnInfo, sourceIndex: number, targetIndex: number, comparison: SchemaDiffComparison, sourceNative: string | null, targetNative: string | null): SchemaDiffField[] {
  const fields: SchemaDiffField[] = [], provider = comparison.provider
  const srcGenerated = generatedColumn(source, sourceNative), dstGenerated = generatedColumn(target, targetNative)
  field(fields, 'type', '类型', target.dataType, source.dataType, canonicalType(source.dataType, provider) === canonicalType(target.dataType, provider))
  field(fields, 'nullable', '允许 NULL', target.isNullable, source.isNullable)
  field(fields, 'default', '默认值', target.columnDefault, source.columnDefault, normalizeSchemaSql(source.columnDefault, provider) === normalizeSchemaSql(target.columnDefault, provider))
  field(fields, 'extra', '自增 / Identity', target.extra, source.extra, (target.extra ?? '').toLowerCase() === (source.extra ?? '').toLowerCase())
  const srcIdentity = /identity/i.test(source.extra ?? ''), dstIdentity = /identity/i.test(target.extra ?? '')
  if (srcIdentity || dstIdentity) field(fields, 'identity', 'Identity 配置', dstIdentity ? targetNative : null, srcIdentity ? sourceNative : null,
    srcIdentity === dstIdentity && normalizeSchemaSql(sourceNative?.match(/GENERATED\s+[\s\S]+/i)?.[0], provider) === normalizeSchemaSql(targetNative?.match(/GENERATED\s+[\s\S]+/i)?.[0], provider))
  field(fields, 'generated', '生成表达式', dstGenerated ? targetNative ?? target.columnDefault : null, srcGenerated ? sourceNative ?? source.columnDefault : null,
    srcGenerated === dstGenerated && generationSignature(source, sourceNative, provider) === generationSignature(target, targetNative, provider))
  for (const [key, label] of [['characterSet', '字符集'], ['collation', '排序规则'], ['enumValues', '枚举值']] as const) field(fields, key, label, target[key], source[key], same(source[key] ?? null, target[key] ?? null))
  if (!comparison.options.ignoreComments) field(fields, 'comment', '注释', target.comment ?? '', source.comment ?? '')
  if (comparison.options.compareColumnOrder) field(fields, 'order', '字段顺序', targetIndex + 1, sourceIndex + 1)
  return fields
}

type NamedDiffValue = DatabaseColumnInfo | RelationalIndex | RelationalForeignKey | RelationalConstraint | RelationalTrigger
function compareNamed<T extends NamedDiffValue>(table: SchemaDiffTable, kind: SchemaDiffKind, source: T[], target: T[], compare: (source: T, target: T) => SchemaDiffField[]) {
  const targets = new Map(target.map((entry) => [entry.name, entry])), sources = new Set(source.map((entry) => entry.name))
  for (const entry of source) { const previous = targets.get(entry.name); addChange(table, kind, entry.name, entry, previous ?? null, previous ? compare(entry, previous) : []) }
  for (const entry of target) if (!sources.has(entry.name)) addChange(table, kind, entry.name, null, entry)
}

function indexFields(source: RelationalIndex, target: RelationalIndex, provider: RelationalProvider) {
  const fields: SchemaDiffField[] = []
  for (const [key, label] of [['unique', '唯一'], ['method', '索引方法'], ['visible', '可见'], ['valid', '有效'], ['comment', '注释']] as const) field(fields, key, label, target[key], source[key])
  field(fields, 'parts', '键 / INCLUDE / 顺序 / 前缀 / Collation', target.parts, source.parts, same(source.parts, target.parts))
  field(fields, 'predicate', '索引条件', target.predicate, source.predicate, normalizeSchemaSql(source.predicate, provider) === normalizeSchemaSql(target.predicate, provider))
  const nativeSignature = (sql: string | null) => {
    if (!sql) return ''
    const tokens = tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment')
    const on = tokens.findIndex((token) => token.kind === 'word' && token.text.toUpperCase() === 'ON')
    const table = tokens[on + 1]?.text.toUpperCase() === 'ONLY' ? on + 2 : on + 1
    if (on < 0 || !tokens[table]) return normalizeSchemaSql(sql, provider)
    const end = tokens[table + 1]?.text === '.' ? tokens[table + 2].span.end : tokens[table].span.end
    return normalizeSchemaSql(sql.slice(end).replace(/;+\s*$/, ''), provider)
  }
  if (source.definition && target.definition) field(fields, 'definition', '原生索引表达式 / Opclass', target.definition, source.definition, nativeSignature(source.definition) === nativeSignature(target.definition))
  return fields
}

function mappedReference(foreign: RelationalForeignKey, table: SchemaDiffTable, tables: SchemaDiffTable[]) {
  const mapped = tables.find((candidate) => candidate.source?.schema === foreign.referencedSchema && candidate.source?.table === foreign.referencedTable)
  const referenced = mapped?.target ?? mapped?.source
  return { ...foreign, referencedSchema: referenced?.schema ?? foreign.referencedSchema, referencedTable: referenced?.table ?? foreign.referencedTable }
}
function foreignFields(source: RelationalForeignKey, target: RelationalForeignKey, table: SchemaDiffTable, tables: SchemaDiffTable[]) {
  const desired = mappedReference(source, table, tables), fields: SchemaDiffField[] = []
  for (const [key, label] of [['columns', '本表字段'], ['referencedSchema', '引用 Schema'], ['referencedTable', '引用表'], ['referencedColumns', '引用字段'], ['match', 'MATCH'], ['deferrable', '可延期'], ['initiallyDeferred', '初始延期'], ['validated', '已验证']] as const) field(fields, key, label, target[key], desired[key], same(target[key], desired[key]))
  for (const [key, label] of [['onDelete', '删除动作'], ['onUpdate', '更新动作']] as const) field(fields, key, label, target[key], desired[key], target[key].trim().toUpperCase() === desired[key].trim().toUpperCase())
  return fields
}
function constraints(table: RelationalTableStructure, checks: boolean): RelationalConstraint[] {
  const result = table.constraints.filter((entry) => entry.kind !== 'foreign' && entry.kind !== 'not-null' && (checks || entry.kind !== 'check')).map((entry) => ({ ...entry, name: entry.kind === 'primary' ? 'PRIMARY KEY' : table.provider === 'sqlite' && entry.kind === 'unique' ? `UNIQUE (${entry.columns.join(', ')})` : entry.name }))
  if (!result.some((entry) => entry.kind === 'primary')) {
    const primary = table.indexes.find((entry) => entry.primary)
    const columns = primary?.parts.filter((entry) => entry.role === 'key' && entry.column).map((entry) => entry.column!) ?? table.columns.filter((entry) => entry.isPrimaryKey).map((entry) => entry.name)
    if (columns.length) result.push({ name: 'PRIMARY KEY', kind: 'primary', columns, definition: null, validated: true, deferrable: null, initiallyDeferred: null })
  }
  return result
}

/** Native metadata comparison adapted from DBX diff_columns/indexes/foreign_keys. */
export function buildSchemaDiff(provider: RelationalProvider, sourceInput: SchemaDiffInput, targetInput: SchemaDiffInput, options: SchemaDiffOptions = {}): SchemaDiffComparison {
  if (!['mysql', 'postgres', 'sqlite'].includes(provider)) throw new Error('当前数据库暂不支持结构比较。')
  const sources = inputTables(sourceInput), targets = inputTables(targetInput)
  if ([...sources, ...targets].some((entry) => entry.provider !== provider)) throw new Error('结构比较需要相同的原生数据库类型。')
  const comparison: SchemaDiffComparison = { provider, tables: [], changes: [], options: { ignoreComments: false, compareColumnOrder: false, indexes: true, foreignKeys: true, checks: true, triggers: true, ...options }, issues: [] }
  const used = new Set<RelationalTableStructure>()
  for (const source of sources) {
    const mapping = options.tableMappings?.find((entry) => entry.sourceTable === source.table && (!entry.sourceSchema || entry.sourceSchema === source.schema))
    const exact = targets.find((entry) => entry.table === (mapping?.targetTable ?? source.table) && entry.schema === (mapping?.targetSchema ?? source.schema))
    const sameName = targets.filter((entry) => entry.table === (mapping?.targetTable ?? source.table))
    const target = sources.length === 1 && targets.length === 1 && !mapping ? targets[0] : exact ?? (sameName.length === 1 ? sameName[0] : undefined)
    if (target && used.has(target)) throw new Error('多个源对象映射到同一个目标表，请调整映射。')
    if (target) used.add(target)
    const physical = target ?? source
    comparison.tables.push({ id: schemaObjectKey(physical.schema, physical.table), name: `${physical.schema}.${physical.table}`, source, target: target ?? null, changes: [] })
  }
  for (const target of targets) if (!used.has(target)) comparison.tables.push({ id: schemaObjectKey(target.schema, target.table), name: `${target.schema}.${target.table}`, source: null, target, changes: [] })
  for (const table of comparison.tables) {
    const { source, target } = table
    for (const object of [source, target]) if (object) comparison.issues.push(...object.definition.warnings.map((message) => ({ severity: 'info' as const, message, tableId: table.id })))
    if (!source || !target) { addChange(table, 'table', table.name, source, target); continue }
    if (source.kind !== 'table' || target.kind !== 'table') {
      comparison.issues.push({ severity: 'unsupported', message: `${table.name} 不是普通表；此批只审查表结构，不生成视图/物化视图部署。`, tableId: table.id })
      continue
    }
    const sourceDdl = parseTableDdl(source.definition.sql, provider), targetDdl = parseTableDdl(target.definition.sql, provider)
    compareNamed(table, 'column', source.columns, target.columns, (a, b) => columnFields(a, b, source.columns.indexOf(a), target.columns.indexOf(b), comparison, sourceDdl?.columns.get(a.name) ?? null, targetDdl?.columns.get(b.name) ?? null))
    if (comparison.options.indexes) compareNamed(table, 'index', source.indexes.filter((entry) => !entry.primary && !entry.constraintBacked), target.indexes.filter((entry) => !entry.primary && !entry.constraintBacked), (a, b) => indexFields(a, b, provider))
    compareNamed(table, 'constraint', constraints(source, comparison.options.checks), constraints(target, comparison.options.checks), (a, b) => {
      const fields: SchemaDiffField[] = []
      for (const [key, label] of [['kind', '约束类型'], ['columns', '字段'], ['validated', '已验证'], ['deferrable', '可延期'], ['initiallyDeferred', '初始延期']] as const) field(fields, key, label, b[key], a[key], same(a[key], b[key]))
      field(fields, 'definition', '定义', b.definition, a.definition, a.kind === 'primary' && b.kind === 'primary' ? true : normalizeSchemaSql(a.definition, provider) === normalizeSchemaSql(b.definition, provider))
      return fields
    })
    if (comparison.options.foreignKeys) compareNamed(table, 'foreign', source.foreignKeys, target.foreignKeys, (a, b) => foreignFields(a, b, table, comparison.tables))
    if (comparison.options.triggers) compareNamed(table, 'trigger', source.triggers, target.triggers, (a, b) => {
      const fields: SchemaDiffField[] = []
      field(fields, 'definition', '定义', b.definition, a.definition, normalizeSchemaSql(a.definition, provider) === normalizeSchemaSql(b.definition, provider))
      field(fields, 'enabled', '启用状态', b.enabled, a.enabled)
      return fields
    })
    const keys = new Set([...Object.keys(source.properties), ...Object.keys(target.properties)])
    for (const key of keys) {
      if (key === 'generatedColumns' || comparison.options.ignoreComments && key === 'comment') continue
      if ((source.properties[key] ?? null) !== (target.properties[key] ?? null)) addChange(table, 'property', key, source.properties[key] ?? null, target.properties[key] ?? null, [{ key, label: key, before: print(target.properties[key]), after: print(source.properties[key]) }])
    }
    if (provider === 'sqlite') {
      const src = parseTableDdl(rewriteSchemaReferences(source.definition.sql, table, comparison.tables), provider), dst = parseTableDdl(target.definition.sql, provider)
      if (!src || !dst) comparison.issues.push({ severity: 'unsupported', message: `${table.name} 缺少可解析的原始 CREATE TABLE，不能完整识别 CHECK/声明约束。`, tableId: table.id })
      else {
        const inline = (columns: Map<string, string>) => [...columns.values()].flatMap((clause) => {
          const marker = tokenizeSqlSemantic(clause, provider).find((token) => token.kind === 'word' && /^(?:CHECK|REFERENCES)$/i.test(token.text))
          return marker ? [clause.slice(marker.span.start)] : []
        })
        const sourceClauses = [...src.clauses, ...inline(src.columns)].map((clause) => normalizeSchemaSql(clause, provider)).sort()
        const targetClauses = [...dst.clauses, ...inline(dst.columns)].map((clause) => normalizeSchemaSql(clause, provider)).sort()
        if (!same(sourceClauses, targetClauses)) addChange(table, 'constraint', '原始 DDL 约束', source.definition.sql, target.definition.sql, [{ key: 'native', label: 'CHECK / 内联约束', before: dst.clauses.join('\n'), after: src.clauses.join('\n') }])
      }
    }
  }
  comparison.changes = comparison.tables.flatMap((table) => table.changes)
  return comparison
}

export { mappedReference }
