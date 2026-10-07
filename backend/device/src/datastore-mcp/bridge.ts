import { z } from 'zod';
import type { SchemaObjectList, SchemaObjectIdentity } from '@fouc/shared/schema-objects';
import type { SqlExecutionSnapshot } from '@fouc/shared';
import { executeDatastoreCli } from '../datastore-cli/commands';
import { parseDatastoreCliArgs } from '../datastore-cli/args';
import { listCliConnections, relationalSession, withCliSession, type CliSession } from '../datastore-cli/connections';
import { runCliSql } from '../datastore-cli/execution';
import { DatastoreHttpClient } from '../datastore-cli/http';
import { DatastoreCliError, type CliEnvironment, type CliOptions } from '../datastore-cli/types';
import { DatastoreMcpAccess, type DatastoreMcpPolicy } from './policy';
import { DatastoreMcpResults, type ResultWindow } from './results';
import { DatastoreMcpSessions } from './sessions';

const name = z.string().min(1).max(512).refine(value => !/[\0\r\n]/.test(value));
const connection = { connectionId: name };
const target = { ...connection, schema: name, table: name };
const paging = { limit: z.number().int().min(1).max(1000).default(100), offset: z.number().int().min(0).max(1_000_000).default(0) };
const window = { statement: z.number().int().min(0).max(1000).default(0), rowOffset: z.number().int().min(0).max(5000).default(0), rowLimit: z.number().int().min(1).max(100).default(50), cellOffset: z.number().int().min(0).max(1_000_000).default(0), cellLimit: z.number().int().min(16).max(4000).default(200) };
export interface DatastoreMcpTool {
  name: string;
  title: string;
  description: string;
  schema: z.ZodType<Record<string, unknown>>;
  run(input: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
}

/** Adapter operations reuse the actual device contracts and registered SQL lifecycle. */
export class DatastoreMcpBridge {
  readonly access: DatastoreMcpAccess;
  readonly results = new DatastoreMcpResults();
  readonly sessions: DatastoreMcpSessions;
  readonly tools: DatastoreMcpTool[];
  private readonly client: DatastoreHttpClient;
  private readonly lifetime = new AbortController();
  private readonly requests = new Set<Promise<unknown>>();
  private closing: Promise<void> | null = null;
  constructor(policy: DatastoreMcpPolicy, readonly environment: CliEnvironment, report?: (message: string) => void) {
    this.access = new DatastoreMcpAccess(policy, environment);
    const options = parseDatastoreCliArgs(['capabilities'], { FOUC_DEVICE_URL: environment.FOUC_DEVICE_URL });
    this.client = new DatastoreHttpClient(options.url, environment, 30_000);
    this.sessions = new DatastoreMcpSessions(this.client, environment, report);
    this.tools = this.buildTools().filter(tool => !policy.tools || policy.tools.includes(tool.name));
  }
  private clientFor(options: CliOptions, signal: AbortSignal) { return new DatastoreHttpClient(options.url, this.environment, options.timeout, signal); }
  private async command(command: string[], id: string, targets: Partial<CliOptions>, signal: AbortSignal) {
    const options = this.access.options(command, id, targets);
    const result = await executeDatastoreCli(this.clientFor(options, signal), options, this.environment, signal);
    return { data: result.data, ...(result.warnings?.length ? { warnings: result.warnings } : {}) };
  }
  private async native<T>(id: string, signal: AbortSignal, action: (client: DatastoreHttpClient, session: CliSession) => Promise<T>): Promise<T> {
    const options = this.access.options([], id);
    const client = this.clientFor(options, signal);
    return withCliSession(client, options, this.environment, session => action(client, session));
  }
  async directory(signal: AbortSignal) {
    if (!this.access.policy.connections.length) return [];
    const options = this.access.options([], this.access.policy.connections[0].connectionId);
    const client = new DatastoreHttpClient(this.client.origin, this.environment, 30_000, signal);
    const data = await listCliConnections(client, options);
    const ids = new Set(this.access.policy.connections.map(item => item.connectionId));
    return data.filter(item => ids.has(item.id)).map(item => ({ id: item.id, name: item.name, provider: item.config.provider, database: item.config.database ?? null }));
  }
  private async query(input: Record<string, unknown>, signal: AbortSignal) {
    const id = input.connectionId as string;
    this.access.sql(id);
    const options = this.access.options(['query'], id, { schema: input.schema as string | undefined ?? null, query: input.sql as string, limit: input.maxRows as number, timeout: input.timeoutMs as number });
    const execute = async (session: CliSession, activeSignal: AbortSignal): Promise<SqlExecutionSnapshot> => {
      relationalSession(session);
      return runCliSql(this.clientFor(options, activeSignal), session, options, options.query!, activeSignal);
    };
    const execution = input.session
      ? await this.sessions.use(id, input.session as string, signal, execute)
      : await withCliSession(this.clientFor(options, signal), options, this.environment, session => execute(session, signal));
    const captureId = this.results.capture(id, execution);
    const initial = input as unknown as ResultWindow;
    return { captureId, captured: captureId !== null, retentionMs: captureId ? 120_000 : 0, warnings: captureId ? [] : ['Execution exceeded the 8 MiB immutable capture budget; narrow projection/row count before rerunning'], ...this.results.window(execution, initial) };
  }
  private buildTools(): DatastoreMcpTool[] {
    return [
      {
        name: 'fouc_list_connections', title: 'List granted connections', description: 'Return only exact connection IDs in this process connection allowlist; no credentials.',
        schema: z.object({}).strict(), run: async (_, signal) => ({ connections: await this.directory(signal) }),
      },
      {
        name: 'fouc_list_databases', title: 'List visible databases or schemas', description: 'Native relational schemas or Mongo database names filtered to the explicit resource grant.',
        schema: z.object(connection).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, grant = this.access.connection(id);
          const result = await this.command(['schemas', 'list'], id, {}, signal);
          if (Array.isArray(result.data)) return { ...result, data: result.data.filter(schema => (!grant.schemas || grant.schemas.includes(schema)) && (!grant.tables || grant.tables.some(table => table.schema === schema))) };
          const mongo = result.data as { databases: Array<{ name: string }>; truncated: boolean };
          return { ...result, data: { ...mongo, databases: mongo.databases.filter(database => grant.mongoNamespaces?.some(item => item.database === database.name)) } };
        },
      },
      {
        name: 'fouc_list_tables', title: 'List native tables', description: 'Read a granted relational schema directory, filtering any table allowlist.',
        schema: z.object({ ...connection, schema: name }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, schema = input.schema as string;
          this.access.schema(id, schema);
          const grant = this.access.connection(id);
          const result = await this.command(['tables', 'list'], id, { schema }, signal);
          const tables = result.data as Array<{ name: string }>;
          return { ...result, data: tables.filter(table => !grant.tables || grant.tables.some(item => item.schema === schema && item.table === table.name)) };
        },
      },
      {
        name: 'fouc_describe_table', title: 'Describe native table structure', description: 'Actual columns, indexes, foreign keys, checks and native metadata warnings for one granted table.',
        schema: z.object(target).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, schema = input.schema as string, table = input.table as string;
          this.access.table(id, schema, table);
          return this.command(['describe'], id, { schema, table }, signal);
        },
      },
      {
        name: 'fouc_read_table_rows', title: 'Read one table page', description: 'Bounded native page, preserving exact numbers and binary envelopes; no cross-request snapshot guarantee.',
        schema: z.object({ ...target, ...paging }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, schema = input.schema as string, table = input.table as string;
          this.access.table(id, schema, table);
          return this.command(['rows'], id, { schema, table, limit: input.limit as number, offset: input.offset as number }, signal);
        },
      },
      {
        name: 'fouc_execute_query', title: 'Execute registered readonly SQL', description: 'Requires explicit whole-connection allowSql grant. Native readonly guards apply. Results have immutable bounded captures and explicit string windows; cancellation cancels the registered execution.',
        schema: z.object({ ...connection, sql: z.string().min(1).max(1_000_000), schema: name.optional(), session: z.string().uuid().optional(), maxRows: z.number().int().min(1).max(1000).default(100), timeoutMs: z.number().int().min(1000).max(120_000).default(30_000), ...window }).strict(), run: (input, signal) => this.query(input, signal),
      },
      {
        name: 'fouc_read_result', title: 'Read an immutable query capture', description: 'Page the acknowledged result without rerunning SQL; captures last at most two minutes and may be evicted under the 8 MiB budget.',
        schema: z.object({ ...connection, captureId: z.string().uuid(), ...window }).strict(), run: async input => {
          const id = input.connectionId as string;
          this.access.sql(id);
          return this.results.read(id, input.captureId as string, input as unknown as ResultWindow);
        },
      },
      {
        name: 'fouc_open_session', title: 'Open a readonly pinned SQL session', description: 'Create a process-owned session handle for a whole-connection SQL grant. Eight sessions maximum; ten-minute fixed lifetime, no browser-session borrowing.',
        schema: z.object(connection).strict(), run: async (input, signal) => {
          const id = input.connectionId as string;
          this.access.sql(id);
          const directory = await this.directory(signal);
          if (!directory.some(connection => connection.id === id && ['mysql', 'postgres', 'sqlite'].includes(connection.provider))) throw new DatastoreCliError('Pinned SQL sessions require a native relational connection', 2);
          return this.sessions.open(id, this.access.options([], id));
        },
      },
      {
        name: 'fouc_close_session', title: 'Close a pinned SQL session', description: 'Cancel active work, await its actual cancellation and close this process-owned native session.',
        schema: z.object({ ...connection, session: z.string().uuid() }).strict(), run: async input => {
          const id = input.connectionId as string;
          this.access.connection(id);
          await this.sessions.close(input.session as string, id);
          return { closed: true, session: input.session };
        },
      },
      {
        name: 'fouc_get_table_context', title: 'Read schema context', description: 'Native documentation snapshot and current device-owned annotations for one granted table.',
        schema: z.object(target).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, schema = input.schema as string, table = input.table as string;
          this.access.table(id, schema, table);
          return this.command(['context'], id, { schema, table }, signal);
        },
      },
      {
        name: 'fouc_export_table_docs', title: 'Export table documentation', description: 'Native DBML or Markdown for exactly one granted table; does not write files.',
        schema: z.object({ ...target, format: z.enum(['dbml', 'markdown']).default('markdown') }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, schema = input.schema as string, table = input.table as string;
          this.access.table(id, schema, table);
          return this.command([input.format === 'dbml' ? 'dbml' : 'docs'], id, { schema, table }, signal);
        },
      },
      {
        name: 'fouc_list_schema_objects', title: 'List native schema objects', description: 'Views, routines, triggers and sequences where natively supported. Requires whole-schema access; table-only grants cannot reveal other definitions.',
        schema: z.object({ ...connection, schema: name, ...paging, search: z.string().max(256).default('') }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, schema = input.schema as string;
          this.access.schema(id, schema);
          if (this.access.connection(id).tables) throw new DatastoreCliError('Schema objects require an explicit whole-schema grant', 3, 'scope_denied');
          return this.native(id, signal, async (client, session) => { relationalSession(session); return client.request<SchemaObjectList>(session.base + '/schema-objects/list', { schema, search: input.search, offset: input.offset, limit: Math.min(input.limit as number, 200) }); });
        },
      },
      {
        name: 'fouc_get_schema_object', title: 'Read native object definition', description: 'Read the exact native object identity returned by fouc_list_schema_objects; reconstructed/unknown source is labeled by the device.',
        schema: z.object({ ...connection, object: z.object({ schema: name, name, kind: z.enum(['view', 'materialized-view', 'trigger', 'function', 'procedure', 'sequence']), catalogId: z.string().nullable(), signature: z.string().nullable(), parentSchema: z.string().nullable(), parentName: z.string().nullable() }).strict() }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, object = input.object as SchemaObjectIdentity;
          this.access.schema(id, object.schema);
          if (this.access.connection(id).tables) throw new DatastoreCliError('Object definitions require a whole-schema grant', 3, 'scope_denied');
          return this.native(id, signal, async (client, session) => { relationalSession(session); return client.request(session.base + '/schema-objects/details', object); });
        },
      },
      {
        name: 'fouc_redis_scan', title: 'Read one native Redis SCAN page', description: 'Requires allowRedis for the configured saved connection/database. Returns canonical Base64 keys and exact next cursor; never expands wildcards into writes.',
        schema: z.object({ ...connection, cursor: z.string().regex(/^\d+$/).max(32).default('0'), pattern: z.string().max(1024).default('*') }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string;
          this.access.redis(id);
          return this.native(id, signal, async (client, session) => {
            if (session.provider !== 'redis') throw new DatastoreCliError('This tool requires a Redis connection', 2);
            return client.request(session.base + '/scan', { cursor: input.cursor, pattern: input.pattern });
          });
        },
      },
      {
        name: 'fouc_redis_value', title: 'Read a native Redis value page', description: 'Explicit canonical Base64 key; preserves original binary identity and native cursor/TTL metadata.',
        schema: z.object({ ...connection, keyBase64: z.string().max(2048), cursor: z.string().max(32).default('0') }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string;
          this.access.redis(id);
          return this.native(id, signal, async (client, session) => {
            if (session.provider !== 'redis') throw new DatastoreCliError('This tool requires a Redis connection', 2);
            return client.request(session.base + '/value', { key: input.keyBase64, cursor: input.cursor });
          });
        },
      },
      {
        name: 'fouc_mongo_documents', title: 'Read canonical Mongo documents', description: 'One explicitly granted database/collection, canonical EJSON filter/projection/sort and bounded native page; no arbitrary Mongo command.',
        schema: z.object({ ...connection, database: name, collection: name, filter: z.string().max(262_144).default('{}'), projection: z.string().max(262_144).default('{}'), sort: z.string().max(262_144).default('{}'), ...paging }).strict(), run: async (input, signal) => {
          const id = input.connectionId as string, database = input.database as string, collection = input.collection as string;
          this.access.mongo(id, database, collection);
          return this.native(id, signal, async (client, session) => {
            if (session.provider !== 'mongodb') throw new DatastoreCliError('This tool requires a MongoDB connection', 2);
            return client.request(session.base + '/find', { database, collection, filter: input.filter, projection: input.projection, sort: input.sort, offset: input.offset, limit: Math.min(input.limit as number, 500) });
          });
        },
      },
    ];
  }
  async invoke(name: string, value: unknown, signal: AbortSignal): Promise<unknown> {
    this.access.tool(name);
    const tool = this.tools.find(tool => tool.name === name);
    if (!tool) throw new DatastoreCliError('Tool is unknown or disabled by policy', 2, 'unknown_tool');
    const input = tool.schema.safeParse(value ?? {});
    if (!input.success) throw new DatastoreCliError(input.error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join('; '), 2, 'invalid_tool_arguments');
    const requestSignal = AbortSignal.any([signal, this.lifetime.signal]);
    requestSignal.throwIfAborted();
    if (this.requests.size >= 4) throw new DatastoreCliError('Four MCP tools are already active; wait or cancel one');
    const request = tool.run(input.data, requestSignal);
    this.requests.add(request);
    try { return await request; }
    finally { this.requests.delete(request); }
  }
  async close(): Promise<void> {
    this.closing ??= (async () => {
      this.lifetime.abort(new Error('MCP process closed'));
      await Promise.allSettled([...this.requests]);
      await this.sessions.shutdown();
      this.results.clear();
    })();
    await this.closing;
  }
}
