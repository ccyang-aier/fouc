import { DatabaseInputError } from './input-error';
import {
  DATABASE_CAPABILITIES,
  type DatabaseCapabilities,
  type DatabaseObjectInfo,
  type DatabaseQueryResult,
  type DatabaseTablePage,
  type RelationalConnectInput,
  type RelationalSession,
} from '@fouc/shared';
import { getDatabaseDriver } from '@fouc/shared/database-catalog';
import { DatabaseCapabilityRegistry } from './capability-registry';
import { connectPostgres } from './drivers/postgres';
import { connectSqlite } from './drivers/sqlite';
import type { RelationalDriver } from './drivers/relational-driver';
import {
  assertRelationalReadSql,
  quoteRelationalIdentifier as quote,
} from './relational-sql';

type Entry = { session: RelationalSession; driver: RelationalDriver };
export class RelationalSessionManager {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly capabilities: DatabaseCapabilityRegistry) {}

  async connect(workspaceId: string, value: unknown): Promise<RelationalSession> {
    if (!workspaceId.trim() || workspaceId.length > 128) throw new DatabaseInputError('工作空间无效');
    if (!value || typeof value !== 'object') throw new DatabaseInputError('连接参数无效');
    const input = value as RelationalConnectInput;
    if (input.provider === 'postgres') {
      if (
        typeof input.host !== 'string' ||
        !input.host.trim() ||
        !Number.isInteger(input.port) ||
        input.port < 1 ||
        input.port > 65535 ||
        typeof input.username !== 'string' ||
        !input.username.trim() ||
        typeof input.password !== 'string' ||
        typeof input.database !== 'string' ||
        !input.database.trim() ||
        (input.ssl !== undefined && typeof input.ssl !== 'boolean')
      ) {
        throw new DatabaseInputError('主机、端口、用户、密码或数据库无效');
      }
    } else if (input.provider !== 'sqlite' || typeof input.path !== 'string' || !input.path.trim())
      throw new DatabaseInputError('请选择有效数据源');
    const declared = getDatabaseDriver(input.provider)!;
    const driver = await (input.provider === 'postgres' ? connectPostgres(input) : connectSqlite(input));
    const id = crypto.randomUUID();
    try {
      await driver.schemas();
      const observed = Object.fromEntries(
        DATABASE_CAPABILITIES.map((key) => [key, key === 'metadataBrowse' || key === 'queryExecution']),
      ) as DatabaseCapabilities;
      this.capabilities.begin(id, id);
      const snapshot = this.capabilities.confirm(id, id, declared.capabilities, observed, {
        readOnly: true,
        production: false,
      })!;
      const session: RelationalSession = {
        id,
        workspaceId,
        provider: input.provider,
        database: input.provider === 'postgres' ? input.database : input.path,
        info: driver.info,
        capabilities: snapshot,
      };
      this.entries.set(id, { session, driver });
      return session;
    } catch (error) {
      this.capabilities.disconnect(id, id);
      await driver.close();
      throw error;
    }
  }

  private entry(workspaceId: string, id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry || entry.session.workspaceId !== workspaceId)
      throw new DatabaseInputError('当前工作空间中的连接已断开');
    return entry;
  }

  async schemas(workspaceId: string, id: string): Promise<string[]> {
    return this.entry(workspaceId, id).driver.schemas();
  }
  async tables(workspaceId: string, id: string, schema: string): Promise<DatabaseObjectInfo[]> {
    const { session, driver } = this.entry(workspaceId, id);
    return (await driver.tables(schema)).map((table) => ({
      ...table,
      database: session.database,
      connectionId: id,
    }));
  }
  async page(
    workspaceId: string,
    id: string,
    schema: string,
    table: string,
    offset = 0,
    limit = 100,
  ): Promise<DatabaseTablePage> {
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 10_000_000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500
    )
      throw new DatabaseInputError('分页范围无效');
    const { session, driver } = this.entry(workspaceId, id);
    const columns = await driver.columns(schema, table);
    if (!columns.length) throw new DatabaseInputError('对象不存在或当前账号无权读取字段');
    const primary = columns.filter((column) => column.isPrimaryKey);
    const order = primary.length ? ` ORDER BY ${primary.map((column) => quote(column.name)).join(', ')}` : '';
    const result = await driver.read(
      `SELECT * FROM ${quote(schema)}.${quote(table)}${order} LIMIT ${limit + 1} OFFSET ${offset}`,
      schema,
      limit,
    );
    return {
      connectionId: id,
      database: session.database,
      table,
      columns,
      rows: result.rows,
      offset,
      limit,
      hasMore: result.hasMore,
    };
  }
  async query(
    workspaceId: string,
    id: string,
    sql: unknown,
    schema: string | null,
    maxRows = 500,
  ): Promise<DatabaseQueryResult> {
    if (
      !Number.isInteger(maxRows) ||
      maxRows < 1 ||
      maxRows > 5000 ||
      (schema !== null && typeof schema !== 'string')
    )
      throw new DatabaseInputError('查询参数无效');
    const { driver, session } = this.entry(workspaceId, id);
    const statement = assertRelationalReadSql(sql, session.provider);
    const start = performance.now();
    const result = await driver.read(statement, schema, maxRows);
    return {
      ...result,
      columnSortables: result.columns.map(() => false),
      affectedRows: 0,
      executionTimeMs: Math.round(performance.now() - start),
      truncated: result.hasMore,
      sessionId: null,
      messages: [],
    };
  }
  async disconnect(workspaceId: string, id: string): Promise<void> {
    const entry = this.entry(workspaceId, id);
    this.entries.delete(id);
    this.capabilities.disconnect(id, id);
    await entry.driver.close();
  }
  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].map(({ session }) => this.disconnect(session.workspaceId, session.id)),
    );
  }
}
