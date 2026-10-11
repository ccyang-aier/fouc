import { DatabaseInputError } from './input-error';
import path from 'node:path';
import { z } from 'zod';
import { tableTransferInputSchema } from '@fouc/shared/table-transfer';
import { TableTransferPlans, transferStructureSignature } from './transfer-plans';
import { prepareTableTransfer } from './transfer-prepare';
import { executeTableTransfer } from './transfer-execute';
import { compileSqlTemplate, sqlSourceEnd, sqlSourcePosition, sqlVariableContext, stripSqlVariableDeclarations, splitSqlExecutionRanges, type SqlTemplateInput } from '@fouc/shared';
import { SqlExecutionRegistry, sqlExecutionError } from './sql-execution-registry';
import { explainSqlPlan } from './sql-explain';
import { TableImportPlans } from './table-import-plans';
import { SqlMutationPlans } from './sql-mutation-plans';
import { StructureEditPlans } from './structure-edit-plans';
import { RelationalMetadataService } from './relational-metadata';
import { DatabaseDocsRepository } from './database-docs-repository';
import { DatabaseExportJobs } from './database-export';
import { RelationalExportService } from './relational-export-service';
import { DatabaseActivityService } from './activity/service';
import { SchemaCreatePlans } from './schema-create-plans';
import { TableCreatePlans } from './table-create-plans';
import { SqliteBackupService } from './sqlite-backup/service';
import { IndexEditPlans } from './index-edit-plans';
import { DatabaseSecurityService } from './security/service';
import { ForeignKeyEditPlans } from './foreign-key-edit-plans';
import { foreignKeyEditRequestSchema } from '@fouc/shared/foreign-key-edit';
import { TableClearPlans } from './table-clear-plans';
import { DatabaseAdminObjectService } from './admin-objects/service';
import {
  DATABASE_CAPABILITIES,
  RELATIONAL_PAGE_LIMITS,
  SQL_FILE_MAX_BYTES,
  type DatabaseCapabilities,
  type DatabaseColumnInfo,
  type DatabaseObjectInfo,
  type DatabaseQueryResult,
  type RelationalTablePage,
  type RelationalTableCount,
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
  imports: TableImportPlans;
  structureEdits: StructureEditPlans;
  sqlMutations: SqlMutationPlans;
  schemaCreates: SchemaCreatePlans;
  tableCreates: TableCreatePlans;
  indexEdits: IndexEditPlans;
  foreignKeyEdits: ForeignKeyEditPlans;
  tableClears: TableClearPlans;
  saving: boolean;
  connectionName: string;
  sourceIdentity: string;
};
export class RelationalSessionManager {
  private executions = new SqlExecutionRegistry();
  private readonly transfers = new TableTransferPlans();
  private readonly entries = new Map<string, Entry>();
  private readonly transientSql = new RelationalSqlRepository();
  readonly metadata: RelationalMetadataService;
  readonly exports: RelationalExportService;
  readonly activity: DatabaseActivityService;
  readonly sqliteBackups: SqliteBackupService;
  readonly security: DatabaseSecurityService;
  readonly adminObjects: DatabaseAdminObjectService;
  constructor(private readonly capabilities: DatabaseCapabilityRegistry, readonly sqlRepository = new RelationalSqlRepository(), documents = new DatabaseDocsRepository(), exports?: DatabaseExportJobs) {
    this.metadata = new RelationalMetadataService((id) => this.entry(id), documents);
    this.exports = new RelationalExportService((id) => this.entry(id), exports);
    this.activity = new DatabaseActivityService((id) => this.entry(id));
    this.sqliteBackups = new SqliteBackupService((id) => this.entry(id).session);
    this.security = new DatabaseSecurityService((id) => this.entry(id));
    this.adminObjects = new DatabaseAdminObjectService((id) => this.entry(id));
  }

