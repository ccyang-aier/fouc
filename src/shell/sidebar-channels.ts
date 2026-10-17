'use client';

import { useSyncExternalStore } from 'react';

export type SidebarChannel = { id: string; name: string; pinned?: boolean };
// The navigation label changes without replacing the stored project entries.
const prefix = 'fouc.project.sidebar-tags.';
const empty: SidebarChannel[] = [];
const snapshots = new Map<string, SidebarChannel[]>();
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
  let channels: SidebarChannel[];
  try { channels = JSON.parse(window.localStorage.getItem(prefix + scopeKey) ?? '[]') as SidebarChannel[]; }
  catch { channels = []; }
  snapshots.set(scopeKey, channels);
  return channels;
}

export function saveSidebarChannels(scopeKey: string, channels: SidebarChannel[]) {
  window.localStorage.setItem(prefix + scopeKey, JSON.stringify(channels));
  snapshots.set(scopeKey, channels);
  listeners.forEach(listener => listener());
}

export function useSidebarChannels(scopeKey: string | null) {
  return useSyncExternalStore(subscribe, () => scopeKey ? read(scopeKey) : empty, () => empty);
}
