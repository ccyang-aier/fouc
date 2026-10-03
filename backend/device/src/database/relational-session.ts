import { DatabaseInputError } from './input-error';
import { compileSqlTemplate, sqlSourceEnd, sqlSourcePosition, sqlVariableContext, stripSqlVariableDeclarations, splitSqlExecutionRanges, type SqlTemplateInput } from '@fouc/shared';
import { SqlExecutionRegistry, sqlExecutionError } from './sql-execution-registry';
import { explainSqlPlan } from './sql-explain';
import {
  DATABASE_CAPABILITIES,
  SQL_FILE_MAX_BYTES,
  type DatabaseCapabilities,
  type DatabaseColumnInfo,
  type DatabaseObjectInfo,
  type DatabaseQueryResult,
  type RelationalTablePage,
  type RelationalTableQueryPreview,
  type RelationalTableStructure,
  type RelationalConnectInput,
  type RelationalSession,
  type RelationalSavePreview,
  type RelationalSaveResult,
  type SqlHistoryEntry,
} from '@fouc/shared';
import { getDatabaseDriver } from '@fouc/shared/database-catalog';
import { DatabaseCapabilityRegistry } from './capability-registry';
import { connectPostgres } from './drivers/postgres';
import { connectSqlite } from './drivers/sqlite';
import { connectMysql } from './drivers/mysql';
import { assertMysqlReadOnlySql } from './mysql-read-only-sql';
import type { RelationalDriver } from './drivers/relational-driver';
import { assertRelationalReadSql } from './relational-sql';
import {
  columnSignature,
  executeSave,
  prepareSave,
  saveInput,
  type SavePlan,
} from './relational-save';
import { compileTableQuery, tableQueryInput } from './relational-table-query';
import { RelationalSqlRepository } from './sql-library-repository';

type Entry = {
  session: RelationalSession;
  driver: RelationalDriver;
  plans: Map<string, SavePlan>;
  saving: boolean;
  connectionName: string;
};
export class RelationalSessionManager {
  private executions = new SqlExecutionRegistry();
  private readonly entries = new Map<string, Entry>();
  private readonly transientSql = new RelationalSqlRepository();
  constructor(private readonly capabilities: DatabaseCapabilityRegistry, readonly sqlRepository = new RelationalSqlRepository()) {}

