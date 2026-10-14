'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { loadQueryChartConfig, saveQueryChartConfig, type QueryChartConfig } from './model';

const snapshots = new Map<string, QueryChartConfig | null>();
function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
function subscribe() {
  return () => {};
}
/** The owner supplies a connection-scoped resource key. Unscoped charts never persist. */
export function useStoredChartConfig(scope: string | undefined) {
  const getSnapshot = useCallback(() => {
    if (!scope) return null;
    if (!snapshots.has(scope)) {
      snapshots.set(scope, loadQueryChartConfig(storage(), scope));
      if (snapshots.size > 128) {
        const oldest = snapshots.keys().next().value;
        if (oldest && oldest !== scope) snapshots.delete(oldest);
      }
    }
    return snapshots.get(scope) ?? null;
  }, [scope]);
  const saved = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  return {
    saved,
    save: (config: QueryChartConfig) => {
      if (!saveQueryChartConfig(storage(), scope, config)) return false;
      if (scope) snapshots.set(scope, config);
      return true;
    },
  };
}
