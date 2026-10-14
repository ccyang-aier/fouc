import { uiFailure, type UiMessage } from '../i18n/ui-message';

import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-metadata-completion.messages';
import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import type { EditorState } from '@codemirror/state';
import { MySQL, PostgreSQL, SQLite, keywordCompletionSource } from '@codemirror/lang-sql';
import type { DatabaseColumnInfo, DatabaseObjectInfo, RelationalProvider } from '@fouc/shared';
import { sqlCompletionPosition } from './sql-completion-context';
import { tokenizeSqlSemantic } from '@fouc/shared';
import { sqlSemanticDialectFor } from './sql-semantic/dialect';
import { SqlSourceColumnResolver, type SqlSourceColumn } from './sql-semantic/source-columns';
import { visibleProjectionAliases } from './sql-semantic/sources';
export type SqlMetadataTransport = {
  tables: (schema: string, signal: AbortSignal) => Promise<DatabaseObjectInfo[]>;
  columns: (schema: string, table: string, signal: AbortSignal) => Promise<DatabaseColumnInfo[]>;
};
export type SqlMetadataState = {
  pending: number;
  error: UiMessage;
};
export type SqlMetadataTarget = {
  schema: string;
  schemas: readonly string[];
};
const dialects = { mysql: MySQL, postgres: PostgreSQL, sqlite: SQLite };
const keywordSets = new Map<RelationalProvider, Set<string>>();
const positions = new WeakMap<
  EditorState,
  {
    provider: RelationalProvider;
    pos: number;
    result: ReturnType<typeof sqlCompletionPosition>;
  }
