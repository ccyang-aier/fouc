import { z } from 'zod';
import { parseDatastoreCliArgs } from '../datastore-cli/args';
import { DatastoreCliError, type CliEnvironment, type CliOptions } from '../datastore-cli/types';

const name = z.string().min(1).max(512).refine(value => !/[\0\r\n]/.test(value));
const grant = z.object({
  connectionId: name,
  allowSql: z.boolean().default(false),
  schemas: z.array(name).max(200).optional(),
  tables: z.array(z.object({ schema: name, table: name }).strict()).max(500).optional(),
  mongoNamespaces: z.array(z.object({ database: name, collection: name }).strict()).max(500).optional(),
  allowRedis: z.boolean().default(false),
}).strict().refine(value => !value.allowSql || (!value.schemas && !value.tables), { message: 'SQL grants require explicit access to the whole connection; schema/table grants only allow scoped metadata and row tools' });
const policy = z.object({ workspaceId: name.max(128), connections: z.array(grant).max(100), tools: z.array(name).max(50).optional() }).strict();
export type DatastoreMcpPolicy = z.infer<typeof policy>;
export type DatastoreMcpGrant = z.infer<typeof grant>;

/** An explicit process policy fixes workspace and exact connection IDs before any tool runs. */
export function loadDatastoreMcpPolicy(environment: CliEnvironment): DatastoreMcpPolicy {
  const source = environment.FOUC_DATASTORE_MCP_POLICY;
  if (!source || Buffer.byteLength(source) > 256 * 1024) throw new DatastoreCliError('Set FOUC_DATASTORE_MCP_POLICY to a bounded workspace/connection allowlist', 2, 'invalid_mcp_policy');
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new DatastoreCliError('FOUC_DATASTORE_MCP_POLICY is not valid JSON', 2, 'invalid_mcp_policy'); }
  const parsed = policy.safeParse(value);
  if (!parsed.success) throw new DatastoreCliError(parsed.error.issues.map(issue => issue.message).join('; '), 2, 'invalid_mcp_policy');
  const ids = parsed.data.connections.map(item => item.connectionId);
  if (new Set(ids).size !== ids.length) throw new DatastoreCliError('MCP connection allowlist contains duplicate IDs', 2, 'invalid_mcp_policy');
  return parsed.data;
}

export class DatastoreMcpAccess {
  constructor(readonly policy: DatastoreMcpPolicy, readonly environment: CliEnvironment) {}
  connection(id: unknown): DatastoreMcpGrant {
    const allowed = this.policy.connections.find(item => item.connectionId === id);
    if (!allowed) throw new DatastoreCliError('Connection is outside this MCP process allowlist', 3, 'scope_denied');
    return allowed;
  }
  tool(name: string): void {
    if (this.policy.tools && !this.policy.tools.includes(name)) throw new DatastoreCliError('Tool is disabled by this MCP process policy', 3, 'tool_denied');
  }
  schema(id: string, schema: string): void {
    const grant = this.connection(id);
    if (grant.schemas && !grant.schemas.includes(schema)) throw new DatastoreCliError('Schema is outside the MCP grant', 3, 'scope_denied');
    if (grant.tables && !grant.tables.some(table => table.schema === schema)) throw new DatastoreCliError('Schema has no granted tables', 3, 'scope_denied');
  }
  table(id: string, schema: string, table: string): void {
    this.schema(id, schema);
    const grant = this.connection(id);
    if (grant.tables && !grant.tables.some(item => item.schema === schema && item.table === table)) throw new DatastoreCliError('Table is outside the MCP grant', 3, 'scope_denied');
  }
  sql(id: string): void {
    if (!this.connection(id).allowSql) throw new DatastoreCliError('SQL is disabled; a whole-connection readonly SQL grant is required', 3, 'scope_denied');
  }
  mongo(id: string, database: string, collection: string): void {
    const grant = this.connection(id);
    if (!grant.mongoNamespaces?.some(item => item.database === database && item.collection === collection)) throw new DatastoreCliError('Mongo namespace is outside the explicit MCP grant', 3, 'scope_denied');
  }
  redis(id: string): void {
    if (!this.connection(id).allowRedis) throw new DatastoreCliError('Redis reads are not explicitly granted', 3, 'scope_denied');
  }
  options(command: string[], connectionId: string, targets: Partial<CliOptions> = {}): CliOptions {
    this.connection(connectionId);
    const base = parseDatastoreCliArgs(command, { FOUC_DEVICE_URL: this.environment.FOUC_DEVICE_URL });
    return { ...base, ...targets, workspace: this.policy.workspaceId, connection: connectionId, connectionResolution: 'id', session: null, timeout: Math.min(targets.timeout ?? 30_000, 120_000), limit: Math.min(targets.limit ?? 100, 1000), format: 'json', output: null, overwrite: false };
  }
}

export function safeMcpMessage(reason: unknown, environment: CliEnvironment): string {
  let text = reason instanceof Error ? reason.message : String(reason);
  for (const key of ['FOUC_DEVICE_TOKEN', 'FOUC_CONNECTION_PASSWORD', 'FOUC_CONNECTION_OPTIONS_JSON', 'FOUC_DATASTORE_MCP_POLICY', 'FOUC_DATASTORE_MCP_TOKEN']) {
    const value = environment[key];
    if (value) text = text.replaceAll(value, '[redacted]');
  }
  return text.slice(0, 4000);
}
