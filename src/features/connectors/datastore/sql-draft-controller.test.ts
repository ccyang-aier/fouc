import { expect, test } from 'bun:test';
import type { SqlDraftSnapshot, SqlDraftState } from '@fouc/shared';
import { SqlDraftController } from './sql-draft-controller';
import { closeSqlTabs, mergeSqlDrafts, navigateSqlTabs, newSqlTab, pinSqlTab, reorderSqlTab, sqlTabSaveable, visitSqlTab } from './sql-tabs';

function initial(): SqlDraftSnapshot { const tab = newSqlTab('db', 'public'); return { tabs: [tab], activeTabId: tab.id }; }

test('first ready publication includes initialization and cannot overwrite an immediately opened query', async () => {
  const seed = newSqlTab('db', 'public'), requested = newSqlTab('db', 'public')
  let remote: SqlDraftState = { tabs: [], activeTabId: null, version: null, updatedAt: null }
  const controller = new SqlDraftController({ read: async () => remote, write: async snapshot => {
    remote = { ...snapshot, version: 'saved', updatedAt: 1 }; return remote
  } }, () => ({ tabs: [seed], activeTabId: seed.id }))
  let firstReady: string[] | null = null
  controller.subscribe(() => {
    const snapshot = controller.getSnapshot()
    if (!snapshot.ready || firstReady) return
    firstReady = snapshot.tabs.map(tab => tab.id)
    controller.update(current => ({ tabs: [...current.tabs, requested], activeTabId: requested.id }))
  })
  await controller.load()
  expect(firstReady).toEqual([seed.id])
  expect(controller.getSnapshot().tabs.map(tab => tab.id)).toEqual([seed.id, requested.id])
  await controller.flush()
  expect(remote.tabs.map(tab => tab.id)).toEqual([seed.id, requested.id])
})
test('debounced saves are serialized and a leave flush includes edits made while its first write is in flight', async () => {
  let remote: SqlDraftState = { ...initial(), version: 'v0', updatedAt: 0 }, active = 0, maximum = 0;
  const releases: (() => void)[] = [], writes: string[] = [];
  const controller = new SqlDraftController({ read: async () => remote, write: async (snapshot, version) => {
    expect(version).toBe(remote.version); active++; maximum = Math.max(maximum, active); writes.push(snapshot.tabs[0].sql);
    await new Promise<void>((resolve) => releases.push(resolve)); active--;
    remote = { ...snapshot, version: `v${writes.length}`, updatedAt: writes.length }; return remote;
  } }, initial);
  await controller.load();
  controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => ({ ...tab, sql: 'first' })) }));
  const first = controller.flush(); await new Promise((resolve) => setTimeout(resolve, 0));
  controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => ({ ...tab, sql: 'latest' })) }));
  const leave = controller.flush(); releases.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0));
  expect(writes).toEqual(['first', 'latest']); releases.shift()!(); await Promise.all([first, leave]);
  expect(maximum).toBe(1); expect(controller.getSnapshot().pending).toBe(false); expect(remote.tabs[0].sql).toBe('latest');
});
test('save failure retains SQL and version, retries safely, and inspection does not silently adopt a concurrent window', async () => {
  let remote: SqlDraftState = { ...initial(), version: 'old', updatedAt: 1 }, fail = true;
  const controller = new SqlDraftController({ read: async () => remote, write: async (snapshot, version) => {
    if (fail) throw new Error('network down'); if (version !== remote.version) throw new Error('concurrent window');
    remote = { ...snapshot, version: 'saved', updatedAt: 2 }; return remote;
  } }, initial);
  await controller.load(); controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => ({ ...tab, sql: '' })) }));
  await expect(controller.flush()).rejects.toThrow('network down'); expect(controller.getSnapshot().tabs[0].sql).toBe(''); expect(controller.getSnapshot().version).toBe('old');
  fail = false; remote = { ...remote, version: 'other', tabs: remote.tabs.map((tab) => ({ ...tab, sql: 'remote' })) };
  await expect(controller.flush()).rejects.toThrow('concurrent');
  const inspected = await controller.inspectRemote(); expect(controller.getSnapshot().tabs[0].sql).toBe('');
  const merged = mergeSqlDrafts(inspected, controller.getSnapshot()); controller.adoptRemote(inspected); controller.edit(merged); await controller.flush();
  expect(remote.tabs.map((tab) => tab.sql)).toEqual(['remote', '']); expect(remote.tabs[1].savedFile).toBeNull(); expect(remote.activeTabId).toBe(remote.tabs[1].id);
});
test('load errors remain retryable and explicit empty snapshots restore without creating a phantom tab', async () => {
  let fail = true;
  const controller = new SqlDraftController({ read: () => { if (fail) throw new Error('read failed'); return Promise.resolve({ tabs: [], activeTabId: null, version: 'empty', updatedAt: 1 }); }, write: async () => { throw new Error('must not write'); } }, initial);
  await controller.load(); expect(controller.getSnapshot().ready).toBe(false); fail = false; await controller.load();
  expect(controller.getSnapshot().tabs).toEqual([]); await controller.flush(); expect(controller.getSnapshot().pending).toBe(false);
});
test('tab visits skip closed entries, branch correctly, and close/pin/reorder preserve a valid active neighbour', () => {
  const a = newSqlTab('db', 'a'), b = newSqlTab('db', 'b'), c = newSqlTab('db', 'c');
  let snapshot: SqlDraftSnapshot = { tabs: [a, b, c], activeTabId: b.id }, visits = { entries: [] as string[], index: -1 };
  for (const tab of [a, b, c, b]) visits = visitSqlTab(visits, tab.id);
  const move = navigateSqlTabs(visits, -1, snapshot)!; expect(move.id).toBe(c.id);
  visits = visitSqlTab(move.visits, a.id); expect(visits.entries.at(-1)).toBe(a.id);
  expect(navigateSqlTabs(visits, 1, { ...snapshot, activeTabId: a.id })).toBeNull();
  expect(closeSqlTabs(snapshot, [b.id]).activeTabId).toBe(c.id); expect(closeSqlTabs(snapshot, [b.id, c.id]).activeTabId).toBe(a.id);
  snapshot = pinSqlTab(snapshot, c.id); expect(snapshot.tabs[0].id).toBe(c.id); expect(snapshot.activeTabId).toBe(b.id);
  expect(reorderSqlTab(snapshot, b.id, c.id)).toBe(snapshot); expect(reorderSqlTab(snapshot, b.id, a.id).tabs.map((tab) => tab.id)).toEqual([c.id, b.id, a.id]);
  expect(closeSqlTabs(snapshot, [a.id, b.id, c.id]).activeTabId).toBeNull();
  expect(sqlTabSaveable({ ...a, sql: '' })).toBe(false); expect(sqlTabSaveable({ ...a, sql: '', savedFile: { id: 'f', name: 'f.sql', version: 'v', folderId: null } })).toBe(true);
});
