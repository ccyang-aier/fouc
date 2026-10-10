import { tokenizeSqlSemantic, type RelationalProvider } from '@fouc/shared'
import { buildSqlSemanticModel } from './sql-semantic/model'
import { visibleSqlSources } from './sql-semantic/sources'

export function sqlResultTabLabel(label: string, preceding: readonly string[]): string {
  const ordinal = preceding.filter(value => value === label).length + 1
  return ordinal === 1 ? label : `${label} (${ordinal})`
}

/** A single physical row source can name a result; joins and CTEs keep a neutral label. */
export function sqlResultLabel(sql: string, provider: RelationalProvider, schema: string | null, fallback: string): string {
  const source = sqlResultSource(sql, provider, schema)
  return source ? `${source.schema}.${source.table}` : fallback
}
export function sqlResultSource(sql: string, provider: RelationalProvider, schema: string | null): { schema: string; table: string } | null {
  if (!sql.trim() || sql.length > 100_000) return null
  const cursor = tokenizeSqlSemantic(sql, provider).find(token => token.kind !== 'comment')?.span.end ?? 0
  const sources = visibleSqlSources(buildSqlSemanticModel(sql, cursor, { provider }))
  if (sources.length !== 1 || sources[0].kind !== 'table' || sources[0].qualifierParts.length > 1) return null
  const source = sources[0], qualifiers = source.qualifierParts.length ? source.qualifierParts : schema ? [schema] : []
  return qualifiers.length ? { schema: qualifiers[0], table: source.name } : null
}
