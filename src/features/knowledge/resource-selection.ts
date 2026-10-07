export type KnowledgeResource = 'local' | 'server';

export const knowledgeResourceStorageKey = 'fouc.knowledge.resource';

/** Resource selection is a user choice; authentication never changes it. */
export function readKnowledgeResource(storage: Pick<Storage, 'getItem'> | null, defaultResource: KnowledgeResource): KnowledgeResource {
  try {
    const saved = storage?.getItem(knowledgeResourceStorageKey);
    return saved === 'server' || saved === 'local' ? saved : defaultResource;
  } catch {
    return defaultResource;
  }
}

export function writeKnowledgeResource(storage: Pick<Storage, 'setItem'> | null, resource: KnowledgeResource): void {
  try {
    storage?.setItem(knowledgeResourceStorageKey, resource);
  } catch {
    // Selection remains usable in memory when preference storage is unavailable.
  }
}

export function createKnowledgeResourceSelection(storage: Pick<Storage, 'getItem' | 'setItem'> | null, defaultResource: KnowledgeResource = 'local') {
  let resource = readKnowledgeResource(storage, defaultResource);
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

export function createBrowserKnowledgeResourceSelection(defaultResource: KnowledgeResource) {
  let storage: Storage | null = null;
  try { if (typeof window !== 'undefined') storage = window.localStorage; }
  catch { /* The selection store also works without persistent storage. */ }
  return createKnowledgeResourceSelection(storage, defaultResource);
}
