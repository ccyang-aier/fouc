'use client';

import { useSyncExternalStore } from 'react';

export type SidebarTag = { id: string; name: string };
const prefix = 'fouc.project.sidebar-tags.';
const empty: SidebarTag[] = [];
const snapshots = new Map<string, SidebarTag[]>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) snapshots.clear();
    else if (event.key.startsWith(prefix)) snapshots.delete(event.key.slice(prefix.length));
    else return;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

function read(scopeKey: string) {
  const cached = snapshots.get(scopeKey);
  if (cached) return cached;
  let tags: SidebarTag[];
  try { tags = JSON.parse(window.localStorage.getItem(prefix + scopeKey) ?? '[]') as SidebarTag[]; }
  catch { tags = []; }
  snapshots.set(scopeKey, tags);
  return tags;
}

export function saveSidebarTags(scopeKey: string, tags: SidebarTag[]) {
  window.localStorage.setItem(prefix + scopeKey, JSON.stringify(tags));
  snapshots.set(scopeKey, tags);
  listeners.forEach(listener => listener());
}

export function useSidebarTags(scopeKey: string | null) {
  return useSyncExternalStore(subscribe, () => scopeKey ? read(scopeKey) : empty, () => empty);
}
