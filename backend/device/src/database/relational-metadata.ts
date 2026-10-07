import { z } from 'zod';
import {
  emptyDatabaseDocsAnnotations,
  validateDatabaseDocsCollectInput,
} from '@fouc/shared/database-docs';
import type { RelationalSession } from '@fouc/shared';
import type { RelationalDriver } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { DatabaseDocsRepository, collectDatabaseDocs } from './database-docs';
import { loadRelationalDiagram } from './diagram-metadata';
import { searchNativeSchema } from './schema-search';
import { listSchemaObjects, describeSchemaObject, type NativeSchemaObjectAdapter } from './schema-objects';

type MetadataEntry = { session: RelationalSession; driver: RelationalDriver };
const diagramInput = z.object({
  schema: z.string().trim().min(1).max(512),
  tables: z.array(z.string().min(1).max(512)).max(200).optional(),
  maxTables: z.number().int().min(1).max(200).optional(),
  includeViews: z.boolean().optional(),
}).strict();

/** Authorized native metadata and device-owned prose share the session boundary. */
export class RelationalMetadataService {
  constructor(
    private readonly access: (id: string) => MetadataEntry,
    readonly documents = new DatabaseDocsRepository(),
  ) {}

  private check(id: string, entry: MetadataEntry, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (this.access(id) !== entry) throw new DatabaseInputError('元数据读取会话已变化');
  }

  private adapter(id: string): NativeSchemaObjectAdapter {
    const entry = this.access(id);
    return {
      provider: entry.session.provider,
      query: async (sql, parameters, signal) => {
        // Only the catalog module generates SQL; request SQL never enters here.
        const result = await entry.driver.read(sql, null, 10000, [...parameters], signal);
        this.check(id, entry, signal);
        if (result.hasMore) throw new DatabaseInputError('原生目录超过10000行，请缩小范围');
        return result.rows.map(row => Object.fromEntries(result.columns.map((name, index) => [name, row[index]])));
      },
    };
  }

  objects(id: string, value: unknown, signal?: AbortSignal) {
    return listSchemaObjects(this.adapter(id), value, signal);
  }

  details(id: string, value: unknown, signal?: AbortSignal) {
    return describeSchemaObject(this.adapter(id), value, signal);
  }

  search(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.access(id);
    return searchNativeSchema({
      scopeKey: id,
      provider: entry.session.provider,
      schemas: async probeSignal => {
        const schemas = await entry.driver.schemas();
        this.check(id, entry, probeSignal);
        return schemas;
      },
      tables: async (schema, probeSignal) => {
        const tables = await entry.driver.tables(schema);
        this.check(id, entry, probeSignal);
        return tables.map(table => ({ ...table, connectionId: id, database: entry.session.provider === 'mysql' ? schema : entry.session.database }));
      },
      columns: async (schema, table, probeSignal) => {
        const columns = await entry.driver.columns(schema, table);
        this.check(id, entry, probeSignal);
        return columns;
      },
      schemaObjects: (input, probeSignal) => this.objects(id, input, probeSignal),
    }, value, signal);
  }

  private async approveSchemas(id: string, schemas: string[], signal?: AbortSignal) {
    const entry = this.access(id);
    signal?.throwIfAborted();
    const visible = await entry.driver.schemas();
    this.check(id, entry, signal);
    if (schemas.some(schema => !visible.includes(schema))) throw new DatabaseInputError('读取范围不属于当前连接的可见 Schema');
    return entry;
  }

  async diagram(id: string, value: unknown, signal?: AbortSignal) {
    const parsed = diagramInput.safeParse(value);
    if (!parsed.success) throw new DatabaseInputError('关系图读取范围无效');
    const entry = await this.approveSchemas(id, [parsed.data.schema], signal);
    const result = await loadRelationalDiagram(entry.driver, {
      ...parsed.data,
      provider: entry.session.provider,
      connectionId: entry.session.connectionId ?? id,
    }, { signal });
    this.check(id, entry, signal);
    return result;
  }

  async snapshot(id: string, value: unknown, signal?: AbortSignal) {
    let input;
    try { input = validateDatabaseDocsCollectInput(value); }
    catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    const entry = await this.approveSchemas(id, input.schemas, signal);
    const result = await collectDatabaseDocs({
      provider: entry.session.provider,
      database: entry.session.database,
      listTables: async (schema, probeSignal) => {
        const tables = await entry.driver.tables(schema);
        this.check(id, entry, probeSignal);
        return tables.map(table => ({ ...table, connectionId: id, database: entry.session.provider === 'mysql' ? schema : entry.session.database }));
      },
      structure: async (schema, table, probeSignal) => {
        const columns = await entry.driver.columns(schema, table);
        this.check(id, entry, probeSignal);
        const structure = await entry.driver.structure(schema, table, columns);
        this.check(id, entry, probeSignal);
        return { ...structure, columns, connectionId: entry.session.connectionId ?? id, provider: entry.session.provider };
      },
    }, input, signal);
    this.check(id, entry, signal);
    return result;
  }

  annotations(id: string) {
    const { session } = this.access(id);
    return session.connectionId
      ? this.documents.get(session.connectionId, session.database)
      : { version: null, updatedAt: null, persistent: false, annotations: emptyDatabaseDocsAnnotations() };
  }

  saveAnnotations(id: string, value: unknown) {
    const { session } = this.access(id);
    if (!session.connectionId) throw new DatabaseInputError('请先保存连接再维护持久文档笔记');
    return this.documents.save(session.connectionId, session.database, value);
  }
}
