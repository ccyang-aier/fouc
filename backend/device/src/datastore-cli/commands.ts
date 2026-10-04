import type { RelationalTablePage, RelationalTableStructure, RedisScanPage } from '@fouc/shared';
import type { MongoCollectionList, MongoDatabaseList, MongoDocumentPage } from '@fouc/shared/mongo';
import { exportDatabaseDocsDbml, exportDatabaseDocsMarkdown, type DatabaseDocsSnapshot } from '@fouc/shared/database-docs';
import { DatastoreHttpClient, resourceSegment } from './http';
import { listCliConnections, openCliSession, relationalSession, withCliSession, workspaceRoot, providerFamily, type CliSession } from './connections';
import { cliSqlSource, runCliSql } from './execution';
import { DatastoreCliError, type CliEnvironment, type CliOptions, type CliResult } from './types';

const COMMANDS = new Set(['doctor', 'capabilities', 'connections list', 'connect', 'disconnect', 'schemas list', 'tables list', 'describe', 'rows', 'query', 'context', 'dbml', 'docs', 'redis scan', 'redis value', 'mongo documents']);
type Table = { name: string; schema: string; kind: string; comment: string | null };

function required(value: string | null, flag: string): string {
  if (!value) throw new DatastoreCliError(`Command requires --${flag}`, 2, 'missing_target');
  return value;
}

function tableRoute(session: CliSession, options: CliOptions): string {
  relationalSession(session);
  return session.base + '/schemas/' + resourceSegment(required(options.schema, 'schema')) + '/tables/' + resourceSegment(required(options.table, 'table'));
}

async function docsSnapshot(client: DatastoreHttpClient, session: CliSession, options: CliOptions): Promise<DatabaseDocsSnapshot> {
  relationalSession(session);
  const schema = required(options.schema, 'schema');
  let tables: Array<{ schema: string; table: string }>;
  if (options.table) tables = [{ schema, table: options.table }];
  else {
    const directory = await client.request<Table[]>(session.base + '/schemas/' + resourceSegment(schema) + '/tables');
    tables = directory.filter(table => table.kind === 'table').slice(0, Math.min(options.limit, 1000)).map(table => ({ schema, table: table.name }));
  }
  if (!tables.length) throw new DatastoreCliError('Selected schema contains no native tables to document');
  return client.request<DatabaseDocsSnapshot>(session.base + '/database-docs/snapshot', { schemas: [schema], tables });
}

