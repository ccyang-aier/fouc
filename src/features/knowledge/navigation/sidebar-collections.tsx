'use client';

import { useSyncExternalStore, type SetStateAction } from 'react';

export type Collections = { starred: string[]; tags: { id: string; name: string; pageIds: string[] }[] };
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

function readCollections(key: string): Collections {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Collections | null;
    if (parsed && stringList(parsed.starred) && Array.isArray(parsed.tags) && parsed.tags.every((tag) => tag && typeof tag.id === 'string' && typeof tag.name === 'string' && stringList(tag.pageIds))) return parsed;
  } catch { /* Browser storage may be unavailable; navigation still works in memory. */ }
  return { starred: [], tags: [] };
}

/** Personal navigation preferences scoped to the current account and knowledge base. */
const snapshots = new Map<string, Collections>();
const listeners = new Map<string, Set<() => void>>();
const empty: Collections = { starred: [], tags: [] };

export function useSidebarCollections(userId: string, workspaceId: string | null) {
  const key = `fouc.knowledge.collections:${userId}:${workspaceId}`;
  const getSnapshot = () => {
    if (!snapshots.has(key)) snapshots.set(key, readCollections(key));
    return snapshots.get(key)!;
  };
  const collections = useSyncExternalStore((listener) => {
    const group = listeners.get(key) ?? new Set<() => void>();
    group.add(listener);
    listeners.set(key, group);
    return () => { group.delete(listener); };
  }, getSnapshot, () => empty);
  function setCollections(update: SetStateAction<Collections>) {
    const next = typeof update === 'function' ? update(getSnapshot()) : update;
    snapshots.set(key, next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the in-memory preference. */ }
    for (const listener of listeners.get(key) ?? []) listener();
  }
  function toggleStar(id: string) {
    setCollections((current) => ({ ...current, starred: current.starred.includes(id) ? current.starred.filter((value) => value !== id) : [...current.starred, id] }));
  }
  return { collections, setCollections, toggleStar };
}
