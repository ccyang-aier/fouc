import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete'
import type { EditorState } from '@codemirror/state'
import { MySQL, PostgreSQL, SQLite, keywordCompletionSource } from '@codemirror/lang-sql'
import type { DatabaseColumnInfo, DatabaseObjectInfo, RelationalProvider } from '@fouc/shared'
import { sqlCompletionPosition, sqlTokens, type SqlTableReference } from './sql-completion-context'

export type SqlMetadataTransport = {
  tables: (schema: string, signal: AbortSignal) => Promise<DatabaseObjectInfo[]>
  columns: (schema: string, table: string, signal: AbortSignal) => Promise<DatabaseColumnInfo[]>
}
export type SqlMetadataState = { pending: number; error: string }
export type SqlMetadataTarget = { schema: string; schemas: readonly string[] }
const dialects = { mysql: MySQL, postgres: PostgreSQL, sqlite: SQLite }
const keywordSets = new Map<RelationalProvider, Set<string>>()
const positions = new WeakMap<EditorState, { provider: RelationalProvider; pos: number; result: ReturnType<typeof sqlCompletionPosition> }>()
function completionPosition(context: CompletionContext, provider: RelationalProvider) {
  const cached = positions.get(context.state)
  if (cached?.provider === provider && cached.pos === context.pos) return cached.result
  const result = sqlCompletionPosition(context.state.doc.toString(), context.pos, provider)
  positions.set(context.state, { provider, pos: context.pos, result }); return result
}
export function sqlKeywordCompletion(provider: RelationalProvider): CompletionSource {
  const source = keywordCompletionSource(dialects[provider], true)
  return (context) => { const position = completionPosition(context, provider); return position && !position.qualifier.length ? source(context) : null }
}
export function quoteCompletionIdentifier(name: string, provider: RelationalProvider, force = false): string {
  let keywords = keywordSets.get(provider)
  if (!keywords) { keywords = new Set((dialects[provider].spec.keywords ?? '').toLowerCase().split(/\s+/)); keywordSets.set(provider, keywords) }
  if (!force && /^[a-z_][a-z0-9_$]*$/.test(name) && !keywords.has(name.toLowerCase())) return name
  const quote = provider === 'mysql' ? '`' : '"'
  return quote + name.replaceAll(quote, quote + quote) + quote
}
function scopeKey(schema: string, table: string): string { return JSON.stringify([schema, table]) }

