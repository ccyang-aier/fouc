"use client"

import { useCallback, useState, useSyncExternalStore } from 'react'
import { defaultGridLayout, GRID_LAYOUT_PREFIX, loadGridLayout, saveGridLayout, type GridLayout } from './model'

const serverLayout = defaultGridLayout(), layouts = new Map<string, GridLayout>(), listeners = new Map<string, Set<() => void>>()
function storage(): Storage | undefined { try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined } }
function snapshot(scope: string): GridLayout {
  let layout = layouts.get(scope)
  if (!layout) { layout = loadGridLayout(storage(), scope); layouts.set(scope, layout); if (layouts.size > 128) { for (const key of layouts.keys()) { if (!listeners.has(key) && key !== scope) { layouts.delete(key); break } } } }
  return layout
}
function changed(event: StorageEvent) {
  for (const scope of listeners.keys()) if (event.key === null || event.key === GRID_LAYOUT_PREFIX + scope) { layouts.set(scope, loadGridLayout(storage(), scope)); for (const listener of listeners.get(scope) ?? []) listener() }
}
/** Scope is supplied by the resource owner and includes workspace identity. Unscoped grids stay local. */
export function useGridLayout(scope: string | undefined, onNotice: (message: string) => void) {
  const [local, setLocal] = useState(defaultGridLayout)
  const subscribe = useCallback((listener: () => void) => {
    if (!scope) return () => {}
    if (!listeners.size) window.addEventListener('storage', changed)
    const entries = listeners.get(scope) ?? new Set<() => void>(); entries.add(listener); listeners.set(scope, entries)
    return () => { entries.delete(listener); if (!entries.size) listeners.delete(scope); if (!listeners.size) window.removeEventListener('storage', changed) }
  }, [scope])
  const getSnapshot = useCallback(() => scope ? snapshot(scope) : serverLayout, [scope])
  const persisted = useSyncExternalStore(subscribe, getSnapshot, () => serverLayout)
  function changeLayout(next: GridLayout, persist = true) {
    if (!scope) { setLocal(next); return }
    layouts.set(scope, next)
    for (const listener of listeners.get(scope) ?? []) listener()
    if (persist && !saveGridLayout(storage(), scope, next)) onNotice('布局已应用；浏览器未允许保存，下次打开将恢复默认布局')
  }
  return { layout: scope ? persisted : local, changeLayout }
}