  async connect(value: unknown, connection: { id: string; name: string } | null = null): Promise<RelationalSession> {

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
        'ssl' in input || 'tls' in input
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
        provider: input.provider,
        database: input.provider === 'sqlite' ? input.path : input.database,
        info: driver.info,
        capabilities: snapshot,
      };
      this.entries.set(id, {
        session,
        driver,
        plans: new Map(),
        imports: new TableImportPlans(),
        structureEdits: new StructureEditPlans(),
        sqlMutations: new SqlMutationPlans(),
        schemaCreates: new SchemaCreatePlans(),
        tableCreates: new TableCreatePlans(),
        indexEdits: new IndexEditPlans(),
        foreignKeyEdits: new ForeignKeyEditPlans(),
        tableClears: new TableClearPlans(),
        saving: false,
        sourceIdentity: input.provider === 'sqlite' ? JSON.stringify(['sqlite', path.resolve(input.path).toLowerCase()]) : JSON.stringify([input.provider, input.host.toLowerCase(), input.port, input.provider === 'postgres' ? input.database : null]),
        connectionName: connection?.name ?? `${input.provider} · ${session.database}`,
      });
      return session;
    } catch (error) {
      this.capabilities.disconnect(id, id);
      await driver.close();
      throw error;
    }
  }

  private entry(id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry)
      throw new DatabaseInputError('当前会话中的连接已断开');
    return entry;
  }
  private nativeCapabilities(provider: RelationalSession['provider']): DatabaseCapabilities {
    // The reference catalog describes DBX; Fouc also implements native SQLite QUERY PLAN.
    return { ...getDatabaseDriver(provider)!.capabilities, sqlExplain: true };
  }
  details(id: string): RelationalSession {
    return this.entry(id).session;
  }
  setWriteAccess(id: string, enabled: boolean): RelationalSession {
    const entry = this.entry(id);
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
    entry.imports.clear();
    entry.structureEdits.clear();
    entry.sqlMutations.clear();
    if (!enabled) entry.schemaCreates.clear();
    if (!enabled) entry.tableCreates.clear();
    if (!enabled) entry.indexEdits.clear();
    if (!enabled) entry.foreignKeyEdits.clear();
    entry.tableClears.clear();
    this.transfers.clearSession(id);
    return entry.session;
  }
  private writable(id: string): Entry {
    const entry = this.entry(id);
    if (
      entry.session.capabilities.restrictions.readOnly ||
      !entry.session.capabilities.capabilities.tableDataEdit
    )
      throw new DatabaseInputError('当前会话只读，请先解锁表格写入');
    return entry;
  }
  schemaCreateOptions(id: string, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.schemaCreates.options(entry.driver, entry.session.provider, entry.session.database, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请稍后重试。');
    }, signal);
  }
  prepareTableClear(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.tableClears.prepare(entry.driver, entry.session.provider, value, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请重新审查。');
    }, signal);
  }
  discardTableClear(id: string, planId: string): void { this.entry(id).tableClears.discard(planId); }
  async commitTableClear(id: string, planId: string, value: unknown, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('请等待当前事务结束。');
    entry.saving = true;
    try {
      return await entry.tableClears.commit(entry.driver, planId, value, () => {
        if (this.writable(id) !== entry) throw new DatabaseInputError('连接已变化，请重新审查。');
      }, signal);
    } finally { entry.saving = false; }
  }
  foreignKeyEditOptions(id: string, schema: string, table: string, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.foreignKeyEdits.options(entry.driver, entry.session.provider, schema, table, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请稍后重试。');
    }, signal);
  }
  foreignKeyEditTarget(id: string, schema: string, table: string, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.foreignKeyEdits.target(entry.driver, entry.session.provider, schema, table, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请稍后重试。');
    }, signal);
  }
  prepareForeignKeyEdit(id: string, value: unknown, signal?: AbortSignal) {
    const input = foreignKeyEditRequestSchema.safeParse(value);
    if (!input.success) throw new DatabaseInputError(input.error.issues[0]?.message ?? '外键审查请求无效。');
    const entry = this.entry(id);
    return entry.foreignKeyEdits.prepare(entry.driver, entry.session.provider, input.data.schema, input.data.table, input.data.input, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请重新审查。');
    }, signal);
  }
  discardForeignKeyEdit(id: string, planId: string): void { this.entry(id).foreignKeyEdits.discard(planId); }
  async commitForeignKeyEdit(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('请等待当前事务结束。');
    entry.saving = true;
    try {
      return await entry.foreignKeyEdits.commit(entry.driver, planId, () => {
        if (this.writable(id) !== entry) throw new DatabaseInputError('连接已变化，请重新审查。');
      }, signal);
    } finally { entry.saving = false; }
  }
  indexEditOptions(id: string, schema: string, table: string, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.indexEdits.options(entry.driver, entry.session.provider, schema, table, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请稍后重试。');
    }, signal);
  }
  prepareIndexEdit(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.indexEdits.prepare(entry.driver, entry.session.provider, value, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请重新审查。');
    }, signal);
  }
  discardIndexEdit(id: string, planId: string): void { this.entry(id).indexEdits.discard(planId); }
  async commitIndexEdit(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('请等待当前事务结束。');
    entry.saving = true;
    try {
      return await entry.indexEdits.commit(entry.driver, planId, () => {
        if (this.writable(id) !== entry) throw new DatabaseInputError('连接已变化，请重新审查。');
      }, signal);
    } finally { entry.saving = false; }
  }
  tableCreateOptions(id: string, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.tableCreates.options(entry.driver, entry.session.provider, entry.session.database, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请稍后重试。');
    }, signal);
  }
  prepareTableCreate(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.tableCreates.prepare(entry.driver, entry.session.provider, entry.session.database, value, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请重新审查。');
    }, signal);
  }
  discardTableCreate(id: string, planId: string): void { this.entry(id).tableCreates.discard(planId); }
  async commitTableCreate(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('请等待当前事务结束。');
    entry.saving = true;
    try {
      return await entry.tableCreates.commit(entry.driver, planId, () => {
        if (this.writable(id) !== entry) throw new DatabaseInputError('会话已变化，请重新审查。');
      }, signal);
    } finally { entry.saving = false; }
  }
  prepareSchemaCreate(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.schemaCreates.prepare(entry.driver, entry.session.provider, entry.session.database, value, () => {
      if (this.entry(id) !== entry || entry.saving) throw new DatabaseInputError('连接忙或已变化，请重新审查。');
    }, signal);
  }
  discardSchemaCreate(id: string, planId: string): void {
    this.entry(id).schemaCreates.discard(planId);
  }
  async commitSchemaCreate(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('请等待当前事务结束。');
    entry.saving = true;
    try {
      return await entry.schemaCreates.commit(entry.driver, planId, () => {
        if (this.writable(id) !== entry) throw new DatabaseInputError('会话已变化，请重新审查。');
      }, signal);
    } finally { entry.saving = false; }
  }
  async prepare(id: string, value: unknown): Promise<RelationalSavePreview> {
    const entry = this.writable(id);
    const input = saveInput(value);
    await entry.driver.assertEditable(input.schema, input.table);
    const columns = await entry.driver.columns(input.schema, input.table);
    if (!columns.length) throw new DatabaseInputError('无法读取目标字段');
    const plan = prepareSave(input, columns, entry.session.provider, entry.driver.quoteIdentifier);
    // A disconnect/lock during metadata loading must invalidate this request.
    if (this.writable(id) !== entry)
      throw new DatabaseInputError('会话已变化，请重新预览');
    for (const [key, item] of entry.plans)
      if (item.preview.expiresAt <= Date.now()) entry.plans.delete(key);
    if (entry.plans.size >= 20) throw new DatabaseInputError('未提交的预览过多，请关闭预览后重试');
    entry.plans.set(plan.preview.id, plan);
    return plan.preview;
  }
  discard(id: string, planId: string): void {
    this.entry(id).plans.delete(planId);
  }
  prepareImport(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.writable(id);
    return entry.imports.prepare(entry.driver, entry.session.provider, value, () => {
      if (this.writable(id) !== entry || entry.saving) throw new DatabaseInputError('连接正在提交变更，请稍后重新预览。');
    }, signal);
  }
  discardImport(id: string, planId: string) { this.entry(id).imports.discard(planId); }
  prepareSqlMutation(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.entry(id);
    return entry.sqlMutations.prepare(entry.driver, entry.session.provider, value, () => {
      if (this.entry(id) !== entry || entry.saving)
        throw new DatabaseInputError('连接正在提交变更，请稍后重新预览');
    }, signal);
  }
  discardSqlMutation(id: string, planId: string): void {
    this.entry(id).sqlMutations.discard(planId);
  }
  async commitSqlMutation(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('当前连接正在提交变更');
    entry.saving = true;
    try {
      return await entry.sqlMutations.commit(entry.driver, planId, () => {
        if (this.writable(id) !== entry)
          throw new DatabaseInputError('连接已变化，请重新预览');
      }, signal);
    } finally {
      entry.saving = false;
    }
  }
  prepareStructureEdit(id: string, value: unknown, signal?: AbortSignal) {
    const entry = this.writable(id);
    return entry.structureEdits.prepare((schema, table) => this.structure(id, schema, table), value, () => {
      if (this.writable(id) !== entry || entry.saving) throw new DatabaseInputError('连接正在提交变更，请稍后重新预览');
    }, signal);
  }
  discardStructureEdit(id: string, planId: string) { this.entry(id).structureEdits.discard(planId); }
  async commitStructureEdit(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('当前连接正在提交变更');
    entry.saving = true;
    try { return await entry.structureEdits.commit(entry.driver, (schema, table) => this.structure(id, schema, table), planId, () => {
      if (this.writable(id) !== entry) throw new DatabaseInputError('连接已变化，请重新预览');
    }, signal); }
    finally { entry.saving = false; }
  }
  async commitImport(id: string, planId: string, signal?: AbortSignal) {
    const entry = this.writable(id);
    if (entry.saving) throw new DatabaseInputError('当前连接正在提交变更。');
    entry.saving = true;
    try { return await entry.imports.commit(entry.driver, entry.session.provider, planId, () => {
      if (this.writable(id) !== entry) throw new DatabaseInputError('连接已变化，请重新预览。');
    }, signal); }
    finally { entry.saving = false; }
  }
  async commit(id: string, planId: string): Promise<RelationalSaveResult> {
    const entry = this.writable(id);
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

  async prepareTransfer(id: string, value: unknown, signal?: AbortSignal) {
    const parsed = z.object({ sourceSchema: z.string().min(1).max(256), sourceTable: z.string().min(1).max(256), targetSessionId: z.string().uuid(), targetSchema: z.string().min(1).max(256), targetTable: z.string().min(1).max(256), input: tableTransferInputSchema }).strict().safeParse(value);
    if (!parsed.success) throw new DatabaseInputError('表传输参数无效');
    const input = parsed.data, source = this.entry(id), target = this.writable(input.targetSessionId);
    if (source === target || source.sourceIdentity === target.sourceIdentity && input.sourceSchema === input.targetSchema && input.sourceTable === input.targetTable) throw new DatabaseInputError('传输源和目标不能是同一张物理表；请选择独立目标连接与表');
    if (source.saving || target.saving) throw new DatabaseInputError('连接正在提交变更，请稍后准备');
    signal?.throwIfAborted();
    const [sourceStructure, targetStructure] = await Promise.all([this.structure(id, input.sourceSchema, input.sourceTable), this.structure(target.session.id, input.targetSchema, input.targetTable)]);
    if (this.entry(id) !== source || this.writable(target.session.id) !== target || source.saving || target.saving) throw new DatabaseInputError('传输会话已变化，请重新准备');
    signal?.throwIfAborted();
    return this.transfers.prepare(id, target.session.id, prepareTableTransfer(sourceStructure, targetStructure, input.input), sourceStructure, targetStructure);
  }
  discardTransfer(id: string, planId: string) { this.entry(id); this.transfers.discard(id, planId); }
  startTransfer(id: string, planId: string) {
    const source = this.entry(id), prepared = this.transfers.consume(id, planId), target = this.writable(prepared.targetId);
    if (source.saving || target.saving) throw new DatabaseInputError('连接正在提交变更，请重新准备传输');
    source.saving = true; target.saving = true;
    try { return this.transfers.start(prepared, async (signal, onProgress) => {
      try {
        signal.throwIfAborted();
        const [a, b] = await Promise.all([this.structure(id, prepared.plan.source.schema, prepared.plan.source.table), this.structure(target.session.id, prepared.plan.target.schema, prepared.plan.target.table)]);
        if (this.entry(id) !== source || this.writable(target.session.id) !== target) throw new DatabaseInputError('传输连接已变化');
        signal.throwIfAborted();
        if (transferStructureSignature(a) !== prepared.sourceSignature || transferStructureSignature(b) !== prepared.targetSignature) throw new DatabaseInputError('源或目标结构已变化，请重新准备');
        return await executeTableTransfer(source.driver, target.driver, prepared.plan, { signal, onProgress });
      } finally { source.saving = false; target.saving = false; }
    }); } catch (reason) { source.saving = false; target.saving = false; throw reason; }
  }
  transferTask(id: string, taskId: string) { this.entry(id); return this.transfers.poll(id, taskId); }
  cancelTransfer(id: string, taskId: string) { this.entry(id); return this.transfers.cancel(id, taskId); }
  async schemas(id: string): Promise<string[]> {
    return this.entry(id).driver.schemas();
  }
  async tables(id: string, schema: string): Promise<DatabaseObjectInfo[]> {
    const { session, driver } = this.entry(id);
    return (await driver.tables(schema)).map((table) => ({
      ...table,
      database: session.provider === 'mysql' ? schema : session.database,
      connectionId: id,
    }));
  }
  async columns(id: string, schema: string, table: string): Promise<DatabaseColumnInfo[]> {
    const columns = await this.entry(id).driver.columns(schema, table);
    if (!columns.length) throw new DatabaseInputError('对象不存在或当前账号无权读取字段');
    return columns;
  }
  async structure(
    id: string,
    schema: string,
    table: string,
  ): Promise<RelationalTableStructure> {
    const { session, driver } = this.entry(id);
    const columns = await driver.columns(schema, table);
    if (!columns.length) throw new DatabaseInputError('对象不存在或当前账号无权读取字段');
    return {
      ...(await driver.structure(schema, table, columns)),
      connectionId: id,
      provider: session.provider,
      columns,
    };
  }
  async page(
    id: string,
    schema: string,
    table: string,
    offset = 0,
    limit = 100,
    queryValue: unknown = { filter: null, sort: [] },
  ): Promise<RelationalTablePage> {
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > RELATIONAL_PAGE_LIMITS.offset ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > RELATIONAL_PAGE_LIMITS.rows
    )
      throw new DatabaseInputError('分页范围无效');
    const { session, driver } = this.entry(id);
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
  async countRows(id: string, schema: string, table: string, queryValue: unknown, signal?: AbortSignal): Promise<RelationalTableCount> {
    const { driver, session } = this.entry(id);
    const columns = await driver.columns(schema, table);
    if (!columns.length) throw new DatabaseInputError('对象不存在或当前账号无权读取字段');
    const compiled = compileTableQuery(session.provider, schema, table, columns, tableQueryInput(queryValue), 0, 1, driver.quoteIdentifier, 'count');
    const result = await driver.read(compiled.sql, schema, 1, compiled.parameters, signal);
    const value = result.rows[0]?.[0];
    if ((typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) || (typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) throw new DatabaseInputError('数据库返回的总行数无效');
    return { totalRows: String(value) };
  }
  async query(
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
    const { driver, session } = this.entry(id);
    const statement =
      session.provider === 'mysql'
        ? assertMysqlReadOnlySql(sql as string)
        : assertRelationalReadSql(sql, session.provider);
    const entry = this.entry(id), start = performance.now(), executedAt = Date.now();
    const record = (success: boolean, error: string | null, rowCount: number, truncated: boolean) => {
      if (this.entries.get(id) !== entry) return;
      const history: SqlHistoryEntry = { id: crypto.randomUUID(), connectionId: session.connectionId ?? session.id,
        connectionName: entry.connectionName, provider: session.provider, database: session.provider === 'mysql' ? schema ?? session.database : session.database,
        schema, sql: sourceSql ?? sql as string, executedAt, executionTimeMs: Math.round(performance.now() - start), success,
        error: error === null ? null : error.slice(0, 16384), rowCount, truncated };
      try { this.historyRepository(entry).append(history); }
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
  async explain(id: string, value: unknown, signal?: AbortSignal): Promise<DatabaseQueryResult> {
    const entry = this.entry(id), start = performance.now();
    const plan = await explainSqlPlan(entry.driver, entry.session.provider, value, signal);
    this.entry(id);
    return { columns: plan.columns, columnTypes: plan.columnTypes, rows: plan.rows, hasMore: plan.hasMore,
      columnSortables: plan.columns.map(() => false), affectedRows: 0, executionTimeMs: Math.round(performance.now() - start),
      truncated: plan.hasMore, sessionId: null, messages: plan.warnings.map((message) => ({ severity: 'warning', message })) };
  }
  startExecution(id: string, value: unknown) {
    const { session } = this.entry(id);
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
    return this.executions.start(id, session.provider === 'mysql' ? schema ?? session.database : session.database, schema, originals,
      (statement, signal, index) => this.query(id, ranges[index].sql, schema, maxRows, signal, context ? `${context}\n${stripSqlVariableDeclarations(statement, session.provider)}` : statement),
      (reason, index) => {
        const error = sqlExecutionError(reason);
        if (error.position !== null) error.position = Math.max(0, sqlSourcePosition(compiled, ranges[index].from + error.position) + offset - originals[index].from);
        return error;
      });
  }
  execution(id: string, executionId: string, revision: number) {
    this.entry(id);
    return this.executions.poll(id, executionId, revision);
  }
  cancelExecution(id: string, executionId: string) {
    this.entry(id);
    return this.executions.cancel(id, executionId);
  }
  historySearch(id: string, value: unknown) {
    const entry = this.entry(id); return this.historyRepository(entry).search(value, entry.session.connectionId ?? id);
  }
  historyEntry(id: string, historyId: string) {
    const entry = this.entry(id); return this.historyRepository(entry).history(historyId, entry.session.connectionId ?? id);
  }
  deleteHistory(id: string, historyId: string) {
    const entry = this.entry(id); this.historyRepository(entry).deleteHistory(historyId, entry.session.connectionId ?? id);
  }
  clearHistory(id: string) {
    const entry = this.entry(id); this.historyRepository(entry).clearHistory(entry.session.connectionId ?? id);
  }
  editorPreferences(id: string) {
    const entry = this.entry(id); return this.historyRepository(entry).editorPreferences(entry.session.connectionId ?? id);
  }
  saveEditorPreferences(id: string, value: unknown) {
    const entry = this.entry(id); return this.historyRepository(entry).saveEditorPreferences(entry.session.connectionId ?? id, value);
  }
  async removeConnection(connectionId: string): Promise<void> {
    await Promise.all([...this.entries.values()].filter(entry => entry.session.connectionId === connectionId).map(entry => this.disconnect(entry.session.id)));
    this.sqlRepository.removeConnection(connectionId);
    this.metadata.documents.deleteConnection(connectionId);
  }
  async disconnect(id: string): Promise<void> {
    const entry = this.entry(id);
    this.entries.delete(id);
    this.transfers.clearSession(id);
    entry.imports.clear();
    entry.structureEdits.clear();
    entry.sqlMutations.clear();
    entry.schemaCreates.clear();
    entry.tableCreates.clear();
    entry.indexEdits.clear();
    entry.foreignKeyEdits.clear();
    entry.tableClears.clear();
    await this.executions.closeSession(id);
    if (!entry.session.connectionId) this.transientSql.removeConnection(id);
    this.capabilities.disconnect(id, id);
    try {
      await this.sqliteBackups.closeSession({ sessionId: id });
      await this.exports.closeSession({ sessionId: id });
    }
    finally { await entry.driver.close(); }
  }
  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].map(({ session }) =>
        this.disconnect(session.id),
      ),
    );
    await this.sqliteBackups.close();
    this.sqlRepository.close();
    this.transientSql.close();
    this.metadata.documents.close();
    await this.exports.close();
  }
}
