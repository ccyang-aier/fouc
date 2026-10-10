import type { KeyboardEvent } from 'react'

/** Query tabs are portaled, so keyboard navigation follows their DOM tablist. */
export function navigateWorkbenchTabs(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const focused = event.target as HTMLElement
  if (focused !== focused.closest('[role="tab"]')) return
  const list = focused.closest('[role="tablist"]')
  if (!list) return
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')].filter(tab => tab.getAttribute('aria-disabled') !== 'true' && !tab.matches(':disabled'))
  const index = tabs.indexOf(focused)
  if (index < 0 || !tabs.length) return
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length
  event.preventDefault(); event.stopPropagation(); tabs[next].click(); tabs[next].focus()
}
