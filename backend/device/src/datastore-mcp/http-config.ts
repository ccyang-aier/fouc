import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { DatastoreCliError, type CliEnvironment } from '../datastore-cli/types';

export interface DatastoreMcpHttpConfig { port: number; token: string; origins: string[] }

export function loadDatastoreMcpHttpConfig(environment: CliEnvironment): DatastoreMcpHttpConfig {
  const rawPort = environment.FOUC_DATASTORE_MCP_PORT ?? '8712';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new DatastoreCliError('MCP HTTP port must be between 1 and 65535', 2);
  const token = environment.FOUC_DATASTORE_MCP_TOKEN ?? '';
  if (token.length < 32 || token.length > 1024 || /\s/.test(token)) throw new DatastoreCliError('Explicit HTTP transport requires FOUC_DATASTORE_MCP_TOKEN with at least 32 non-whitespace characters', 2);
  let origins: unknown;
  try { origins = JSON.parse(environment.FOUC_DATASTORE_MCP_ORIGINS ?? '[]'); }
  catch { throw new DatastoreCliError('FOUC_DATASTORE_MCP_ORIGINS must be a JSON array of exact HTTP(S) origins', 2); }
  if (!Array.isArray(origins) || origins.length > 20 || origins.some(origin => {
    if (typeof origin !== 'string') return true;
    try { const url = new URL(origin); return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin || Boolean(url.username || url.password); }
    catch { return true; }
  })) throw new DatastoreCliError('MCP browser origins must be exact HTTP(S) origins; wildcard/null/path origins are unsupported', 2);
  return { port: Number(rawPort), token, origins: [...new Set(origins as string[])] };
}

/** The listener is fixed to loopback; Host/Origin are still checked before any SDK session lookup. */
export function validateDatastoreMcpHttpRequest(headers: IncomingHttpHeaders, port: number, config: DatastoreMcpHttpConfig, authenticate = true): { status: number; code: string; message: string } | null {
  const host = headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return { status: 403, code: 'host_denied', message: 'Host is outside the loopback MCP listener' };
  const origin = headers.origin;
  if (origin !== undefined && !config.origins.includes(origin)) return { status: 403, code: 'origin_denied', message: 'Browser Origin is not explicitly granted' };
  if (!authenticate) return null;
  const authorization = headers.authorization;
  const expected = Buffer.from('Bearer ' + config.token);
  const actual = Buffer.from(authorization ?? '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { status: 401, code: 'authentication_failed', message: 'MCP Bearer authentication is required' };
  return null;
}
