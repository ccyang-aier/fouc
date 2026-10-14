'use client';
import { type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-layout.messages';
import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  defaultGridLayout,
  GRID_LAYOUT_PREFIX,
  loadGridLayout,
  saveGridLayout,
  type GridLayout,
} from './model';
const serverLayout = defaultGridLayout(),
  layouts = new Map<string, GridLayout>(),
  listeners = new Map<string, Set<() => void>>();
function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
function snapshot(scope: string, locale?: Locale): GridLayout {
  let layout = layouts.get(scope);
  if (!layout) {
    layout = loadGridLayout(storage(), scope, locale);
    layouts.set(scope, layout);
    if (layouts.size > 128) {
      for (const key of layouts.keys()) {
        if (!listeners.has(key) && key !== scope) {
          layouts.delete(key);
          break;
        }
      }
    }
  }
  return layout;
}
function changed(event: StorageEvent, locale?: Locale) {
  for (const scope of listeners.keys())
    if (event.key === null || event.key === GRID_LAYOUT_PREFIX + scope) {
      layouts.set(scope, loadGridLayout(storage(), scope, locale));
      for (const listener of listeners.get(scope) ?? []) listener();
    }
}
/** Scope is supplied by the resource owner and includes connection identity. Unscoped grids stay local. */
export function useGridLayout(scope: string | undefined, onNotice: (message: string) => void) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [local, setLocal] = useState(defaultGridLayout);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!scope) return () => {};
      if (!listeners.size) window.addEventListener('storage', (arg0) => changed(arg0));
      const entries = listeners.get(scope) ?? new Set<() => void>();
      entries.add(listener);
      listeners.set(scope, entries);
      return () => {
        entries.delete(listener);
        if (!entries.size) listeners.delete(scope);
        if (!listeners.size) window.removeEventListener('storage', (arg0) => changed(arg0));
      };
    },
    [scope],
  );
  const getSnapshot = useCallback(() => (scope ? snapshot(scope) : serverLayout), [scope]);
  const persisted = useSyncExternalStore(subscribe, getSnapshot, () => serverLayout);
  function changeLayout(next: GridLayout, persist = true) {
    if (!scope) {
      setLocal(next);
      return;
    }
    layouts.set(scope, next);
    for (const listener of listeners.get(scope) ?? []) listener();
    if (persist && !saveGridLayout(storage(), scope, next))
      onNotice(tConnector('layoutAppliedButBrowserStorageWasUnavailableDefaultsWillBe'));
  }
  return { layout: scope ? persisted : local, changeLayout };
}
