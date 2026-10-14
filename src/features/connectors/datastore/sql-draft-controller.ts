import { createUiMessages, uiFailure, type UiMessage } from '../i18n/ui-message';
import { messages as connectorMessages } from './sql-draft-controller.messages';
import type { SqlDraftSnapshot, SqlDraftState } from '@fouc/shared';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface SqlDraftTransport {
  read: () => Promise<SqlDraftState>;
  write: (
    snapshot: SqlDraftSnapshot,
    version: string | null,
    keepalive: boolean,
  ) => Promise<SqlDraftState>;
}
export interface SqlDraftWorkspace extends SqlDraftState {
  ready: boolean;
  pending: boolean;
  status: 'loading' | 'ready' | 'saving' | 'error';
  error: UiMessage;
}
/** Adapted from DBX saveTabsQueue/flushPendingPersist with ownership-safe CAS. */
export class SqlDraftController {
  private state: SqlDraftWorkspace = {
    tabs: [],
    activeTabId: null,
    version: null,
    updatedAt: null,
    ready: false,
    pending: false,
    status: 'loading',
    error: '',
  };
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loading: Promise<void> | null = null;
  private saving: Promise<void> | null = null;
  private generation = 0;
  private savedGeneration = 0;
  constructor(
    private readonly transport: SqlDraftTransport | null,
    private readonly initial: () => SqlDraftSnapshot,
  ) {}
  getSnapshot = (): SqlDraftWorkspace => this.state;
  hasSubscribers(): boolean {
    return this.listeners.size > 0;
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
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
        const remote = this.transport
          ? await this.transport.read()
          : { ...this.initial(), version: null, updatedAt: null };
        const fresh = remote.version === null && remote.tabs.length === 0;
        const snapshot = fresh ? this.initial() : remote;
        const seeded = fresh && snapshot.tabs.length > 0;
        if (seeded) this.generation++;
        // Expose a complete initial snapshot once. Ready subscribers may immediately
        // open a query, so a later initialization edit must never overwrite it.
        this.publish({
          ...remote,
          ...snapshot,
          ready: true,
          status: 'ready',
          error: '',
          pending: seeded && this.transport !== null,
        });
        if (seeded) this.scheduleSave();
      } catch (reason) {
        this.publish({
          status: 'error',
          error: uiFailure(reason),
        });
      } finally {
        this.loading = null;
      }
    });
    return this.loading;
  }
  edit(snapshot: SqlDraftSnapshot): void {
    if (
      !this.state.ready ||
      (snapshot.tabs === this.state.tabs && snapshot.activeTabId === this.state.activeTabId)
    )
      return;
    this.generation++;
    this.publish({ ...snapshot, pending: this.transport !== null });
    this.scheduleSave();
  }
  private scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.transport && this.state.pending && this.state.status !== 'error')
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush().catch(() => undefined);
      }, 300);
  }
  update(operation: (snapshot: SqlDraftSnapshot) => SqlDraftSnapshot): void {
    this.edit(operation(this.state));
  }
  /** One request at a time; callers wait until edits made during a save have also landed. */
  async flush(keepalive = false): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.state.ready) {
      await this.load();
      if (!this.state.ready)
        throw connectorUiMessages.error('draftLoadFailure', {
          reason: this.state.error || connectorUiMessages.message('deviceDraftHasNotLoaded'),
        });
    }
    if (this.saving) {
      await this.saving;
      if (this.state.pending) await this.flush(keepalive);
      return;
    }
    if (!this.transport || !this.state.pending) return;
    const sentGeneration = this.generation,
      snapshot = { tabs: this.state.tabs, activeTabId: this.state.activeTabId },
      version = this.state.version;
    this.publish({ status: 'saving', error: '' });
    this.saving = Promise.resolve().then(async () => {
      try {
        const saved = await this.transport!.write(snapshot, version, keepalive);
        this.savedGeneration = sentGeneration;
        this.publish({
          version: saved.version,
          updatedAt: saved.updatedAt,
          pending: this.generation !== this.savedGeneration,
          status: 'ready',
        });
      } catch (reason) {
        this.publish({
          status: 'error',
          error: uiFailure(reason),
          pending: true,
        });
        throw reason;
      } finally {
        this.saving = null;
      }
    });
    await this.saving;
    if (this.state.pending) await this.flush(keepalive);
  }
  async inspectRemote(): Promise<SqlDraftState> {
    if (!this.transport) throw connectorUiMessages.error('thisConnectionHasNoDeviceDraftStorage');
    if (this.saving) await this.saving.catch(() => undefined);
    return this.transport.read();
  }
  adoptRemote(remote: SqlDraftState): void {
    if (this.saving)
      throw connectorUiMessages.error('waitForTheCurrentDraftToFinishSavingBeforeRestoring');
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.generation++;
    this.savedGeneration = this.generation;
    this.publish({ ...remote, ready: true, pending: false, status: 'ready', error: '' });
  }
}
