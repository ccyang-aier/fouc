import { expect, test } from 'bun:test';
import { createLocalLibraryStore, newLocalDocument } from './local-library';

test('local documents survive reload without inventing a server user', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createLocalLibraryStore(storage);
  first.update((current) => ({ ...current, documents: [newLocalDocument('personal', '本机文档')] }));
  const second = createLocalLibraryStore(storage);
  expect(second.getSnapshot().documents[0].title).toBe('本机文档');
  expect(values.size).toBe(1);
});

test('a storage write failure does not publish content as saved', () => {
  const store = createLocalLibraryStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
  expect(() => store.update((current) => ({ ...current, documents: [newLocalDocument('personal', '未保存')] }))).toThrow('quota');
  expect(store.getSnapshot().documents).toEqual([]);
});
