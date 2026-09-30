'use client';

import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { documentFonts, documentSizes, documentWidth } from '@/lib/editor-appearance-options';
import { useEditorAppearance, type EditorAppearance } from '@/lib/editor-appearance';

type DocumentOverrides = Partial<Pick<EditorAppearance, 'width' | 'font' | 'size'>>;
export type DocumentAppearance = EditorAppearance;
const defaults: DocumentOverrides = {};

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
          const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as DocumentOverrides | null;
          if (saved && (saved.width === undefined || (Number.isInteger(saved.width) && saved.width >= documentWidth.min && saved.width <= documentWidth.max)) && (saved.font === undefined || documentFonts.some(({ id }) => id === saved.font)) && (saved.size === undefined || documentSizes.some(({ id }) => id === saved.size))) value = saved;
          else if (saved) localStorage.removeItem(key);
        } catch { /* View preferences remain available in memory. */ }
      }
      return value;
    },
    update(patch: DocumentOverrides) {
      value = { ...value, ...patch };
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* No document content depends on this preference. */ }
      listeners.forEach((listener) => listener());
    },
  };
}

const AppearanceContext = createContext<{ appearance: DocumentAppearance; update: (patch: DocumentOverrides) => void } | null>(null);
export function DocumentAppearanceProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [store] = useState(() => createAppearanceStore(`fouc.document.appearance:${scope}`));
  const overrides = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const { appearance: globalAppearance } = useEditorAppearance();
  const appearance = { ...globalAppearance, ...overrides };
  return <AppearanceContext.Provider value={{ appearance, update: store.update }}>{children}</AppearanceContext.Provider>;
}
export function useDocumentAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('DocumentAppearanceProvider is required');
  return context;
}
