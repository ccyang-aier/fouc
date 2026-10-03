import type { DatabaseColumnInfo } from '@fouc/shared';
import { sqlSemanticDialectFor } from './dialect';
import type { SqlSemanticCteOutputColumn, SqlSemanticCteStar, SqlSemanticModel, SqlSemanticRowSource } from './types';

export type SqlSourceColumn = Pick<DatabaseColumnInfo, 'name' | 'dataType' | 'comment' | 'isPrimaryKey'> & { origin?: string };
export type SqlSourceMetadata = (source: SqlSemanticRowSource) => Promise<SqlSourceColumn[]>;

/** DBX projection origins/star expansion adapted to the owning native metadata session. */
export class SqlSourceColumnResolver {
  private readonly memo = new Map<SqlSemanticRowSource, Promise<SqlSourceColumn[]>>();
  private readonly dialect;
  constructor(private readonly model: SqlSemanticModel, private readonly read: SqlSourceMetadata, private readonly active: () => boolean) {
    this.dialect = sqlSemanticDialectFor({ provider: model.provider });
  }

  resolve(source: SqlSemanticRowSource): Promise<SqlSourceColumn[]> {
    return this.columns(source, new Set(), 0);
  }

  private columns(source: SqlSemanticRowSource, ancestors: Set<SqlSemanticRowSource>, depth: number): Promise<SqlSourceColumn[]> {
    if (!this.active()) return Promise.resolve([]);
    const definition = source.definitionId ? this.model.rowSources.find((item) => item.id === source.definitionId) : source;
    if (!definition) return Promise.resolve([]);
    if (depth > 8 || ancestors.has(definition)) return Promise.resolve(this.knownNames(definition));
    const existing = this.memo.get(source);
    if (existing) return existing;
    const next = new Set(ancestors).add(definition);
    const request = this.build(source, definition, next, depth);
    this.memo.set(source, request);
    return request;
  }

  private knownNames(source: SqlSemanticRowSource): SqlSourceColumn[] {
    return (source.columnAliases ?? source.columns ?? []).filter(Boolean).map((name) => ({ name, dataType: '表达式', comment: null, isPrimaryKey: false }));
  }

  private async build(reference: SqlSemanticRowSource, definition: SqlSemanticRowSource, ancestors: Set<SqlSemanticRowSource>, depth: number): Promise<SqlSourceColumn[]> {
    if (definition.kind === 'table' || definition.kind === 'mutation_target') {
      const columns = await this.read(definition);
      return this.rename(columns.map((column) => ({ ...column, origin: column.origin ?? [...definition.qualifierParts, definition.name, column.name].join('.') })), reference.columnAliases);
    }
    if (definition.kind === 'table_function') return this.knownNames(definition);
    const outputs = definition.cteOutputs ?? [];
    const stars = definition.cteStars ?? [];
    const sources = definition.bodySources ?? [];
    const shapes: Array<{ position: number; output?: SqlSemanticCteOutputColumn; star?: SqlSemanticCteStar }> = [
      ...outputs.map((output) => ({ position: output.jumpSpan.start, output })),
      ...stars.map((star) => ({ position: star.starSpan.start, star })),
    ].sort((left, right) => left.position - right.position);
    if (!shapes.length) return this.rename(this.knownNames(definition), reference.columnAliases);
    const fields: SqlSourceColumn[] = [];
    for (const shape of shapes) {
      if (!this.active()) return [];
      if (shape.star) {
        const candidates = this.matchSources(sources, shape.star.qualifierParts);
        const expanded = await Promise.all(candidates.map((source) => this.columns(source, ancestors, depth + 1)));
        fields.push(...expanded.flat().map((column) => ({ ...column, isPrimaryKey: false })));
      } else if (shape.output) {
        const output = shape.output;
        let matched: SqlSourceColumn | undefined;
        if (output.origin) {
          const candidates = this.matchSources(sources, output.origin.qualifierParts);
          const groups = await Promise.all(candidates.map((source) => this.columns(source, ancestors, depth + 1)));
          const matches = groups.flat().filter((column) => this.dialect.columnKey(column.name) === this.dialect.columnKey(output.origin!.column));
          if (matches.length === 1) matched = matches[0];
        }
        fields.push({ name: output.name, dataType: matched?.dataType ?? '表达式', comment: matched?.comment ?? null, isPrimaryKey: false, origin: matched?.origin });
      }
    }
    const renamed = this.rename(fields, definition.columnAliases);
    return this.rename(renamed, reference === definition ? undefined : reference.columnAliases).filter((column) => column.name);
  }

  private matchSources(sources: SqlSemanticRowSource[], parts: string[]): SqlSemanticRowSource[] {
    if (!parts.length) return sources;
    return sources.filter((source) => {
      const expected = source.alias ? [source.alias] : [...source.qualifierParts, source.name];
      return parts.length <= expected.length && parts.every((part, index) => this.dialect.sameIdentifier(part, expected[expected.length - parts.length + index]));
    });
  }

  private rename(columns: SqlSourceColumn[], aliases?: string[]): SqlSourceColumn[] {
    if (!aliases?.length) return columns;
    return Array.from({ length: Math.max(columns.length, aliases.length) }, (_, index) => ({
      ...(columns[index] ?? { name: '', dataType: '表达式', comment: null, isPrimaryKey: false }), name: aliases[index] ?? columns[index].name,
    }));
  }
}
