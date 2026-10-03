import { tokenizeSqlSemantic, type DatabaseColumnInfo, type RelationalConstraint, type RelationalForeignKey, type RelationalIndex, type RelationalProvider, type RelationalTableStructure } from '@fouc/shared'
import { parseTableDdl, generatedColumn } from './ddl-source'
import type { SchemaDiffTable } from './model'

export function quoteSchemaId(value: string, provider: RelationalProvider): string {
  if (!value || value.includes('\0')) throw new Error('DDL 标识符不能是空值或含空字符。')
  const quote = provider === 'mysql' ? '`' : '"'
  return quote + value.replaceAll(quote, quote + quote) + quote
}
export function qualifiedTable(table: Pick<RelationalTableStructure, 'schema' | 'table'>, provider: RelationalProvider) {
  return [table.schema, table.table].filter(Boolean).map((part) => quoteSchemaId(part, provider)).join('.')
}
export function terminateDdl(sql: string) { return sql.trim().replace(/;+$/, '') + ';' }
export function ddlLiteral(value: string | null, provider: RelationalProvider): string {
  if (value === null) return 'NULL'
  if (value.includes('\0')) throw new Error('DDL 文本不支持空字符。')
  const escaped = provider === 'sqlite' ? value : value.replaceAll('\\', '\\\\')
  return (provider === 'postgres' ? 'E' : '') + "'" + escaped.replaceAll("'", "''") + "'"
}

export function columnDefinition(column: DatabaseColumnInfo, table: RelationalTableStructure): string {
  const native = parseTableDdl(table.definition.sql, table.provider)?.columns.get(column.name)
  if (native) return native
  if (generatedColumn(column, null) || /identity/i.test(column.extra ?? '')) throw new Error(`字段 ${column.name} 缺少生成列 / Identity 的完整原始定义。`)
  const type = column.dataType.trim()
  if (!type || type.includes(';')) throw new Error(`字段 ${column.name} 类型定义无效。`)
  let sql = `${quoteSchemaId(column.name, table.provider)} ${type}`
  if (column.characterSet) sql += ` CHARACTER SET ${quoteSchemaId(column.characterSet, table.provider)}`
  if (column.collation) sql += ` COLLATE ${quoteSchemaId(column.collation, table.provider)}`
  if (!column.isNullable) sql += ' NOT NULL'
  if (column.columnDefault !== null) {
    const raw = column.columnDefault
    const mysqlText = table.provider === 'mysql' && !/DEFAULT_GENERATED/i.test(column.extra ?? '') && /(?:char|text|enum|set|binary|blob|date|time)/i.test(type) && !/^CURRENT_TIMESTAMP(?:\(\d*\))?$/i.test(raw)
    sql += ` DEFAULT ${mysqlText ? ddlLiteral(raw, table.provider) : raw}`
  }
  if (table.provider === 'mysql') {
    if (/auto_increment/i.test(column.extra ?? '')) sql += ' AUTO_INCREMENT'
    const update = column.extra?.match(/on update\s+(.+)$/i)
    if (update) sql += ` ON UPDATE ${update[1]}`
    if (column.comment) sql += ` COMMENT ${ddlLiteral(column.comment, table.provider)}`
  }
  return sql
}

function tokenIdentifierEnd(tokens: ReturnType<typeof tokenizeSqlSemantic>, index: number): number {
  const token = tokens[index]
  if (!token || !['word', 'quoted_identifier'].includes(token.kind)) throw new Error('无法定位原始 DDL 对象名称。')
  return tokens[index + 1]?.text === '.' ? tokens[index + 2].span.end : token.span.end
}
function replaceRanges(sql: string, ranges: { start: number; end: number; value: string }[]) {
  return ranges.sort((a, b) => b.start - a.start).reduce((text, range) => text.slice(0, range.start) + range.value + text.slice(range.end), sql)
}

/** Preserve native opclasses, INCLUDE, predicates and expressions instead of rebuilding from lossy metadata. */
export function rewriteIndexDefinition(sql: string, index: RelationalIndex, target: RelationalTableStructure): string {
  const tokens = tokenizeSqlSemantic(sql, target.provider).filter((token) => token.kind !== 'comment')
  const marker = tokens.findIndex((token) => token.kind === 'word' && token.text.toUpperCase() === 'INDEX')
  if (tokens[0]?.text.toUpperCase() !== 'CREATE' || marker < 0) throw new Error(`索引 ${index.name} 缺少可用的 CREATE INDEX 定义。`)
  let name = marker + 1
  if (tokens[name]?.text.toUpperCase() === 'IF') name += 3
  const on = tokens.findIndex((token, position) => position > name && token.kind === 'word' && token.text.toUpperCase() === 'ON')
  if (on < 0) throw new Error(`无法定位索引 ${index.name} 的目标表。`)
  const tableIndex = tokens[on + 1]?.text.toUpperCase() === 'ONLY' ? on + 2 : on + 1
  const indexName = target.provider === 'sqlite' ? `${quoteSchemaId(target.schema, target.provider)}.${quoteSchemaId(index.name, target.provider)}` : quoteSchemaId(index.name, target.provider)
  const tableName = target.provider === 'sqlite' ? quoteSchemaId(target.table, target.provider) : qualifiedTable(target, target.provider)
  return terminateDdl(replaceRanges(sql, [
    { start: tokens[name].span.start, end: tokenIdentifierEnd(tokens, name), value: indexName },
    { start: tokens[tableIndex].span.start, end: tokenIdentifierEnd(tokens, tableIndex), value: tableName },
  ]))
}

