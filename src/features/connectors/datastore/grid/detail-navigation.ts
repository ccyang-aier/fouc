// Adapted from DBX dataGridDetailNavigation, without a cross-application clipboard dependency.
export type DataGridDetailNavigationDelta = -1 | 1
export type DataGridDetailNavigationAxis = 'row' | 'column'
export function adjacentDataGridDetailIndex(currentIndex: number, delta: DataGridDetailNavigationDelta, itemCount: number): number | null {
  const nextIndex = currentIndex + delta
  return currentIndex < 0 || currentIndex >= itemCount || nextIndex < 0 || nextIndex >= itemCount ? null : nextIndex
}
export function detailNavigationDelta(key: string, axis: DataGridDetailNavigationAxis): DataGridDetailNavigationDelta | null {
  if (axis === 'row') return key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : null
  return key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : null
}
export function shouldIgnoreDataGridDetailNavigation(event: Pick<KeyboardEvent, 'defaultPrevented' | 'target' | 'currentTarget' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return true
  const target = event.target as { closest?: (selector: string) => unknown } | null
  if (target?.closest?.('input, textarea, [contenteditable="true"], [role="textbox"]')) return true
  const overlay = target?.closest?.('[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="dialog-content"], [role="menu"], [role="listbox"]')
  return overlay != null && overlay !== event.currentTarget
}
