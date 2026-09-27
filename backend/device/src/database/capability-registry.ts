import {
  DATABASE_CAPABILITIES,
  type DatabaseCapabilities,
  type DatabaseCapabilitySnapshot,
} from '@fouc/shared';

type Entry = { sessionId: string; snapshot: DatabaseCapabilitySnapshot | null };

/**
 * DBX treats a reconnect as a new pool generation. A late health probe for the
 * old pool must not re-enable capabilities or remove the replacement session.
 */
export class DatabaseCapabilityRegistry {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxAgeMs = 60_000, private readonly now = Date.now) {}

  begin(connectionId: string, sessionId: string): void {
    this.entries.set(connectionId, { sessionId, snapshot: null });
  }

  confirm(
    connectionId: string,
    sessionId: string,
    declared: DatabaseCapabilities,
    observed: DatabaseCapabilities,
    restrictions: DatabaseCapabilitySnapshot['restrictions'],
  ): DatabaseCapabilitySnapshot | null {
    const entry = this.entries.get(connectionId);
    if (entry?.sessionId !== sessionId) return null;

    const capabilities = Object.fromEntries(
      DATABASE_CAPABILITIES.map((key) => [key, declared[key] && observed[key]]),
    ) as DatabaseCapabilities;
    const snapshot: DatabaseCapabilitySnapshot = {
      connectionId,
      health: 'connected',
      source: 'server',
      checkedAt: this.now(),
      capabilities,
      restrictions,
    };
    entry.snapshot = snapshot;
    return snapshot;
  }

  get(connectionId: string): DatabaseCapabilitySnapshot | null {
    const entry = this.entries.get(connectionId);
    if (!entry?.snapshot) return null;
    if (this.now() - entry.snapshot.checkedAt > this.maxAgeMs) {
      entry.snapshot = null;
      return null;
    }
    return entry.snapshot;
  }

  disconnect(connectionId: string, sessionId: string): void {
    if (this.entries.get(connectionId)?.sessionId === sessionId) this.entries.delete(connectionId);
  }
}
