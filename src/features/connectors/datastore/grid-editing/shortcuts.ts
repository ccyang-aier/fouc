export type GridEditKeyboard = { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; target?: EventTarget | null }
export function gridEditNativeInput(target: EventTarget | null | undefined): boolean { return !!(target as Element | null)?.closest?.('input,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog') }
export function gridEditShortcut(event: GridEditKeyboard): 'undo' | 'redo' | null {
  if (gridEditNativeInput(event.target) || !(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  return key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' ? 'redo' : null
}
