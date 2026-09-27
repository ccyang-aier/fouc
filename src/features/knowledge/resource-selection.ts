export type KnowledgeResource = 'local' | 'workspace';

export const knowledgeResourceStorageKey = 'fouc.knowledge.resource';

/** Resource selection is a user choice; authentication never changes it. */
export function readKnowledgeResource(storage: Pick<Storage, 'getItem'> | null): KnowledgeResource {
  try {
    return storage?.getItem(knowledgeResourceStorageKey) === 'workspace' ? 'workspace' : 'local';
  } catch {
    return 'local';
  }
}

export function writeKnowledgeResource(storage: Pick<Storage, 'setItem'> | null, resource: KnowledgeResource): void {
  try {
    storage?.setItem(knowledgeResourceStorageKey, resource);
  } catch {
    // Selection remains usable in memory when preference storage is unavailable.
  }
}

export function createKnowledgeResourceSelection(storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
  let resource = readKnowledgeResource(storage);
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => resource,
    getServerSnapshot: (): KnowledgeResource | null => null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    select(next: KnowledgeResource) {
      if (next === resource) return;
      resource = next;
      writeKnowledgeResource(storage, next);
      for (const listener of listeners) listener();
    },
  };
}

export function createBrowserKnowledgeResourceSelection() {
  let storage: Storage | null = null;
  try { if (typeof window !== 'undefined') storage = window.localStorage; }
  catch { /* The selection store also works without persistent storage. */ }
  return createKnowledgeResourceSelection(storage);
}
