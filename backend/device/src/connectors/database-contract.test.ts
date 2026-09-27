import { describe, expect, test } from 'bun:test';
import {
  DATABASE_CAPABILITIES,
  canUseDatabaseCapability,
  type DatabaseCapabilitySnapshot,
  type DatabaseCapabilities,
} from '@fouc/shared';

const capabilities = Object.fromEntries(DATABASE_CAPABILITIES.map((key) => [key, false])) as DatabaseCapabilities;

function snapshot(overrides: Partial<DatabaseCapabilitySnapshot> = {}): DatabaseCapabilitySnapshot {
  return {
    connectionId: 'connection-1',
    health: 'connected',
    source: 'server',
    checkedAt: Date.now(),
    capabilities: { ...capabilities, metadataBrowse: true, tableDataEdit: true },
    restrictions: { readOnly: false, production: false },
    ...overrides,
  };
}

describe('database capability gate', () => {
  test('requires a connected server snapshot and an enabled capability', () => {
    expect(canUseDatabaseCapability(null, 'metadataBrowse')).toBe(false);
    expect(canUseDatabaseCapability(snapshot({ health: 'disconnected' }), 'metadataBrowse')).toBe(false);
    expect(canUseDatabaseCapability(snapshot(), 'tableImport')).toBe(false);
    expect(canUseDatabaseCapability(snapshot(), 'metadataBrowse')).toBe(true);
  });

  test('blocks writes on a read-only connection without hiding reads', () => {
    const readOnly = snapshot({ restrictions: { readOnly: true, production: false } });
    expect(canUseDatabaseCapability(readOnly, 'tableDataEdit', 'write')).toBe(false);
    expect(canUseDatabaseCapability(readOnly, 'metadataBrowse')).toBe(true);
  });
});