/** DBX's lazy table/column metadata and completion epoch, owned by one Fouc session. */
export class SqlMetadataCompletion {
  private readonly listeners = new Set<() => void>()
  private readonly tables = new Map<string, Promise<DatabaseObjectInfo[]>>()
  private readonly columns = new Map<string, Promise<DatabaseColumnInfo[]>>()
  private abort = new AbortController()
  private epoch = 0
  private state: SqlMetadataState = { pending: 0, error: '' }
  constructor(private readonly provider: RelationalProvider, private readonly transport: SqlMetadataTransport) {}
  getSnapshot = (): SqlMetadataState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(update: Partial<SqlMetadataState>): void { this.state = { ...this.state, ...update }; for (const listener of this.listeners) listener() }
  clear(): void {
    this.epoch++; this.abort.abort(); this.abort = new AbortController()
    this.tables.clear(); this.columns.clear(); this.publish({ pending: 0, error: '' })
  }
  private cached<T>(cache: Map<string, Promise<T>>, key: string, read: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const existing = cache.get(key); if (existing) return existing
    const epoch = this.epoch, signal = this.abort.signal
    this.publish({ pending: this.state.pending + 1, error: '' })
    const request = Promise.resolve().then(() => read(signal)).catch((reason) => {
      if (epoch === this.epoch) { cache.delete(key); this.publish({ error: reason instanceof Error ? reason.message : String(reason) }) }
      throw reason
    }).finally(() => { if (epoch === this.epoch) this.publish({ pending: Math.max(0, this.state.pending - 1) }) })
    cache.set(key, request); return request
  }
  private tableList(schema: string): Promise<DatabaseObjectInfo[]> { return this.cached(this.tables, schema, (signal) => this.transport.tables(schema, signal)) }
  private columnList(schema: string, table: string): Promise<DatabaseColumnInfo[]> { return this.cached(this.columns, scopeKey(schema, table), (signal) => this.transport.columns(schema, table, signal)) }
  async complete(context: CompletionContext, target: SqlMetadataTarget): Promise<CompletionResult | null> {
    const position = completionPosition(context, this.provider)
    if (!position || !target.schema || (!context.explicit && !position.prefix && !position.qualifier.length)) return null
    const epoch = this.epoch, active = () => epoch === this.epoch && !context.aborted
    const options: Completion[] = []
    const add = (name: string, type: string, detail: string, insert = quoteCompletionIdentifier(name, this.provider, position.quoted), info?: string) => {
      options.push({ label: name, type, detail, apply: insert, ...(info ? { info } : {}), boost: type === 'property' ? 2 : 1 })
    }
    const exact = (names: readonly string[], name: string) => names.find((candidate) => candidate === name) ?? (this.provider === 'sqlite' ? names.find((candidate) => candidate.toLowerCase() === name.toLowerCase()) : undefined)
    try {
      const qualified = position.qualifier.at(-1)
      const alias = qualified && !position.tableContext ? position.references.findLast((ref) => exact([ref.alias ?? ref.table], qualified)) : undefined
      const schemaName = qualified && !alias ? exact(target.schemas, qualified) : undefined
      if (position.qualifier.length > 2) return null
      if (position.qualifier.length === 2) {
        const schema = exact(target.schemas, position.qualifier[0]); if (!schema || position.tableContext) return null
        const tables = await this.tableList(schema), table = tables.find((item) => exact([item.name], qualified!))
        if (!active() || !table) return null
        for (const column of await this.columnList(schema, table.name)) add(column.name, 'property', column.dataType, undefined, column.comment ?? undefined)
      } else if (qualified && !schemaName && !alias) {
        if (exact(position.virtualTables, qualified)) return null
        const tables = await this.tableList(target.schema)
        const table = tables.find((item) => exact([item.name], qualified))
        if (!active() || !table) return null
        for (const column of await this.columnList(target.schema, table.name)) add(column.name, 'property', column.dataType, undefined, column.comment ?? undefined)
      } else if (alias) {
        if (alias.virtual) return null
        const schema = alias.schema ?? target.schema
        if (!exact(target.schemas, schema)) return null
        const tables = await this.tableList(schema), table = tables.find((item) => exact([item.name], alias.table))
        if (!active() || !table) return null
        for (const column of await this.columnList(schema, table.name)) add(column.name, 'property', `${alias.alias ?? alias.table} · ${column.dataType}`, undefined, column.comment ?? undefined)
      } else {
        const schema = schemaName ?? target.schema
        const tables = await this.tableList(schema)
        if (!active()) return null
        if (!qualified) for (const name of target.schemas) add(name, 'namespace', this.provider === 'mysql' ? '数据库' : 'Schema')
        if (!qualified) for (const name of position.virtualTables) add(name, 'class', 'CTE · 当前语句')
        for (const table of tables) if (qualified || !exact(position.virtualTables, table.name)) add(table.name, 'class', `${schema} · ${table.kind === 'view' ? '视图' : '表'}`, undefined, table.comment ?? undefined)
        if (!position.tableContext && !qualified) {
          const unique = new Map<string, SqlTableReference>()
          for (const ref of position.references) if (!ref.virtual) unique.set(JSON.stringify([ref.schema ?? target.schema, ref.table, ref.alias]), ref)
          const groups: { ref: SqlTableReference; columns: DatabaseColumnInfo[] }[] = []
          // Read only referenced, existing objects. Four workers avoid flooding a large schema.
          const refs = [...unique.values()]; let index = 0
          await Promise.all(Array.from({ length: Math.min(4, refs.length) }, async () => {
            while (index < refs.length && active()) {
              const ref = refs[index++], refSchema = ref.schema ?? target.schema
              if (!exact(target.schemas, refSchema)) continue
              const ownedTables = refSchema === schema ? tables : await this.tableList(refSchema)
              const table = ownedTables.find((item) => exact([item.name], ref.table)); if (!table) continue
              groups.push({ ref, columns: await this.columnList(refSchema, table.name) })
            }
          }))
          const counts = new Map<string, number>()
          for (const group of groups) for (const column of group.columns) counts.set(column.name, (counts.get(column.name) ?? 0) + 1)
          for (const { ref, columns } of groups.sort((a, b) => a.ref.from - b.ref.from)) for (const column of columns) {
            const source = ref.alias ?? (ref.schema ? `${ref.schema}.${ref.table}` : ref.table), name = quoteCompletionIdentifier(column.name, this.provider, position.quoted)
            const qualifier = ref.alias ? quoteCompletionIdentifier(ref.alias, this.provider) : [ref.schema, ref.table].filter((part): part is string => part !== null).map((part) => quoteCompletionIdentifier(part, this.provider)).join('.')
            const insert = counts.get(column.name)! > 1 ? `${qualifier}.${name}` : name
            add(column.name, 'property', `${source} · ${column.dataType}${column.isPrimaryKey ? ' · 主键' : ''}`, insert, column.comment ?? undefined)
          }
        }
      }
      if (!active()) return null
      return { from: position.from, to: position.to, options, validFor: position.quoted ? (text) => { const tokens = sqlTokens(text, this.provider); return tokens.length === 1 && tokens[0].kind === 'identifier' && tokens[0].from === 0 && tokens[0].to === text.length } : /^[\p{L}\p{N}\p{M}_$@]*$/u }
    } catch { return null }
  }
}