  async connect(workspaceId: string, value: unknown, connection: { id: string; name: string } | null = null): Promise<RelationalSession> {
    if (!workspaceId.trim() || workspaceId.length > 128)
      throw new DatabaseInputError('工作空间无效');
    if (!value || typeof value !== 'object') throw new DatabaseInputError('连接参数无效');
    const input = value as RelationalConnectInput;
    if (input.provider === 'postgres' || input.provider === 'mysql') {
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
        (input.provider === 'postgres' && !input.database.trim()) ||
        (input.ssl !== undefined && typeof input.ssl !== 'boolean')
      ) {
        throw new DatabaseInputError('主机、端口、用户、密码或数据库无效');
      }
    } else if (input.provider !== 'sqlite' || typeof input.path !== 'string' || !input.path.trim())
      throw new DatabaseInputError('请选择有效数据源');
    const driver = await (input.provider === 'postgres'
      ? connectPostgres(input)
      : input.provider === 'mysql'
        ? connectMysql(input)
        : connectSqlite(input));
    const id = crypto.randomUUID();
    try {
      await driver.schemas();
      const observed = Object.fromEntries(
        DATABASE_CAPABILITIES.map((key) => [
          key,
          key === 'metadataBrowse' || key === 'queryExecution' || key === 'sqlExplain',
        ]),
      ) as DatabaseCapabilities;
      this.capabilities.begin(id, id);
      const snapshot = this.capabilities.confirm(id, id, this.nativeCapabilities(input.provider), observed, {
        readOnly: true,
        production: false,
      })!;
      const session: RelationalSession = {
        id,
        connectionId: connection?.id ?? null,
        workspaceId,
        provider: input.provider,
        database: input.provider === 'sqlite' ? input.path : input.database,
        info: driver.info,
        capabilities: snapshot,
      };
      this.entries.set(id, {
        session,
        driver,
        plans: new Map(),
        saving: false,
        connectionName: connection?.name ?? `${input.provider} · ${session.database}`,
      });
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
  private nativeCapabilities(provider: RelationalSession['provider']): DatabaseCapabilities {
    // The reference catalog describes DBX; Fouc also implements native SQLite QUERY PLAN.
    return { ...getDatabaseDriver(provider)!.capabilities, sqlExplain: true };
  }
  details(workspaceId: string, id: string): RelationalSession {
    return this.entry(workspaceId, id).session;
  }
  setWriteAccess(workspaceId: string, id: string, enabled: boolean): RelationalSession {
    const entry = this.entry(workspaceId, id);
    if (entry.saving) throw new DatabaseInputError('请等待当前事务结束');
    const observed = Object.fromEntries(
      DATABASE_CAPABILITIES.map((key) => [
        key,
        key === 'metadataBrowse' ||
          key === 'queryExecution' || key === 'sqlExplain' ||
          (enabled && key === 'tableDataEdit'),
      ]),
    ) as DatabaseCapabilities;
    const snapshot = this.capabilities.confirm(
      id,
      id,
      this.nativeCapabilities(entry.session.provider),
      observed,
      { readOnly: !enabled, production: false },
    )!;
    entry.session = { ...entry.session, capabilities: snapshot };
    entry.plans.clear();
    return entry.session;
  }
  private writable(workspaceId: string, id: string): Entry {
    const entry = this.entry(workspaceId, id);
    if (
      entry.session.capabilities.restrictions.readOnly ||
      !entry.session.capabilities.capabilities.tableDataEdit
    )
      throw new DatabaseInputError('当前会话只读，请先解锁表格写入');
    return entry;
  }
  async prepare(workspaceId: string, id: string, value: unknown): Promise<RelationalSavePreview> {
    const entry = this.writable(workspaceId, id);
    const input = saveInput(value);
    await entry.driver.assertEditable(input.schema, input.table);
    const columns = await entry.driver.columns(input.schema, input.table);
    if (!columns.length) throw new DatabaseInputError('无法读取目标字段');
    const plan = prepareSave(input, columns, entry.session.provider, entry.driver.quoteIdentifier);
    // A disconnect/lock during metadata loading must invalidate this request.
    if (this.writable(workspaceId, id) !== entry)
      throw new DatabaseInputError('会话已变化，请重新预览');
    for (const [key, item] of entry.plans)
      if (item.preview.expiresAt <= Date.now()) entry.plans.delete(key);
    if (entry.plans.size >= 20) throw new DatabaseInputError('未提交的预览过多，请关闭预览后重试');
    entry.plans.set(plan.preview.id, plan);
    return plan.preview;
  }
  discard(workspaceId: string, id: string, planId: string): void {
    this.entry(workspaceId, id).plans.delete(planId);
  }
  async commit(workspaceId: string, id: string, planId: string): Promise<RelationalSaveResult> {
    const entry = this.writable(workspaceId, id);
    const plan = entry.plans.get(planId);
    if (!plan || plan.preview.expiresAt <= Date.now())
      throw new DatabaseInputError('预览已失效，请重新生成');
    if (entry.saving) throw new DatabaseInputError('当前连接正在提交变更');
    entry.plans.delete(planId);
    entry.saving = true;
    const start = performance.now();
    try {
      const { schema, table } = plan.preview;
      await entry.driver.assertEditable(schema, table);
      if (columnSignature(await entry.driver.columns(schema, table)) !== plan.columnSignature)
        throw new DatabaseInputError('表结构已变化，请刷新后重新编辑');
      const affectedRows = await entry.driver.transaction(schema, (transaction) =>
        executeSave(plan, transaction),
      );
      return {
        affectedRows,
        executionTimeMs: Math.round(performance.now() - start),
      };
    } finally {
      entry.saving = false;
    }
  }

  async schemas(workspaceId: string, id: string): Promise<string[]> {
    return this.entry(workspaceId, id).driver.schemas();
  }
  async tables(workspaceId: string, id: string, schema: string): Promise<DatabaseObjectInfo[]> {
    const { session, driver } = this.entry(workspaceId, id);
    return (await driver.tables(schema)).map((table) => ({
      ...table,
      database: session.provider === 'mysql' ? schema : session.database,
      connectionId: id,
    }));
  }
  async columns(workspaceId: string, id: string, schema: string, table: string): Promise<DatabaseColumnInfo[]> {
    const columns = await this.entry(workspaceId, id).driver.columns(schema, table);
    if (!columns.length) throw new DatabaseInputError('对象不存在或当前账号无权读取字段');
    return columns;
  }
  async structure(
    workspaceId: string,
    id: string,
    schema: string,
    table: string,
  ): Promise<RelationalTableStructure> {
    const { session, driver } = this.entry(workspaceId, id);
    const columns = await driver.columns(schema, table);
    if (!columns.length) throw new DatabaseInputError('对象不存在或当前账号无权读取字段');
    return {
      ...(await driver.structure(schema, table, columns)),
      connectionId: id,
      provider: session.provider,
      columns,
    };
  }
  private async planPage(
    workspaceId: string,
    id: string,
    schema: string,
    table: string,
    offset = 0,
    limit = 100,
    queryValue: unknown = { filter: null, sort: [] },
  ) {
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
    const query = tableQueryInput(queryValue);
    const compiled = compileTableQuery(
      session.provider,
      schema,
      table,
      columns,
      query,
      offset,
      limit,
      driver.quoteIdentifier,
    );
    return { session, driver, query, columns, compiled };
  }
  async previewPage(
    workspaceId: string,
    id: string,
    schema: string,
    table: string,
    offset = 0,
    limit = 100,
    queryValue: unknown = { filter: null, sort: [] },
  ): Promise<RelationalTableQueryPreview> {
    const { query, compiled } = await this.planPage(
      workspaceId,
      id,
      schema,
      table,
      offset,
      limit,
      queryValue,
    );
    return {
      query,
      statement: { sql: compiled.sql, parameters: compiled.displayParameters },
      stableOrder: compiled.stableOrder,
    };
  }
  async page(
    workspaceId: string,
    id: string,
    schema: string,
    table: string,
    offset = 0,
    limit = 100,
    queryValue: unknown = { filter: null, sort: [] },
  ): Promise<RelationalTablePage> {
    const { session, driver, query, columns, compiled } = await this.planPage(
      workspaceId,
      id,
      schema,
      table,
      offset,
      limit,
      queryValue,
    );
    const result = await driver.read(compiled.sql, schema, limit, compiled.parameters);
    return {
      connectionId: id,
      database: session.provider === 'mysql' ? schema : session.database,
      table,
      columns,
      rows: result.rows,
      offset,
      limit,
      hasMore: result.hasMore,
      query,
      statement: { sql: compiled.sql, parameters: compiled.displayParameters },
      stableOrder: compiled.stableOrder,
    };
  }
  async query(
    workspaceId: string,
    id: string,
    sql: unknown,
    schema: string | null,
    maxRows = 500,
    signal?: AbortSignal,
    sourceSql?: string,
  ): Promise<DatabaseQueryResult> {
    if (
      !Number.isInteger(maxRows) ||
      maxRows < 1 ||
      maxRows > 5000 ||
      (schema !== null && typeof schema !== 'string')
    )
      throw new DatabaseInputError('查询参数无效');
    const { driver, session } = this.entry(workspaceId, id);
    const statement =
      session.provider === 'mysql'
        ? assertMysqlReadOnlySql(sql as string)
        : assertRelationalReadSql(sql, session.provider);
    const entry = this.entry(workspaceId, id), start = performance.now(), executedAt = Date.now();
    const record = (success: boolean, error: string | null, rowCount: number, truncated: boolean) => {
      if (this.entries.get(id) !== entry) return;
      const history: SqlHistoryEntry = { id: crypto.randomUUID(), connectionId: session.connectionId ?? session.id,
        connectionName: entry.connectionName, provider: session.provider, database: session.provider === 'mysql' ? schema ?? session.database : session.database,
        schema, sql: sourceSql ?? sql as string, executedAt, executionTimeMs: Math.round(performance.now() - start), success,
        error: error === null ? null : error.slice(0, 16384), rowCount, truncated };
      try { this.historyRepository(entry).append(workspaceId, history); }
      catch (reason) { return `查询历史保存失败：${reason instanceof Error ? reason.message : String(reason)}`; }
    };
    let result;
    try { result = await driver.read(statement, schema, maxRows, [], signal); }
    catch (error) { record(false, error instanceof Error ? error.message : String(error), 0, false); throw error; }
    const historyWarning = record(true, null, result.rows.length, result.hasMore);
    return {
      ...result,
      columnSortables: result.columns.map(() => false),
      affectedRows: 0,
      executionTimeMs: Math.round(performance.now() - start),
      truncated: result.hasMore,
      sessionId: null,
      messages: historyWarning ? [{ severity: 'warning', message: historyWarning }] : [],
    };
  }
  private historyRepository(entry: Entry): RelationalSqlRepository { return entry.session.connectionId ? this.sqlRepository : this.transientSql; }
  async explain(workspaceId: string, id: string, value: unknown, signal?: AbortSignal): Promise<DatabaseQueryResult> {
    const entry = this.entry(workspaceId, id), start = performance.now();
    const plan = await explainSqlPlan(entry.driver, entry.session.provider, value, signal);
    this.entry(workspaceId, id);
    return { columns: plan.columns, columnTypes: plan.columnTypes, rows: plan.rows, hasMore: plan.hasMore,
      columnSortables: plan.columns.map(() => false), affectedRows: 0, executionTimeMs: Math.round(performance.now() - start),
      truncated: plan.hasMore, sessionId: null, messages: plan.warnings.map((message) => ({ severity: 'warning', message })) };
  }
  startExecution(workspaceId: string, id: string, value: unknown) {
    const { session } = this.entry(workspaceId, id);
    const input = value as { sql?: unknown; schema?: unknown; maxRows?: unknown; offset?: unknown; parameters?: unknown; declarationSql?: unknown } | null;
    if (!input || typeof input.sql !== 'string' || Buffer.byteLength(input.sql, 'utf8') > 1_000_000 ||
      input.schema !== null && typeof input.schema !== 'string' ||
      !Number.isInteger(input.maxRows ?? 500) || Number(input.maxRows ?? 500) < 1 || Number(input.maxRows ?? 500) > 5000 ||
      !Number.isInteger(input.offset ?? 0) || Number(input.offset ?? 0) < 0 || Number(input.offset ?? 0) + input.sql.length > SQL_FILE_MAX_BYTES ||
      input.declarationSql !== undefined && (typeof input.declarationSql !== 'string' || Buffer.byteLength(input.declarationSql, 'utf8') > 1_000_000) ||
      input.parameters !== undefined && (!input.parameters || typeof input.parameters !== 'object' || Array.isArray(input.parameters)))
      throw new DatabaseInputError('查询执行参数无效');
    const sql = input.sql, schema = input.schema as string | null, maxRows = Number(input.maxRows ?? 500), offset = Number(input.offset ?? 0);
    let compiled;
    try { compiled = compileSqlTemplate(sql, session.provider, input as SqlTemplateInput); }
    catch (reason) { throw new DatabaseInputError(reason instanceof Error ? reason.message : String(reason)); }
    if (Buffer.byteLength(compiled.sql, 'utf8') > 1_000_000) throw new DatabaseInputError('展开后的 SQL 超过 1 MB');
    const ranges = splitSqlExecutionRanges(compiled.sql, session.provider);
    if (!ranges.length || ranges.length > 50) throw new DatabaseInputError('每次执行须包含 1 至 50 条语句');
    // Validate the entire batch before any statement runs; the drivers also enforce read isolation.
    for (const range of ranges) session.provider === 'mysql' ? assertMysqlReadOnlySql(range.sql) : assertRelationalReadSql(range.sql, session.provider);
    const originals = ranges.map((range) => {
      const from = sqlSourcePosition(compiled, range.from), to = sqlSourceEnd(compiled, range.to);
      return { sql: sql.slice(from, to), from: from + offset, to: to + offset };
    });
    const context = sqlVariableContext(typeof input.declarationSql === 'string' ? input.declarationSql : sql, session.provider);
    return this.executions.start(workspaceId, id, session.provider === 'mysql' ? schema ?? session.database : session.database, schema, originals,
      (statement, signal, index) => this.query(workspaceId, id, ranges[index].sql, schema, maxRows, signal, context ? `${context}\n${stripSqlVariableDeclarations(statement, session.provider)}` : statement),
      (reason, index) => {
        const error = sqlExecutionError(reason);
        if (error.position !== null) error.position = Math.max(0, sqlSourcePosition(compiled, ranges[index].from + error.position) + offset - originals[index].from);
        return error;
      });
  }
  execution(workspaceId: string, id: string, executionId: string, revision: number) {
    this.entry(workspaceId, id);
    return this.executions.poll(workspaceId, id, executionId, revision);
  }
  cancelExecution(workspaceId: string, id: string, executionId: string) {
    this.entry(workspaceId, id);
    return this.executions.cancel(workspaceId, id, executionId);
  }
  historySearch(workspaceId: string, id: string, value: unknown) {
    const entry = this.entry(workspaceId, id); return this.historyRepository(entry).search(workspaceId, value, entry.session.connectionId ?? id);
  }
  historyEntry(workspaceId: string, id: string, historyId: string) {
    const entry = this.entry(workspaceId, id); return this.historyRepository(entry).history(workspaceId, historyId, entry.session.connectionId ?? id);
  }
  deleteHistory(workspaceId: string, id: string, historyId: string) {
    const entry = this.entry(workspaceId, id); this.historyRepository(entry).deleteHistory(workspaceId, historyId, entry.session.connectionId ?? id);
  }
  clearHistory(workspaceId: string, id: string) {
    const entry = this.entry(workspaceId, id); this.historyRepository(entry).clearHistory(workspaceId, entry.session.connectionId ?? id);
  }
  editorPreferences(workspaceId: string, id: string) {
    const entry = this.entry(workspaceId, id); return this.historyRepository(entry).editorPreferences(workspaceId, entry.session.connectionId ?? id);
  }
  saveEditorPreferences(workspaceId: string, id: string, value: unknown) {
    const entry = this.entry(workspaceId, id); return this.historyRepository(entry).saveEditorPreferences(workspaceId, entry.session.connectionId ?? id, value);
  }
  removeConnection(workspaceId: string, connectionId: string): void {
    for (const entry of this.entries.values()) if (entry.session.workspaceId === workspaceId && entry.session.connectionId === connectionId) {
      void this.disconnect(workspaceId, entry.session.id).catch(() => undefined);
    }
    this.sqlRepository.removeConnection(workspaceId, connectionId);
  }
  async disconnect(workspaceId: string, id: string): Promise<void> {
    const entry = this.entry(workspaceId, id);
    this.entries.delete(id);
    await this.executions.closeSession(id);
    if (!entry.session.connectionId) this.transientSql.removeConnection(workspaceId, id);
    this.capabilities.disconnect(id, id);
    await entry.driver.close();
  }
  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].map(({ session }) =>
        this.disconnect(session.workspaceId, session.id),
      ),
    );
    this.sqlRepository.close();
    this.transientSql.close();
  }
}
