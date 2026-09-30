'use client';

import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type DocumentAppearance = { width: 'standard' | 'wide' | 'compact'; font: 'default' | 'serif' | 'mono'; size: 'small' | 'standard' | 'large' };
const defaults: DocumentAppearance = { width: 'standard', font: 'default', size: 'standard' };

function createAppearanceStore(key: string) {
  let value = defaults;
  let loaded = false;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getServerSnapshot: () => defaults,
    getSnapshot() {
      if (!loaded) {
        loaded = true;
        try {
          const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as DocumentAppearance | null;
          if (saved && ['standard', 'wide', 'compact'].includes(saved.width) && ['default', 'serif', 'mono'].includes(saved.font) && ['small', 'standard', 'large'].includes(saved.size)) value = saved;
        } catch { /* View preferences remain available in memory. */ }
      }
      return value;
    },
    update(patch: Partial<DocumentAppearance>) {
      value = { ...value, ...patch };
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* No document content depends on this preference. */ }
      listeners.forEach((listener) => listener());
    },
  };
}

const AppearanceContext = createContext<{ appearance: DocumentAppearance; update: (patch: Partial<DocumentAppearance>) => void } | null>(null);
export function DocumentAppearanceProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [store] = useState(() => createAppearanceStore(`fouc.document.appearance:${scope}`));
  const appearance = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return <AppearanceContext.Provider value={{ appearance, update: store.update }}>{children}</AppearanceContext.Provider>;
}
export function useDocumentAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('DocumentAppearanceProvider is required');
  return context;
}
