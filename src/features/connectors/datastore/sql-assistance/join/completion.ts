import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { DatabaseObjectInfo, RelationalProvider, RelationalTableStructure, SqlFormatterCase } from '@fouc/shared';
import { sameSqlJoinIdentifier, sameSqlJoinTable, sqlJoinRelationships, sqlJoinTableKey, type SqlJoinTable } from '@fouc/shared/sql-join';
import type { SqlMetadataState, SqlMetadataTarget } from '../../sql-metadata-completion';
import { sqlJoinContext } from './context';
import { sqlJoinItems, type SqlJoinBoundReference } from './items';

export const SQL_JOIN_CANDIDATE_LIMIT = 24;
export interface SqlJoinTransport {
  tables: (schema: string, signal: AbortSignal) => Promise<DatabaseObjectInfo[]>;
  structure: (schema: string, table: string, signal: AbortSignal) => Promise<RelationalTableStructure>;
}

/** One workspace/session owns this cache; refresh and document changes cancel real reads. */
export class SqlJoinCompletion {
  private readonly structures = new Map<string, RelationalTableStructure>();
  private readonly tables = new Map<string, DatabaseObjectInfo[]>();
  private readonly requests = new Set<AbortController>();
  private readonly listeners = new Set<() => void>();
  private epoch = 0;
  private state: SqlMetadataState = { pending: 0, error: '' };
  constructor(private readonly provider: RelationalProvider, private readonly transport: SqlJoinTransport) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<SqlMetadataState>): void { this.state = { ...this.state, ...update }; for (const listener of this.listeners) listener(); }
  clear(): void {
    this.epoch++;
    for (const request of this.requests) request.abort();
    this.requests.clear(); this.structures.clear(); this.tables.clear();
    this.publish({ pending: 0, error: '' });
  }
  private async tableList(schema: string, signal: AbortSignal): Promise<DatabaseObjectInfo[]> {
    signal.throwIfAborted();
    const cached = this.tables.get(schema);
    if (cached) return cached;
    const value = await this.transport.tables(schema, signal);
    signal.throwIfAborted();
    if (this.tables.size >= 8) this.tables.delete(this.tables.keys().next().value!);
    this.tables.set(schema, value);
    return value;
  }
  private async structure(table: SqlJoinTable, signal: AbortSignal): Promise<RelationalTableStructure> {
    signal.throwIfAborted();
    const key = sqlJoinTableKey(table), cached = this.structures.get(key);
    if (cached) return cached;
    const value = await this.transport.structure(table.schema, table.table, signal);
    signal.throwIfAborted();
    if (value.provider !== this.provider || value.schema !== table.schema || value.table !== table.table || value.columns.length > 5000 || value.foreignKeys.length > 500) throw new Error('外键结构返回了不同目标或超过辅助读取上限');
    if (this.structures.size >= 128) this.structures.delete(this.structures.keys().next().value!);
    this.structures.set(key, value);
    return value;
  }
  async complete(context: CompletionContext, target: SqlMetadataTarget, casing: SqlFormatterCase = 'upper'): Promise<CompletionResult | null> {
    const intent = sqlJoinContext(context, this.provider);
    if (!intent || !target.schema || !context.explicit && !intent.prefix) return null;
    const controller = new AbortController(), epoch = this.epoch;
    context.addEventListener('abort', () => controller.abort(), { onDocChange: true });
    this.requests.add(controller); this.publish({ pending: this.state.pending + 1, error: '' });
    const signal = controller.signal;
    const active = () => epoch === this.epoch && !signal.aborted && !context.aborted;
    const references: SqlJoinBoundReference[] = [];
    const structures: RelationalTableStructure[] = [];
    const read = async (tables: readonly SqlJoinTable[], tolerateErrors = false) => {
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(4, tables.length) }, async () => {
        while (index < tables.length && active()) {
          const table = tables[index++];
          try { const value = await this.structure(table, signal); if (active() && !structures.includes(value)) structures.push(value); }
          catch (reason) { if (!tolerateErrors || signal.aborted) throw reason; if (active()) this.publish({ error: reason instanceof Error ? reason.message : String(reason) }); }
        }
      }));
    };
    try {
      for (const reference of intent.references) {
        const schema = target.schemas.find(name => sameSqlJoinIdentifier(name, reference.schema ?? target.schema, this.provider));
        if (!schema) continue;
        references.push({ schema, table: reference.table, alias: reference.alias, reference });
      }
      await read(references);
      if (!active() || !references.length) return null;
      let coverage = '仅检查当前查询块中已引用的表。';
      if (intent.mode === 'table' || intent.mode === 'join') {
        const schema = intent.position.qualifier[0] ?? target.schema;
        const authorized = target.schemas.find(name => sameSqlJoinIdentifier(name, schema, this.provider));
        if (!authorized) return null;
        const outgoing = sqlJoinRelationships(structures, this.provider).map(relation => relation.referenced)
          .filter(table => target.schemas.some(name => sameSqlJoinIdentifier(name, table.schema, this.provider)));
        const catalog = (await this.tableList(authorized, signal)).filter(table => table.kind === 'table' &&
          (intent.mode !== 'table' || !intent.prefix || table.name.toLowerCase().startsWith(intent.prefix.toLowerCase())));
        const candidates = new Map<string, SqlJoinTable>();
        for (const table of [...outgoing, ...catalog.map(item => ({ schema: authorized, table: item.name }))]) candidates.set(sqlJoinTableKey(table), table);
        const bounded = [...candidates.values()].slice(0, SQL_JOIN_CANDIDATE_LIMIT);
        await read(bounded, true);
        coverage = `当前 Schema 候选及已引用表的外键目标：检查 ${bounded.length} 张候选表，单次上限 ${SQL_JOIN_CANDIDATE_LIMIT}；未加载的反向关系不推测。`;
      }
      if (!active()) return null;
      const relationships = sqlJoinRelationships(structures, this.provider).filter(relation =>
        structures.some(table => sameSqlJoinTable({ schema: table.schema, table: table.table }, relation.owner, this.provider)) &&
        structures.some(table => sameSqlJoinTable({ schema: table.schema, table: table.table }, relation.referenced, this.provider)));
      const options = sqlJoinItems(intent, references, relationships, this.provider, casing, coverage);
      return options.length ? { from: intent.from, to: intent.to, options } : null;
    } catch (reason) {
      if (active()) this.publish({ error: reason instanceof Error ? reason.message : String(reason) });
      return null;
    } finally {
      controller.abort();
      this.requests.delete(controller);
      if (epoch === this.epoch) this.publish({ pending: Math.max(0, this.state.pending - 1) });
    }
  }
}

export function mergeSqlJoinCompletion(ordinary: CompletionResult | null, join: CompletionResult | null): CompletionResult | null {
  if (!join) return ordinary;
  if (!ordinary || ordinary.from !== join.from || ordinary.to !== join.to) return join;
  const relatedTables = new Set(join.options.filter(item => item.detail?.startsWith('引用目标') || item.detail?.startsWith('被引用表')).map(item => item.label));
  return { ...join, options: [...join.options, ...ordinary.options.filter(item => item.type !== 'class' || !relatedTables.has(item.label))] };
}
