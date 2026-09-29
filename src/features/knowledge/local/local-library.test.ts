import { expect, test } from 'bun:test';
import { createLocalLibraryStore, newLocalDocument } from './local-library';

test('local documents survive reload without inventing a server user', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createLocalLibraryStore(storage, 'workspace-a');
  first.update((current) => ({ ...current, documents: [newLocalDocument('personal', '本机文档')] }));
  const second = createLocalLibraryStore(storage, 'workspace-a');
  expect(second.getSnapshot().documents[0].title).toBe('本机文档');
  expect(values.size).toBe(1);
});

test('a storage write failure does not publish content as saved', () => {
  const store = createLocalLibraryStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, 'workspace-a');
  expect(() => store.update((current) => ({ ...current, documents: [newLocalDocument('personal', '未保存')] }))).toThrow('quota');
  expect(store.getSnapshot().documents).toEqual([]);
});

test('workspace switching isolates libraries and keeps edits in their original workspace', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const a = createLocalLibraryStore(storage, 'a');
  const b = createLocalLibraryStore(storage, 'b');
  a.update((current) => ({ ...current, bases: [...current.bases, { id: 'base-a', name: 'A 知识库' }], documents: [newLocalDocument('base-a', 'A 的文档')] }));
  expect(b.getSnapshot().documents).toEqual([]);
  expect(b.getSnapshot().bases.some((base) => base.id === 'base-a')).toBe(false);
  b.update((current) => ({ ...current, documents: [newLocalDocument('personal', 'B 的文档')] }));
  expect(createLocalLibraryStore(storage, 'a').getSnapshot().documents.map((doc) => doc.title)).toEqual(['A 的文档']);
  expect(createLocalLibraryStore(storage, 'b').getSnapshot().documents.map((doc) => doc.title)).toEqual(['B 的文档']);
});

test('a new local library is empty and tags stay within its workspace', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createLocalLibraryStore(storage, 'a');
  expect(first.getSnapshot()).toEqual({ bases: [], folders: [], documents: [], tags: [] });
  first.update((current) => ({ ...current, tags: [{ id: 'tag-a', baseId: 'base-a', name: '研究', pageIds: ['page-a'] }] }));
  expect(createLocalLibraryStore(storage, 'a').getSnapshot().tags[0].pageIds).toEqual(['page-a']);
  expect(createLocalLibraryStore(storage, 'b').getSnapshot().tags).toEqual([]);
});