>();
function completionPosition(context: CompletionContext, provider: RelationalProvider) {
  const cached = positions.get(context.state);
  if (cached?.provider === provider && cached.pos === context.pos) return cached.result;
  const result = sqlCompletionPosition(
    context.state.doc.toString(),
    context.pos,
    provider,
    context.state,
  );
  positions.set(context.state, { provider, pos: context.pos, result });
  return result;
}
export function sqlKeywordCompletion(provider: RelationalProvider): CompletionSource {
  const source = keywordCompletionSource(dialects[provider], true);
  return (context) => {
    const position = completionPosition(context, provider);
    return position && !position.qualifier.length ? source(context) : null;
  };
}
export function quoteCompletionIdentifier(
  name: string,
  provider: RelationalProvider,
  force = false,
): string {
  let keywords = keywordSets.get(provider);
  if (!keywords) {
    keywords = new Set((dialects[provider].spec.keywords ?? '').toLowerCase().split(/\s+/));
    keywordSets.set(provider, keywords);
  }
  if (!force && /^[a-z_][a-z0-9_$]*$/.test(name) && !keywords.has(name.toLowerCase())) return name;
  return sqlSemanticDialectFor({ provider }).quoteIdentifier(name);
}
function scopeKey(schema: string, table: string): string {
  return JSON.stringify([schema, table]);
}
/** DBX's lazy table/column metadata and completion epoch, owned by one Fouc session. */
export class SqlMetadataCompletion {
  private readonly listeners = new Set<() => void>();
  private readonly tables = new Map<string, Promise<DatabaseObjectInfo[]>>();
  private readonly columns = new Map<string, Promise<DatabaseColumnInfo[]>>();
  private abort = new AbortController();
  private epoch = 0;
  private reading = 0;
  private readonly waiting: Array<() => void> = [];
  private state: SqlMetadataState = { pending: 0, error: '' };
  constructor(
    private readonly provider: RelationalProvider,
    private readonly transport: SqlMetadataTransport,
  ) {}
  getSnapshot = (): SqlMetadataState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(update: Partial<SqlMetadataState>): void {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener();
  }
  clear(): void {
    this.epoch++;
    this.abort.abort();
    this.abort = new AbortController();
    this.tables.clear();
    this.columns.clear();
    this.publish({ pending: 0, error: '' });
  }
  private async read<T>(
    read: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    signal.throwIfAborted();
    if (this.reading < 4) this.reading++;
    else
      await new Promise<void>((resolve, reject) => {
        const grant = () => {
          signal.removeEventListener('abort', cancel);
          this.reading++;
          resolve();
        };
        const cancel = () => {
          const index = this.waiting.indexOf(grant);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(signal.reason);
        };
        signal.addEventListener('abort', cancel, { once: true });
        this.waiting.push(grant);
      });
    try {
      signal.throwIfAborted();
      return await read(signal);
    } finally {
      this.reading--;
      this.waiting.shift()?.();
    }
  }
  private cached<T>(
    cache: Map<string, Promise<T>>,
    key: string,
    read: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const existing = cache.get(key);
    if (existing) return existing;
    const epoch = this.epoch,
      signal = this.abort.signal;
    this.publish({ pending: this.state.pending + 1, error: '' });
    const request = Promise.resolve()
      .then(() => this.read(read, signal))
      .catch((reason) => {
        if (epoch === this.epoch) {
          cache.delete(key);
          this.publish({
            error: uiFailure(reason),
          });
        }
        throw reason;
      })
      .finally(() => {
        if (epoch === this.epoch) this.publish({ pending: Math.max(0, this.state.pending - 1) });
      });
    cache.set(key, request);
    return request;
  }
  private tableList(schema: string): Promise<DatabaseObjectInfo[]> {
    return this.cached(this.tables, schema, (signal) => this.transport.tables(schema, signal));
  }
  private columnList(schema: string, table: string): Promise<DatabaseColumnInfo[]> {
    return this.cached(this.columns, scopeKey(schema, table), (signal) =>
      this.transport.columns(schema, table, signal),
    );
  }
  async complete(
    context: CompletionContext,
    target: SqlMetadataTarget,
    locale?: Locale,
  ): Promise<CompletionResult | null> {
    const tConnector = createTranslator(connectorMessages, locale);
    const position = completionPosition(context, this.provider);
    if (
      !position ||
      !target.schema ||
      (!context.explicit && !position.prefix && !position.qualifier.length)
    )
      return null;
    const epoch = this.epoch,
      active = () => epoch === this.epoch && !context.aborted;
    const options: Completion[] = [];
    const add = (
      name: string,
      type: string,
      detail: string,
      insert = quoteCompletionIdentifier(name, this.provider, position.quoted),
      info?: string,
    ) => {
      options.push({
        label: name,
        type,
        detail,
        apply: insert,
        ...(info ? { info } : {}),
        boost: type === 'property' ? 2 : 1,
      });
    };
    const dialect = sqlSemanticDialectFor({ provider: this.provider });
    const exact = (names: readonly string[], name: string) =>
      names.find((candidate) => dialect.sameIdentifier(candidate, name));
    const resolver = new SqlSourceColumnResolver(
      position.model,
      async (source) => {
        const schema = exact(target.schemas, source.qualifierParts.at(-1) ?? target.schema);
        if (!schema) return [];
        const table = (await this.tableList(schema)).find((item) =>
          exact([item.name], source.name),
        );
        return table && active()
          ? (await this.columnList(schema, table.name)).map((column) => ({
              ...column,
              origin: [schema, table.name, column.name].join('.'),
            }))
          : [];
      },
      active,
    );
    try {
      const qualified = position.qualifier.at(-1);
      const alias =
        qualified && !position.tableContext
          ? position.references.findLast((ref) => exact([ref.alias ?? ref.table], qualified))
          : undefined;
      const schemaName = qualified && !alias ? exact(target.schemas, qualified) : undefined;
      if (position.qualifier.length > 2) return null;
      if (position.qualifier.length === 2) {
        const schema = exact(target.schemas, position.qualifier[0]);
        if (!schema || position.tableContext) return null;
        const tables = await this.tableList(schema),
          table = tables.find((item) => exact([item.name], qualified!));
        if (!active() || !table) return null;
        for (const column of await this.columnList(schema, table.name))
          add(column.name, 'property', column.dataType, undefined, column.comment ?? undefined);
      } else if (qualified && !schemaName && !alias) {
        if (exact(position.virtualTables, qualified)) return null;
        const tables = await this.tableList(target.schema);
        const table = tables.find((item) => exact([item.name], qualified));
        if (!active() || !table) return null;
        for (const column of await this.columnList(target.schema, table.name))
          add(column.name, 'property', column.dataType, undefined, column.comment ?? undefined);
      } else if (alias) {
        for (const column of await resolver.resolve(alias.source))
          add(
            column.name,
            'property',
            `${alias.alias ?? alias.table} · ${column.dataType}`,
            undefined,
            [
              column.origin ? tConnector('source', { p0: String(column.origin) }) : '',
              column.comment,
            ]
              .filter(Boolean)
              .join('\n') || undefined,
          );
      } else {
        const schema = schemaName ?? target.schema;
        const tables = await this.tableList(schema);
        if (!active()) return null;
        if (!qualified)
          for (const name of target.schemas)
            add(name, 'namespace', this.provider === 'mysql' ? tConnector('database') : 'Schema');
        if (!qualified)
          for (const name of position.virtualTables)
            add(name, 'class', tConnector('cteCurrentStatement'));
        for (const table of tables)
          if (qualified || !exact(position.virtualTables, table.name))
            add(
              table.name,
              'class',
              `${schema} · ${table.kind === 'view' ? tConnector('view') : tConnector('table')}`,
              undefined,
              table.comment ?? undefined,
            );
        if (!position.tableContext && !qualified) {
          const groups: {
            ref: (typeof position.references)[number];
            columns: SqlSourceColumn[];
          }[] = [];
          // Read only referenced, existing objects. Four workers avoid flooding a large schema.
          const refs = position.references;
          let index = 0;
          await Promise.all(
            Array.from({ length: Math.min(4, refs.length) }, async () => {
              while (index < refs.length && active()) {
                const ref = refs[index++];
                groups.push({ ref, columns: await resolver.resolve(ref.source) });
              }
            }),
          );
          const counts = new Map<string, number>();
          for (const group of groups)
            for (const column of group.columns) {
              const key = dialect.columnKey(column.name);
              counts.set(key, (counts.get(key) ?? 0) + 1);
            }
          for (const { ref, columns } of groups.sort((a, b) => a.ref.from - b.ref.from))
            for (const column of columns) {
              const source = ref.alias ?? (ref.schema ? `${ref.schema}.${ref.table}` : ref.table),
                name = quoteCompletionIdentifier(column.name, this.provider, position.quoted);
              const qualifier = ref.alias
                ? quoteCompletionIdentifier(ref.alias, this.provider)
                : [ref.schema, ref.table]
                    .filter((part): part is string => part !== null)
                    .map((part) => quoteCompletionIdentifier(part, this.provider))
                    .join('.');
              const insert =
                counts.get(dialect.columnKey(column.name))! > 1 ? `${qualifier}.${name}` : name;
              add(
                column.name,
                'property',
                `${source} · ${column.dataType}${column.isPrimaryKey ? tConnector('primaryKey') : ''}`,
                insert,
                column.comment ?? undefined,
              );
            }
          for (const name of visibleProjectionAliases(position.model))
            if (!counts.has(dialect.columnKey(name)))
              add(name, 'property', tConnector('resultAliasExpression'));
        }
      }
      if (!active()) return null;
      if (!options.length) return null;
      return {
        from: position.from,
        to: position.to,
        options,
        validFor: position.quoted
          ? (text) => {
              const tokens = tokenizeSqlSemantic(text, this.provider);
              return (
                tokens.length === 1 &&
                tokens[0].kind === 'quoted_identifier' &&
                tokens[0].span.start === 0 &&
                tokens[0].span.end === text.length
              );
            }
          : /^[\p{L}\p{N}\p{M}_$@]*$/u,
      };
    } catch {
      return null;
    }
  }
}
