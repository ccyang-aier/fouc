import type { JSONContent } from '@tiptap/core';

export type LocalDocument = { id: string; baseId: string; folderId?: string; title: string; body: JSONContent; starred: boolean; draft: boolean; deleted: boolean; updatedAt: string; creator?: string; source?: string; indexStatus?: string };
export type LocalTag = { id: string; baseId: string; name: string; pageIds: string[] };
export type LocalLibrary = { bases: { id: string; name: string }[]; folders: { id: string; knowledgeBaseId: string; name: string }[]; documents: LocalDocument[]; tags: LocalTag[] };
export const localLibraryKey = (workspaceId: string) => `fouc.local-library.${workspaceId}`;
export const emptyLocalLibrary: LocalLibrary = { bases: [], folders: [], documents: [], tags: [] };

/** Local content stays on this device regardless of sign-in; it is never uploaded implicitly. */
export function createLocalLibraryStore(storage: Pick<Storage, 'getItem' | 'setItem'>, workspaceId: string) {
  let snapshot = emptyLocalLibrary;
  const key = localLibraryKey(workspaceId);
  const stored = storage.getItem(key);
  if (stored) snapshot = JSON.parse(stored) as LocalLibrary;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(change: (library: LocalLibrary) => LocalLibrary) {
      const next = change(snapshot);
      storage.setItem(key, JSON.stringify(next));
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

export function newLocalDocument(baseId: string, title: string): LocalDocument {
  return { id: crypto.randomUUID(), baseId, title: title.trim() || '无标题文档', body: { type: 'doc', content: [{ type: 'paragraph' }] }, starred: false, draft: false, deleted: false, updatedAt: new Date().toISOString() };
}