export function createIndexDdl(index: RelationalIndex, target: RelationalTableStructure): string {
  const provider = target.provider
  if (index.primary || index.constraintBacked) throw new Error('约束支撑索引必须随约束生成。')
  if (index.valid === false) throw new Error(`索引 ${index.name} 当前无效，无法用普通 CREATE INDEX 重现无效状态。`)
  if (index.definition && provider !== 'mysql') return rewriteIndexDefinition(index.definition, index, target)
  const keys = index.parts.filter((part) => part.role === 'key').sort((a, b) => a.position - b.position)
  if (!keys.length) throw new Error(`索引 ${index.name} 缺少可用键定义。`)
  const parts = keys.map((part) => {
    if (!part.column && !part.expression) throw new Error(`索引 ${index.name} 缺少表达式元数据。`)
    let sql = part.column ? quoteSchemaId(part.column, provider) : `(${part.expression})`
    if (part.prefixLength !== null) { if (provider !== 'mysql') throw new Error('此前缀索引语法只支持 MySQL。'); sql += `(${part.prefixLength})` }
    if (part.collation) sql += ` COLLATE ${quoteSchemaId(part.collation, provider)}`
    if (part.descending !== null) sql += part.descending ? ' DESC' : ' ASC'
    if (part.nulls && provider === 'postgres') sql += ` NULLS ${part.nulls.toUpperCase()}`
    return sql
  })
  const method = index.method.toLowerCase()
  if (!/^[a-z0-9_]+$/.test(method)) throw new Error(`索引 ${index.name} 方法无效。`)
  const special = provider === 'mysql' && ['fulltext', 'spatial'].includes(method) ? method.toUpperCase() + ' ' : index.unique ? 'UNIQUE ' : ''
  const indexName = provider === 'sqlite' ? `${quoteSchemaId(target.schema, provider)}.${quoteSchemaId(index.name, provider)}` : quoteSchemaId(index.name, provider)
  const tableName = provider === 'sqlite' ? quoteSchemaId(target.table, provider) : qualifiedTable(target, provider)
  const using = provider === 'postgres' || provider === 'mysql' && ['btree', 'hash'].includes(method) ? ` USING ${method}` : ''
  let sql = `CREATE ${special}INDEX ${indexName} ON ${tableName}${provider === 'postgres' ? using : ''} (${parts.join(', ')})${provider === 'mysql' ? using : ''}`
  const included = index.parts.filter((part) => part.role === 'include')
  if (included.length) {
    if (provider !== 'postgres' || included.some((part) => !part.column)) throw new Error(`索引 ${index.name} 的 INCLUDE 字段不能在当前库生成。`)
    sql += ` INCLUDE (${included.map((part) => quoteSchemaId(part.column!, provider)).join(', ')})`
  }
  if (index.predicate) { if (provider === 'mysql') throw new Error('MySQL 不支持部分索引 WHERE。'); sql += ` WHERE ${index.predicate}` }
  if (provider === 'mysql') { if (index.visible === false) sql += ' INVISIBLE'; if (index.comment) sql += ` COMMENT ${ddlLiteral(index.comment, provider)}` }
  return terminateDdl(sql)
}

export function dropIndexDdl(index: RelationalIndex, target: RelationalTableStructure): string {
  return target.provider === 'mysql' ? `DROP INDEX ${quoteSchemaId(index.name, target.provider)} ON ${qualifiedTable(target, target.provider)};`
    : `DROP INDEX ${quoteSchemaId(target.schema, target.provider)}.${quoteSchemaId(index.name, target.provider)};`
}

export function constraintDefinition(constraint: RelationalConstraint, provider: RelationalProvider): string {
  if (constraint.definition) {
    let definition = constraint.definition.trim().replace(/;+$/, '')
    if (provider === 'postgres' && constraint.validated === false && ['check', 'foreign'].includes(constraint.kind) && !/\bNOT VALID\s*$/i.test(definition)) definition += ' NOT VALID'
    return definition
  }
  if (constraint.kind !== 'primary' && constraint.kind !== 'unique') throw new Error(`约束 ${constraint.name} 缺少原始定义。`)
  if (!constraint.columns.length) throw new Error(`约束 ${constraint.name} 缺少字段。`)
  let sql = `${constraint.kind === 'primary' ? 'PRIMARY KEY' : 'UNIQUE'} (${constraint.columns.map((name) => quoteSchemaId(name, provider)).join(', ')})`
  if (provider === 'postgres' && constraint.deferrable) sql += ` DEFERRABLE INITIALLY ${constraint.initiallyDeferred ? 'DEFERRED' : 'IMMEDIATE'}`
  return sql
}

