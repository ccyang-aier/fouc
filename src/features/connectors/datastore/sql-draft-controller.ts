import type { SqlDraftSnapshot, SqlDraftState } from '@fouc/shared';

export interface SqlDraftTransport {
  read: () => Promise<SqlDraftState>;
  write: (snapshot: SqlDraftSnapshot, version: string | null, keepalive: boolean) => Promise<SqlDraftState>;
}
export interface SqlDraftWorkspace extends SqlDraftState {
  ready: boolean;
  pending: boolean;
  status: 'loading' | 'ready' | 'saving' | 'error';
  error: string;
}

/** Adapted from DBX saveTabsQueue/flushPendingPersist with ownership-safe CAS. */
export class SqlDraftController {
  private state: SqlDraftWorkspace = { tabs: [], activeTabId: null, version: null, updatedAt: null, ready: false, pending: false, status: 'loading', error: '' };
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loading: Promise<void> | null = null;
  private saving: Promise<void> | null = null;
  private generation = 0;
  private savedGeneration = 0;
  constructor(private readonly transport: SqlDraftTransport | null, private readonly initial: () => SqlDraftSnapshot) {}
  getSnapshot = (): SqlDraftWorkspace => this.state;
  hasSubscribers(): boolean { return this.listeners.size > 0; }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<SqlDraftWorkspace>): void {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener();
  }
  load(): Promise<void> {
    if (this.state.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.publish({ status: 'loading', error: '' });
    this.loading = Promise.resolve().then(async () => {
      try {
        const remote = this.transport ? await this.transport.read() : { ...this.initial(), version: null, updatedAt: null };
        this.publish({ ...remote, ready: true, status: 'ready', error: '', pending: false });
        if (remote.version === null && remote.tabs.length === 0) this.edit(this.initial());
      } catch (reason) { this.publish({ status: 'error', error: reason instanceof Error ? reason.message : String(reason) }); }
      finally { this.loading = null; }
    });
    return this.loading;
  }
  edit(snapshot: SqlDraftSnapshot): void {
    if (!this.state.ready || (snapshot.tabs === this.state.tabs && snapshot.activeTabId === this.state.activeTabId)) return;
    this.generation++;
    this.publish({ ...snapshot, pending: this.transport !== null });
    if (this.timer) clearTimeout(this.timer);
    if (this.transport && this.state.status !== 'error') this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => undefined); }, 300);
  }
  update(operation: (snapshot: SqlDraftSnapshot) => SqlDraftSnapshot): void { this.edit(operation(this.state)); }
  /** One request at a time; callers wait until edits made during a save have also landed. */
  async flush(keepalive = false): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.state.ready) { await this.load(); if (!this.state.ready) throw new Error(this.state.error || '设备草稿尚未加载'); }
    if (this.saving) { await this.saving; if (this.state.pending) await this.flush(keepalive); return; }
    if (!this.transport || !this.state.pending) return;
    const sentGeneration = this.generation, snapshot = { tabs: this.state.tabs, activeTabId: this.state.activeTabId }, version = this.state.version;
    this.publish({ status: 'saving', error: '' });
    this.saving = Promise.resolve().then(async () => {
      try {
        const saved = await this.transport!.write(snapshot, version, keepalive);
        this.savedGeneration = sentGeneration;
        this.publish({ version: saved.version, updatedAt: saved.updatedAt, pending: this.generation !== this.savedGeneration, status: 'ready' });
      } catch (reason) {
        this.publish({ status: 'error', error: reason instanceof Error ? reason.message : String(reason), pending: true });
        throw reason;
      } finally { this.saving = null; }
    });
    await this.saving;
    if (this.state.pending) await this.flush(keepalive);
  }
  async inspectRemote(): Promise<SqlDraftState> {
    if (!this.transport) throw new Error('当前连接没有设备草稿存储');
    if (this.saving) await this.saving.catch(() => undefined);
    return this.transport.read();
  }
  adoptRemote(remote: SqlDraftState): void {
    if (this.saving) throw new Error('等待当前草稿保存结束后再恢复');
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.generation++; this.savedGeneration = this.generation;
    this.publish({ ...remote, ready: true, pending: false, status: 'ready', error: '' });
  }
}
