import { expect, test } from 'bun:test';
import { createWorkspaceStore, DEFAULT_SPACE } from './workspace-store';

test('the real local default workspace remains available without an account', () => {
  const store = createWorkspaceStore(null);
  expect(store.getSnapshot().localSpaces).toEqual([DEFAULT_SPACE]);
  store.updateSpaces([]);
  expect(store.getSnapshot().localSpaces).toEqual([DEFAULT_SPACE]);
});

test('global workspace selection and local workspace management survive reload', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const store = createWorkspaceStore(storage);
  let updates = 0;
  store.subscribe(() => { updates++; });
  const target = 'other-workspace';
  store.select(target);
  expect(createWorkspaceStore(storage).getSnapshot().activeId).toBe(target);
  store.create();
  const createdId = store.getSnapshot().activeId;
  store.updateSpaces(store.getSnapshot().localSpaces.map((space) => space.id === createdId ? { ...space, label: '研究空间', pinned: false } : space));
  const restored = createWorkspaceStore(storage).getSnapshot();
  expect(restored.activeId).toBe(createdId);
  expect(restored.localSpaces.find((space) => space.id === createdId)).toMatchObject({ label: '研究空间', pinned: false });
  expect(updates).toBe(3);
});

test('server workspace IDs remain real IDs and server metadata is never persisted as local data', () => {
  const store = createWorkspaceStore(null);
  store.updateSpaces([...store.getSnapshot().localSpaces, { id: 'server-id', label: '服务端空间', kind: 'server', pinned: false }]);
  store.select('server-id');
  expect(store.getSnapshot().activeId).toBe('server-id');
  expect(store.getSnapshot().localSpaces.some((space) => space.id === 'server-id')).toBe(false);
  expect(store.getSnapshot().serverPins['server-id']).toBe(false);
});

test('a late workspace creation response cannot replace a newer user selection', () => {
  const store = createWorkspaceStore(null);
  const origin = store.getSnapshot().activeId;
  const target = 'other-workspace';
  store.select(target);
  store.select('new-server-workspace', origin);
  expect(store.getSnapshot().activeId).toBe(target);
  store.select('new-server-workspace', target);
  expect(store.getSnapshot().activeId).toBe('new-server-workspace');
});

test('known server scopes remain protected and pin changes preserve device metadata', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const store = createWorkspaceStore(storage);
  const first = store.getSnapshot().localSpaces[0]!;
  store.rememberServerScopes([first.id]);
  store.updateSpaces(store.getSnapshot().localSpaces.map((space) => space.id === first.id ? { ...space, kind: 'server', pinned: false } : space));
  const restored = createWorkspaceStore(storage).getSnapshot();
  expect(first.id in restored.serverPins).toBe(true);
  expect(restored.serverPins[first.id]).toBe(false);
  expect(restored.localSpaces.find((space) => space.id === first.id)?.label).toBe(first.label);
});
