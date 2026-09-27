import type { JSONContent } from '@tiptap/core';

export type LocalDocument = { id: string; baseId: string; title: string; body: JSONContent; starred: boolean; draft: boolean; deleted: boolean; updatedAt: string };
export type LocalLibrary = { bases: { id: string; name: string }[]; documents: LocalDocument[] };
export const localLibraryKey = 'fouc.local-library';
export const emptyLocalLibrary: LocalLibrary = { bases: [{ id: 'personal', name: '本机知识库' }], documents: [] };

/** Guest content stays on this device. It is never treated as an authenticated principal or uploaded implicitly. */
export function createLocalLibraryStore(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  let snapshot = emptyLocalLibrary;
  const stored = storage.getItem(localLibraryKey);
  if (stored) snapshot = JSON.parse(stored) as LocalLibrary;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(change: (library: LocalLibrary) => LocalLibrary) {
      const next = change(snapshot);
      storage.setItem(localLibraryKey, JSON.stringify(next));
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

export function newLocalDocument(baseId: string, title: string): LocalDocument {
  return { id: crypto.randomUUID(), baseId, title: title.trim() || '无标题文档', body: { type: 'doc', content: [{ type: 'paragraph' }] }, starred: false, draft: false, deleted: false, updatedAt: new Date().toISOString() };
}
