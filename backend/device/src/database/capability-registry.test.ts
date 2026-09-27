import { describe, expect, test } from 'bun:test';
import { DATABASE_CAPABILITIES, type DatabaseCapabilities } from '@fouc/shared';
import { DatabaseCapabilityRegistry } from './capability-registry';

function capabilities(enabled: string[]): DatabaseCapabilities {
  return Object.fromEntries(DATABASE_CAPABILITIES.map((key) => [key, enabled.includes(key)])) as DatabaseCapabilities;
}

describe('database capability registry', () => {
  test('only publishes the intersection of declared and observed capabilities', () => {
    const registry = new DatabaseCapabilityRegistry();
    registry.begin('mysql-1', 'session-1');
    expect(registry.get('mysql-1')).toBeNull();

    const snapshot = registry.confirm(
      'mysql-1', 'session-1',
      capabilities(['metadataBrowse', 'tableDataEdit']),
      capabilities(['metadataBrowse', 'sqlExplain']),
      { readOnly: false, production: false },
    );
    expect(snapshot?.capabilities.metadataBrowse).toBe(true);
    expect(snapshot?.capabilities.tableDataEdit).toBe(false);
    expect(snapshot?.capabilities.sqlExplain).toBe(false);
  });

  test('ignores a stale probe and disconnect from an earlier session', () => {
    const registry = new DatabaseCapabilityRegistry();
    registry.begin('mysql-1', 'old');
    registry.begin('mysql-1', 'new');
    expect(registry.confirm('mysql-1', 'old', capabilities(['queryExecution']), capabilities(['queryExecution']), { readOnly: false, production: false })).toBeNull();
    registry.confirm('mysql-1', 'new', capabilities(['queryExecution']), capabilities(['queryExecution']), { readOnly: false, production: false });
    registry.disconnect('mysql-1', 'old');
    expect(registry.get('mysql-1')?.capabilities.queryExecution).toBe(true);
    registry.disconnect('mysql-1', 'new');
    expect(registry.get('mysql-1')).toBeNull();
  });

  test('expires capabilities after the probe age limit', () => {
    let now = 1_000;
    const registry = new DatabaseCapabilityRegistry(500, () => now);
    registry.begin('mysql-1', 'session-1');
    registry.confirm('mysql-1', 'session-1', capabilities(['queryExecution']), capabilities(['queryExecution']), { readOnly: false, production: false });
    now = 1_501;
    expect(registry.get('mysql-1')).toBeNull();
  });
});
