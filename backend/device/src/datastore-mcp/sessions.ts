import { openCliSession, type CliSession } from '../datastore-cli/connections';
import { DatastoreHttpClient } from '../datastore-cli/http';
import { DatastoreCliError, type CliEnvironment, type CliOptions } from '../datastore-cli/types';

type Held = { handle: string; connectionId: string; session: CliSession; expiresAt: number; active: boolean; closing: boolean; closePromise: Promise<void> | null; abort: AbortController; done: Promise<void>; finish: () => void };
const LIFETIME = 10 * 60_000;

/** Only sessions opened by this MCP process are accepted; browser write grants cannot be borrowed. */
export class DatastoreMcpSessions {
  private readonly sessions = new Map<string, Held>();
  private readonly opening = new Set<Promise<unknown>>();
  private closed = false;
  private readonly timer: ReturnType<typeof setInterval>;
  constructor(private readonly client: DatastoreHttpClient, private readonly environment: CliEnvironment, private readonly report: (message: string) => void = () => undefined) {
    this.timer = setInterval(() => { void this.expire(); }, 30_000);
    this.timer.unref();
  }
  private async expire(): Promise<void> {
    const ids = [...this.sessions.values()].filter(item => item.expiresAt <= Date.now() && !item.active).map(item => item.handle);
    await Promise.all(ids.map(id => this.close(id).catch(error => this.report(error.message))));
  }
  async open(connectionId: string, options: CliOptions) {
    if (options.connection !== connectionId || options.session) throw new DatastoreCliError('Pinned sessions require the exact granted connection ID', 3, 'session_denied');
    if (this.closed || this.sessions.size + this.opening.size >= 8) throw new DatastoreCliError('MCP session limit reached or process is closing');
    const opening = openCliSession(this.client, { ...options, connectionResolution: 'id' }, this.environment);
    this.opening.add(opening);
    try {
      const session = await opening;
      if (this.closed) { await this.client.cleanupClient().request(session.base, undefined, 'DELETE'); throw new DatastoreCliError('MCP process closed during connect'); }
      const handle = crypto.randomUUID();
      this.sessions.set(handle, { handle, connectionId, session, expiresAt: Date.now() + LIFETIME, active: false, closing: false, closePromise: null, abort: new AbortController(), done: Promise.resolve(), finish: () => undefined });
      return { session: handle, connectionId, provider: session.provider, database: session.database, readonly: true, expiresAt: Date.now() + LIFETIME };
    } finally { this.opening.delete(opening); }
  }
  async use<T>(connectionId: string, handle: string, signal: AbortSignal, action: (session: CliSession, signal: AbortSignal) => Promise<T>): Promise<T> {
    const held = this.sessions.get(handle);
    if (!held || held.connectionId !== connectionId || held.closing || held.expiresAt <= Date.now()) throw new DatastoreCliError('MCP session expired or is outside this connection grant', 3, 'session_denied');
    if (held.active) throw new DatastoreCliError('A query is already using this pinned session; wait or cancel it');
    held.active = true;
    held.done = new Promise(resolve => { held.finish = resolve; });
    const combined = AbortSignal.any([signal, held.abort.signal]);
    try {
      combined.throwIfAborted();
      const current = await this.client.request<Record<string, unknown>>(held.session.base);
      const capabilities = current.capabilities as { restrictions?: { readOnly?: boolean } } | undefined;
      if (current.readOnly !== true && capabilities?.restrictions?.readOnly !== true) throw new DatastoreCliError('Pinned native session is no longer readonly', 3, 'session_denied');
      if (current.workspaceId !== undefined && current.workspaceId !== (held.session.raw as { workspaceId?: string })?.workspaceId) throw new DatastoreCliError('Pinned native workspace changed', 3, 'session_denied');
      return await action(held.session, combined);
    } finally { held.active = false; held.finish(); }
  }
  async close(handle: string, connectionId?: string): Promise<void> {
    const held = this.sessions.get(handle);
    if (!held || connectionId && held.connectionId !== connectionId) throw new DatastoreCliError('MCP session does not exist in this connection scope', 3, 'session_denied');
    if (held.closePromise) { await held.closePromise; return; }
    held.closing = true;
    held.abort.abort(new Error('MCP session closed'));
    held.closePromise = (async () => {
      await held.done;
      try { await this.client.cleanupClient().request(held.session.base, undefined, 'DELETE'); this.sessions.delete(handle); }
      catch (reason) { held.closing = false; held.closePromise = null; throw new DatastoreCliError(`Native session close was not confirmed (${held.session.id}): ${reason instanceof Error ? reason.message : String(reason)}`); }
    })();
    await held.closePromise;
  }
  async shutdown(): Promise<void> {
    this.closed = true;
    clearInterval(this.timer);
    await Promise.allSettled([...this.opening]);
    const results = await Promise.allSettled([...this.sessions.keys()].map(id => this.close(id)));
    for (const result of results) if (result.status === 'rejected') this.report(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }
}