export function foreignKeyDefinition(foreign: RelationalForeignKey, provider: RelationalProvider): string {
  if (foreign.columns.length !== foreign.referencedColumns.length || !foreign.columns.length) throw new Error(`外键 ${foreign.name} 字段映射不完整。`)
  const referenced = provider === 'sqlite' ? quoteSchemaId(foreign.referencedTable, provider) : qualifiedTable({ schema: foreign.referencedSchema, table: foreign.referencedTable }, provider)
  let sql = `FOREIGN KEY (${foreign.columns.map((name) => quoteSchemaId(name, provider)).join(', ')}) REFERENCES ${referenced} (${foreign.referencedColumns.map((name) => quoteSchemaId(name, provider)).join(', ')})`
  if (provider === 'postgres' && foreign.match.toUpperCase() === 'FULL') sql += ' MATCH FULL'
  for (const [label, raw] of [['DELETE', foreign.onDelete], ['UPDATE', foreign.onUpdate]]) {
    const action = raw.trim().replaceAll('_', ' ').toUpperCase()
    if (!['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'].includes(action)) throw new Error(`外键 ${foreign.name} 的 ${label} 动作无效。`)
    sql += ` ON ${label} ${action}`
  }
  if (provider !== 'mysql' && foreign.deferrable) sql += ` DEFERRABLE INITIALLY ${foreign.initiallyDeferred ? 'DEFERRED' : 'IMMEDIATE'}`
  if (provider === 'postgres' && foreign.validated === false) sql += ' NOT VALID'
  return sql
}

export function dropConstraintDdl(constraint: RelationalConstraint, target: RelationalTableStructure): string {
  if (target.provider === 'mysql') {
    if (constraint.kind === 'primary') return `ALTER TABLE ${qualifiedTable(target, target.provider)} DROP PRIMARY KEY;`
    if (constraint.kind === 'unique') return `ALTER TABLE ${qualifiedTable(target, target.provider)} DROP INDEX ${quoteSchemaId(constraint.name, target.provider)};`
    if (constraint.kind === 'check') return `ALTER TABLE ${qualifiedTable(target, target.provider)} DROP CHECK ${quoteSchemaId(constraint.name, target.provider)};`
  }
  return `ALTER TABLE ${qualifiedTable(target, target.provider)} DROP CONSTRAINT ${quoteSchemaId(constraint.name, target.provider)};`
}

export function rewriteCreateTable(table: RelationalTableStructure, target: Pick<RelationalTableStructure, 'schema' | 'table'>): string {
  const parts = parseTableDdl(table.definition.sql, table.provider)
  if (!parts) throw new Error('缺少可解析的 CREATE TABLE 原始定义。')
  return terminateDdl(parts.sql.slice(0, parts.nameStart) + qualifiedTable(target, table.provider) + parts.sql.slice(parts.nameEnd, parts.end))
}

export function rewriteTriggerTarget(sql: string, target: RelationalTableStructure): string {
  const tokens = tokenizeSqlSemantic(sql, target.provider).filter((token) => token.kind !== 'comment')
  const on = tokens.findIndex((token) => token.kind === 'word' && token.text.toUpperCase() === 'ON')
  if (on < 0 || tokens[0]?.text.toUpperCase() !== 'CREATE') throw new Error('缺少可解析的 CREATE TRIGGER 原始定义。')
  return terminateDdl(replaceRanges(sql, [{ start: tokens[on + 1].span.start, end: tokenIdentifierEnd(tokens, on + 1), value: qualifiedTable(target, target.provider) }]))
}

export function rewriteSchemaReferences(sql: string, owner: SchemaDiffTable, tables: SchemaDiffTable[]): string {
  const provider = owner.source!.provider
  const tokens = tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment')
  const ranges: { start: number; end: number; value: string }[] = []
  const name = (text: string) => {
    const open = text[0], close = open === '[' ? ']' : open
    return ['"', '`', '['].includes(open) ? text.slice(1, -1).replaceAll(close + close, close) : text
  }
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].kind !== 'word' || tokens[index].text.toUpperCase() !== 'REFERENCES') continue
    const first = tokens[index + 1]
    if (!first || !['word', 'quoted_identifier'].includes(first.kind)) continue
    const qualified = tokens[index + 2]?.text === '.'
    const schema = qualified ? name(first.text) : owner.source!.schema
    const table = name(qualified ? tokens[index + 3].text : first.text)
    const mapping = tables.find((candidate) => candidate.source?.schema === schema && candidate.source?.table === table)
    if (!mapping) continue
    const target = mapping.target ?? mapping.source!
    ranges.push({ start: first.span.start, end: tokenIdentifierEnd(tokens, index + 1), value: provider === 'sqlite' ? quoteSchemaId(target.table, provider) : qualifiedTable(target, provider) })
  }
  return replaceRanges(sql, ranges)
}
