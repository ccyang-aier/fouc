'use client';

import { useSyncExternalStore } from 'react';
type Preferences = { favorites: string[]; muted: string[]; read: Record<string, string> };
const empty: Preferences = { favorites: [], muted: [], read: {} };
const prefix = 'fouc.channel-preferences.';
const cache = new Map<string, Preferences>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) cache.clear();
    else if (event.key.startsWith(prefix)) cache.delete(event.key.slice(prefix.length));
    else return;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}
function read(scope: string) {
  const existing = cache.get(scope);
  if (existing) return existing;
  let value = empty;
  try { value = { ...empty, ...JSON.parse(window.localStorage.getItem(prefix + scope) ?? '{}') }; } catch { /* Local preferences do not grant channel access. */ }
  cache.set(scope, value);
  return value;
}
export function useChannelPreferences(scope: string | null) {
  const value = useSyncExternalStore(subscribe, () => scope ? read(scope) : empty, () => empty);
  function update(next: Preferences) {
    if (!scope) return;
    window.localStorage.setItem(prefix + scope, JSON.stringify(next));
    cache.set(scope, next);
    listeners.forEach(listener => listener());
  }
  return {
    ...value,
    toggle(kind: 'favorites' | 'muted', id: string) { const current = read(scope ?? ''); update({ ...current, [kind]: current[kind].includes(id) ? current[kind].filter(item => item !== id) : [...current[kind], id] }); },
    markRead(id: string, timestamp: string) { const current = read(scope ?? ''); if (current.read[id] !== timestamp) update({ ...current, read: { ...current.read, [id]: timestamp } }); },
  };
}
