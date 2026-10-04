import { DatastoreCliError, type CliEnvironment } from './types';

const RESPONSE_BYTES = 16 * 1024 * 1024;
interface Envelope<T> { ok: boolean; data?: T; error?: { message?: string; code?: string } }

export class DatastoreHttpClient {
  constructor(
    readonly origin: string,
    private readonly environment: CliEnvironment,
    private readonly timeoutMs: number,
    private readonly signal?: AbortSignal,
  ) {}

  cleanupClient(): DatastoreHttpClient {
    return new DatastoreHttpClient(this.origin, this.environment, 5000);
  }

  async request<T>(route: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
    if (!route.startsWith('/')) throw new DatastoreCliError('Invalid device resource route');
    this.signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = this.signal ? AbortSignal.any([this.signal, timeout]) : timeout;
    const token = this.environment.FOUC_DEVICE_TOKEN;
    let response: Response;
    try {
      response = await fetch(new URL(route, this.origin), {
        method,
        headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal,
        redirect: 'error',
      });
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new DatastoreCliError('Device authentication denied; check FOUC_DEVICE_TOKEN and this resource scope', 3, 'authentication_failed');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new DatastoreCliError('Device response has no body');
      const pieces: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const piece = await reader.read();
          if (piece.done) break;
          if ((bytes += piece.value.byteLength) > RESPONSE_BYTES) {
            await reader.cancel();
            throw new DatastoreCliError('Device response exceeds 16 MiB; reduce the row/table limit');
          }
          pieces.push(piece.value);
        }
      } finally { reader.releaseLock(); }
      let payload: Envelope<T>;
      try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(pieces))) as Envelope<T>; }
      catch { throw new DatastoreCliError(`Device returned a non-JSON response (HTTP ${response.status})`); }
      if (!response.ok || payload.ok !== true) throw new DatastoreCliError(payload.error?.message ?? `Device request failed (HTTP ${response.status})`, 1, payload.error?.code ?? 'device_failed');
      return route === '/health' ? payload as unknown as T : payload.data as T;
    } catch (reason) {
      if (reason instanceof DatastoreCliError) throw reason;
      if (this.signal?.aborted) throw new DatastoreCliError('Operation interrupted; cancellation/cleanup requested', 130, 'interrupted');
      if (timeout.aborted) throw new DatastoreCliError('Device request timed out; no operation is automatically retried', 4, 'timeout');
      throw new DatastoreCliError(reason instanceof Error ? reason.message : String(reason), 1, 'transport_failed');
    }
  }
}

export function resourceSegment(value: string): string {
  if (!value || value.includes('\0')) throw new DatastoreCliError('Resource name is empty or invalid', 2, 'invalid_arguments');
  return encodeURIComponent(value);
}
