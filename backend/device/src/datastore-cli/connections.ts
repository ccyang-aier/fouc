import type { RelationalSession } from '@fouc/shared';
import { DatastoreHttpClient, resourceSegment } from './http';
import { DatastoreCliError, type CliEnvironment, type CliOptions, type CliProvider } from './types';

export interface CliConnection {
  id: string;
  name: string;
  config: Record<string, unknown> & { provider: CliProvider };
  updatedAt: number;
}
export interface CliSession {
  id: string;
  provider: CliProvider;
  database: string | null;
  root: string;
  base: string;
  owned: boolean;
  raw: unknown;
}
const FAMILIES = ['relational', 'redis', 'mongo'] as const;

export function databaseRoot(family: string): string {
  return `/api/database/${family}`;
}

export function providerFamily(provider: CliProvider): string {
  return provider === 'redis' ? 'redis' : provider === 'mongodb' ? 'mongo' : 'relational';
}

export async function listCliConnections(client: DatastoreHttpClient, options: CliOptions): Promise<CliConnection[]> {
  const families = options.provider ? [providerFamily(options.provider)] : FAMILIES;
  const lists = await Promise.all(families.map(family => client.request<CliConnection[]>(databaseRoot(family) + '/connections')));
  return lists.flat().filter(connection => (!options.provider || connection.config.provider === options.provider));
}

export async function resolveCliConnection(client: DatastoreHttpClient, options: CliOptions): Promise<CliConnection> {
  if (!options.connection) throw new DatastoreCliError('Select --connection or --session with --provider', 2, 'missing_connection');
  const connections = await listCliConnections(client, options);
  const exact = connections.find(connection => connection.id === options.connection);
  if (exact) return exact;
  if (options.connectionResolution === 'id') throw new DatastoreCliError('Granted connection ID does not exist for this provider', 3, 'connection_not_found');
  const named = connections.filter(connection => connection.name === options.connection);
  if (named.length !== 1) throw new DatastoreCliError(named.length ? 'Connection name is ambiguous; select its exact ID' : 'Connection does not exist for this provider', 2, 'connection_not_found');
  return named[0];
}

function credentials(environment: CliEnvironment): Record<string, unknown> {
  const options = environment.FOUC_CONNECTION_OPTIONS_JSON;
  let connectionOptions: unknown;
  if (options !== undefined) {
    if (Buffer.byteLength(options) > 512 * 1024) throw new DatastoreCliError('Temporary connection options exceed 512 KiB', 2);
    try { connectionOptions = JSON.parse(options); } catch { throw new DatastoreCliError('FOUC_CONNECTION_OPTIONS_JSON must be valid JSON', 2); }
    if (!connectionOptions || typeof connectionOptions !== 'object' || Array.isArray(connectionOptions)) throw new DatastoreCliError('FOUC_CONNECTION_OPTIONS_JSON must contain one options object', 2);
  }
  return { password: environment.FOUC_CONNECTION_PASSWORD ?? '', ...(connectionOptions ? { connectionOptions } : {}) };
}

export async function openCliSession(client: DatastoreHttpClient, options: CliOptions, environment: CliEnvironment, owned = true): Promise<CliSession> {
  if (options.session) {
    if (options.connectionResolution === 'id') throw new DatastoreCliError('ID-scoped callers cannot borrow an existing session', 3, 'session_denied');
    if (!options.provider) throw new DatastoreCliError('--session requires an explicit --provider', 2, 'missing_provider');
    const root = databaseRoot(providerFamily(options.provider));
    return { id: options.session, provider: options.provider, database: options.database, root, base: root + '/sessions/' + resourceSegment(options.session), owned: false, raw: null };
  }
  const connection = await resolveCliConnection(client, options);
  const provider = connection.config.provider;
  const root = databaseRoot(providerFamily(provider));
  const raw = await client.request<{ id: string; provider?: CliProvider; database?: string }>(root + '/connections/' + resourceSegment(connection.id) + '/connect', credentials(environment));
  if (!raw || typeof raw.id !== 'string' || !raw.id || (raw.provider && raw.provider !== provider)) throw new DatastoreCliError('Device returned an invalid scoped session');
  return { id: raw.id, provider, database: raw.database ?? String(connection.config.database ?? ''), root, base: root + '/sessions/' + resourceSegment(raw.id), owned, raw };
}

export async function withCliSession<T>(client: DatastoreHttpClient, options: CliOptions, environment: CliEnvironment, action: (session: CliSession) => Promise<T>): Promise<T> {
  const session = await openCliSession(client, options, environment);
  let primary: unknown;
  try { return await action(session); }
  catch (reason) { primary = reason; throw reason; }
  finally {
    if (session.owned) {
      try { await client.cleanupClient().request(session.base, undefined, 'DELETE'); }
      catch (cleanup) {
        const error = new DatastoreCliError(`Owned session cleanup failed; session ${session.id} must be closed explicitly: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`);
        if (!primary) throw error;
        if (primary instanceof Error) primary.message += `; ${error.message}`;
      }
    }
  }
}

export function relationalSession(session: CliSession): asserts session is CliSession & { provider: RelationalSession['provider'] } {
  if (!['mysql', 'postgres', 'sqlite'].includes(session.provider)) throw new DatastoreCliError('This command requires a native relational connection', 2, 'wrong_provider');
}
