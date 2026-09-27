import { expect, test } from 'bun:test';
import { createWorkspaceStore } from './workspace-store';

test('global workspace selection and local workspace management survive reload', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const store = createWorkspaceStore(storage);
  let updates = 0;
  store.subscribe(() => { updates++; });
  store.select('personal-workspace');
  expect(createWorkspaceStore(storage).getSnapshot().activeId).toBe('personal-workspace');
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
  store.select('personal-workspace');
  store.select('new-server-workspace', origin);
  expect(store.getSnapshot().activeId).toBe('personal-workspace');
  store.select('new-server-workspace', 'personal-workspace');
  expect(store.getSnapshot().activeId).toBe('new-server-workspace');
});