export async function executeDatastoreCli(client: DatastoreHttpClient, options: CliOptions, environment: CliEnvironment, signal?: AbortSignal): Promise<CliResult> {
  const command = options.command.join(' ');
  if (!COMMANDS.has(command)) throw new DatastoreCliError(`Unknown command ${command}; use --help`, 2, 'unknown_command');
  if (command === 'doctor') {
    const started = Date.now();
    const health = await client.request<{ ok: true; pid: number; at: number }>('/health');
    return { command, data: { endpoint: client.origin, transport: 'device-http', reachable: true, pid: health.pid, sampledAt: new Date(health.at).toISOString(), elapsedMs: Date.now() - started, authentication: 'resource operations require the current device token; public health does not test permissions' } };
  }
  if (command === 'capabilities') {
    const capabilities = {
      transport: 'device-http',
      nativeProviders: ['mysql', 'postgres', 'sqlite', 'redis', 'mongodb'],
      relational: ['schemas', 'tables', 'structure', 'rows', 'readonly-registered-sql', 'context', 'dbml', 'markdown-docs'],
      redis: ['scan-page', 'value-page'],
      mongodb: ['databases', 'collections', 'canonical-ejson-document-page'],
      policy: 'readonly; no write access unlock, arbitrary Redis commands or Mongo commands',
      guarantees: ['explicit-workspace', 'exact-connection-id-or-unique-name', 'bounded-results', 'owned-session-cleanup', 'registered-sql-cancellation'],
      notImplemented: ['direct-database-mode', 'CLI writes', 'desktop deep links', 'MCP server', 'remote cloud account login'],
    };
    return { command, data: capabilities };
  }
  if (command === 'connections list') {
    const connections = await listCliConnections(client, options);
    return { command, data: connections, grids: [{ columns: ['id', 'name', 'provider', 'updatedAt'], rows: connections.map(item => [item.id, item.name, item.config.provider, new Date(item.updatedAt).toISOString()]) }] };
  }
  if (command === 'connect') {
    if (options.session) throw new DatastoreCliError('connect requires --connection, not an existing --session', 2);
    const session = await openCliSession(client, options, environment, false);
    return { command, data: { sessionId: session.id, workspaceId: options.workspace, provider: session.provider, database: session.database, readonly: true, closeCommand: `disconnect --workspace ${JSON.stringify(options.workspace)} --provider ${session.provider} --session ${session.id}` }, warnings: ['This explicitly opened session remains active; close it with disconnect when finished'] };
  }
  if (command === 'disconnect') {
    if (!options.session || !options.provider) throw new DatastoreCliError('disconnect requires --session and --provider', 2);
    const route = workspaceRoot(options, providerFamily(options.provider)) + '/sessions/' + resourceSegment(options.session);
    await client.request(route, undefined, 'DELETE');
    return { command, data: { sessionId: options.session, closed: true } };
  }
  const sql = command === 'query' ? await cliSqlSource(options) : null;
  return withCliSession(client, options, environment, async session => {
    if (command === 'schemas list') {
      if (session.provider === 'mongodb') {
        const data = await client.request<MongoDatabaseList>(session.base + '/databases');
        return { command, data, grids: [{ columns: ['name', 'sizeBytes', 'empty'], rows: data.databases.map(database => [database.name, database.sizeBytes, database.empty]) }], warnings: data.truncated ? ['Native database directory is truncated'] : [] };
      }
      relationalSession(session);
      const schemas = await client.request<string[]>(session.base + '/schemas');
      return { command, data: schemas, grids: [{ columns: ['schema'], rows: schemas.map(schema => [schema]) }] };
    }
    if (command === 'tables list') {
      if (session.provider === 'mongodb') {
        const data = await client.request<MongoCollectionList>(session.base + '/collections', { database: required(options.database ?? session.database, 'database') });
        return { command, data, grids: [{ columns: ['name', 'kind', 'options'], rows: data.collections.map(collection => [collection.name, collection.kind, collection.options]) }], warnings: data.truncated ? ['Native collection directory is truncated'] : [] };
      }
      relationalSession(session);
      const tables = await client.request<Table[]>(session.base + '/schemas/' + resourceSegment(required(options.schema, 'schema')) + '/tables');
      return { command, data: tables, grids: [{ columns: ['schema', 'name', 'kind', 'comment'], rows: tables.map(table => [table.schema, table.name, table.kind, table.comment]) }] };
    }
    if (command === 'describe') {
      const structure = await client.request<RelationalTableStructure>(tableRoute(session, options) + '/structure');
      return { command, data: structure, grids: [{ columns: ['name', 'type', 'nullable', 'primaryKey', 'default', 'comment'], rows: structure.columns.map(column => [column.name, column.dataType, column.isNullable, column.isPrimaryKey, column.columnDefault, column.comment]) }] };
    }
    if (command === 'rows') {
      const data = await client.request<RelationalTablePage>(tableRoute(session, options) + '/rows?offset=' + options.offset + '&limit=' + options.limit);
      return { command, data, grids: [{ columns: data.columns.map(column => column.name), rows: data.rows }], warnings: data.hasMore ? ['Only the requested native page is returned; more rows exist'] : [] };
    }
    if (command === 'query') {
      const execution = await runCliSql(client, session, options, sql!, signal);
      const results = execution.statements.flatMap((statement, index) => statement.result ? [{ label: `Result ${index + 1}`, columns: statement.result.columns, rows: statement.result.rows }] : []);
      const warnings = execution.statements.flatMap(statement => statement.result ? [...statement.result.messages.filter(message => message.severity === 'warning').map(message => message.message), ...(statement.result.truncated ? ['Result is truncated at the requested row limit'] : [])] : []);
      return { command, data: execution, grids: results, warnings };
    }
    if (command === 'context' || command === 'dbml' || command === 'docs') {
      const snapshot = await docsSnapshot(client, session, options);
      if (command === 'context') return { command, data: snapshot, grids: [{ columns: ['schema', 'table', 'columns', 'note'], rows: snapshot.tables.map(table => [table.structure.schema, table.structure.table, table.structure.columns.length, table.note.effective]) }], warnings: snapshot.warnings.map(warning => warning.message) };
      const exported = command === 'dbml' ? exportDatabaseDocsDbml(snapshot) : exportDatabaseDocsMarkdown(snapshot);
      return { command, data: { text: exported.text, generatedAt: snapshot.generatedAt, provider: snapshot.provider, database: snapshot.database }, text: exported.text, warnings: exported.warnings.map(warning => warning.message) };
    }
    if (command === 'redis scan') {
      if (session.provider !== 'redis') throw new DatastoreCliError('redis scan requires --provider redis or a Redis connection', 2);
      const data = await client.request<RedisScanPage>(session.base + '/scan', { cursor: '0', pattern: options.query ?? '*' });
      return { command, data, grids: [{ columns: ['keyBase64', 'display', 'encoding', 'type', 'ttlSeconds'], rows: data.keys.map(key => [key.key.rawBase64, key.key.display, key.key.encoding, key.type, key.ttl]) }], warnings: data.cursor !== '0' ? ['SCAN returned one native page; next cursor is ' + data.cursor] : [] };
    }
    if (command === 'redis value') {
      if (session.provider !== 'redis') throw new DatastoreCliError('redis value requires a Redis connection', 2);
      const data = await client.request(session.base + '/value', { key: required(options.query, 'query'), cursor: '0' });
      return { command, data };
    }
    if (command === 'mongo documents') {
      if (session.provider !== 'mongodb') throw new DatastoreCliError('mongo documents requires a MongoDB connection', 2);
      const data = await client.request<MongoDocumentPage>(session.base + '/find', { database: required(options.database ?? session.database, 'database'), collection: required(options.collection, 'collection'), filter: options.query ?? '{}', sort: '{}', projection: '{}', offset: options.offset, limit: Math.min(500, options.limit) });
      return { command, data, grids: [{ columns: ['canonicalEjson'], rows: data.documents.map(document => [document]) }], warnings: [...data.warnings, ...(data.hasMore ? ['Only one native document page is returned'] : [])] };
    }
    throw new DatastoreCliError('Command dispatch failed');
  });
}
