'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  readTablePageSize,
  saveTablePageSize,
  TABLE_PAGE_SIZE_STORAGE_PREFIX,
} from './table-pagination-model';

const changeEvent = 'fouc-table-page-size-change';
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
/** Like grid layouts, defaults belong to the connection/database in this app's local profile. */
export function useTablePageSize(scope: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const changed = (event: Event) => {
        if (
          event instanceof StorageEvent
            ? event.key === null || event.key === TABLE_PAGE_SIZE_STORAGE_PREFIX + scope
            : (event as CustomEvent<string>).detail === scope
        )
          listener();
      };
      window.addEventListener('storage', changed);
      window.addEventListener(changeEvent, changed);
      return () => {
        window.removeEventListener('storage', changed);
        window.removeEventListener(changeEvent, changed);
      };
    },
    [scope],
  );
  const snapshot = useCallback(() => readTablePageSize(storage(), scope), [scope]);
  const defaultSize = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_TABLE_PAGE_SIZE);
  function setDefault(size: number): boolean {
    if (!saveTablePageSize(storage(), scope, size)) return false;
    window.dispatchEvent(new CustomEvent(changeEvent, { detail: scope }));
    return true;
  }
  return { defaultSize, setDefault };
}
