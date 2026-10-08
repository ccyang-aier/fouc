import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ConnectionTarget as Target } from './connection-target'
import type { ConnectionDialogActions as Actions } from '../connection-options/connection-dialog-actions'
import type { TooltipProvider as Provider } from '@/components/ui/tooltip'
import type { ConnectionList as List } from './connection-list'
import type { ConnectionFavoriteButton as Favorite } from './favorite-button'
import type { ConnectionListProps } from './types'

let browser: Window, root: Root
let ConnectionTarget: typeof Target, ConnectionDialogActions: typeof Actions, TooltipProvider: typeof Provider
let ConnectionList: typeof List, ConnectionFavoriteButton: typeof Favorite
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000' })
  const globals = globalThis as Record<string, unknown>
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) globals[key] = (browser as unknown as Record<string, unknown>)[key]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  ConnectionTarget = (await import('./connection-target')).ConnectionTarget
  ConnectionDialogActions = (await import('../connection-options/connection-dialog-actions')).ConnectionDialogActions
  TooltipProvider = (await import('@/components/ui/tooltip')).TooltipProvider
  ConnectionList = (await import('./connection-list')).ConnectionList
  ConnectionFavoriteButton = (await import('./favorite-button')).ConnectionFavoriteButton
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host)
}, 30000)
afterAll(async () => { if (root) await act(async () => root.unmount()); await browser.happyDOM.abort() })

test('copy uses the complete path and a rejected clipboard write never reports success', async () => {
  const targetTitle = 'C:\\data\\local.sqlite'
  let copied = ''
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text } } })
  await act(async () => root.render(<TooltipProvider><ConnectionTarget label="文件" row={{ id: 'local', name: 'Local', target: 'local.sqlite', targetTitle, projectIds: [], tags: [], favorite: false, status: 'passed' }} /></TooltipProvider>))
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  expect(copied).toBe(targetTitle)
  expect(document.querySelector('[role="status"]')?.textContent).toBe('已复制')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  expect(document.querySelector('[role="status"]')?.textContent).toBe('复制失败，请重试')
  expect(document.querySelector('[data-copied="true"]')).toBeNull()
})

test('testing disables actions without relabeling save, and outcomes stay beside the test action', async () => {
  const props = { valid: true, feedback: '', testError: '', submitLabel: '保存连接', onTest: () => {}, onClose: () => {} }
  await act(async () => root.render(<TooltipProvider><ConnectionDialogActions {...props} pending="test" /></TooltipProvider>))
  expect(document.querySelector('[aria-busy="true"]')?.textContent).toBe('测试中')
  expect(document.querySelector('button[type="submit"]')?.textContent).toBe('保存连接')
  expect([...document.querySelectorAll<HTMLButtonElement>('button')].every(button => button.disabled)).toBe(true)
  await act(async () => root.render(<TooltipProvider><ConnectionDialogActions {...props} pending={null} feedback="SQLite 3.53.2" /></TooltipProvider>))
  expect(document.querySelector('footer [role="status"]')?.textContent).toBe('测试通过')
  await act(async () => root.render(<TooltipProvider><ConnectionDialogActions {...props} pending={null} testError="文件不存在" /></TooltipProvider>))
  expect(document.querySelector('footer [role="alert"]')?.textContent).toBe('连接失败')
  expect(document.querySelector('[role="status"]')).toBeNull()
})

test('connection feedback tooltips stay inside the native modal top layer', async () => {
  await act(async () => root.render(<TooltipProvider><dialog open><ConnectionDialogActions pending={null} valid feedback="SQLite 3.53.2" testError="" submitLabel="保存连接" onTest={() => {}} onClose={() => {}} /></dialog></TooltipProvider>))
  await act(async () => document.querySelector<HTMLElement>('[role="status"]')!.focus())
  const tooltip = document.querySelector('[data-slot="tooltip-content"]')
  expect(tooltip?.closest('dialog[open]')).not.toBeNull()
  expect(tooltip?.textContent).toContain('SQLite 3.53.2')
})

const row = { id: 'local', name: 'Local', target: 'local.sqlite', targetTitle: 'C:\\data\\local.sqlite', projectIds: [], tags: [], favorite: false, status: 'passed' as const }
test('favorite immediately reflects intent, stays enabled while saving, and rolls back on failure', async () => {
  let reject!: (error: Error) => void, calls = 0
  const request = new Promise<void>((_, failure) => { reject = failure })
  await act(async () => root.render(<ConnectionFavoriteButton row={row} pending={false} disabled={false} onFavorite={() => { calls++; return request }} />))
  const star = document.querySelector<HTMLButtonElement>('button')!
  await act(async () => star.click())
  expect(star.disabled).toBe(false)
  expect(star.getAttribute('aria-busy')).toBe('true')
  expect(star.getAttribute('aria-pressed')).toBe('true')
  await act(async () => star.click())
  expect(calls).toBe(1)
  await act(async () => reject(new Error('save failed')))
  expect(star.getAttribute('aria-pressed')).toBe('false')
  expect(star.hasAttribute('aria-busy')).toBe(false)
  await act(async () => root.render(<ConnectionFavoriteButton row={{ ...row, favorite: true }} pending={false} disabled={false} onFavorite={async () => {}} />))
  expect(star.getAttribute('aria-pressed')).toBe('true')
})

const widths = { name: 180, target: 200, projects: 150, tags: 130, status: 140, actions: 136 }
async function renderDirectory(scope: string, overrides: Partial<ConnectionListProps> = {}) {
  const noop = () => {}
  const props: ConnectionListProps = { label: 'SQLite', targetLabel: '文件', scopeKey: scope, rows: [row], projects: [], loading: false, error: '', pendingIds: [], selectedIds: [], batchProgress: null, batchResult: null, headerActions: null,
    onBack: noop, onCreate: noop, onRetry: noop, onOpen: noop, onEdit: noop, onRemove: noop, onOpenProject: noop, onManageTags: noop, onFavorite: async () => {}, onSelectionChange: noop, onBatchAction: noop, onDismissBatchResult: noop, ...overrides }
  await act(async () => root.render(<TooltipProvider><ConnectionList key={scope} {...props} /></TooltipProvider>))
  for (const header of document.querySelectorAll<HTMLElement>('[data-directory-column]')) {
    const column = header.dataset.directoryColumn as keyof typeof widths
    const index = [...header.parentElement!.children].indexOf(header)
    header.getBoundingClientRect = () => ({ width: parseFloat(document.querySelectorAll('col')[index].style.width) || widths[column] }) as DOMRect
    const handle = header.querySelector<HTMLButtonElement>('[aria-label^="调整"]'), captured = new Set<number>()
    if (!handle) continue
    handle.setPointerCapture = id => { captured.add(id) }
    handle.hasPointerCapture = id => captured.has(id)
    handle.releasePointerCapture = id => { captured.delete(id) }
  }
}
async function pointer(handle: HTMLButtonElement, type: string, x: number, pointerId = 1) {
  await act(async () => handle.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, pointerId })))
}
function width(column: keyof typeof widths) {
  const header = document.querySelector(`[data-directory-column="${column}"]`)!
  const index = [...header.parentElement!.children].indexOf(header)
  return document.querySelectorAll('col')[index].style.width
}
const preference = (scope: string) => browser.localStorage.getItem('fouc:connection-directory:widths:' + scope)

test('open remains available for unverified connections and is blocked during verification', async () => {
  const opened: string[] = [];
  for (const status of ['untested', 'failed', 'passed'] as const) {
    await renderDirectory(`open-${status}`, { rows: [{ ...row, status }], onOpen: selected => { opened.push(selected.id); } });
    const open = document.querySelector<HTMLButtonElement>(`[aria-label="打开 ${row.name} 工作台"]`)!;
    expect(open.disabled).toBe(false);
    await act(async () => open.click());
  }
  expect(opened).toEqual([row.id, row.id, row.id]);
  await renderDirectory('open-testing', { rows: [{ ...row, status: 'testing' }] });
  expect(document.querySelector<HTMLButtonElement>(`[aria-label="打开 ${row.name} 工作台"]`)!.disabled).toBe(true);
  expect(document.querySelector('th:last-child [aria-label^="调整"]')).toBeNull();
});

test('column drag changes only its target, commits once, and never sorts the header', async () => {
  await renderDirectory('resize-a:sqlite')
  const handle = document.querySelector<HTMLButtonElement>('[aria-label="调整连接名称列宽"]')!
  await pointer(handle, 'pointerdown', 200)
  await pointer(handle, 'pointermove', 260)
  expect(width('name')).toBe('240px')
  expect(width('target')).toBe('200px')
  expect(preference('resize-a:sqlite')).toBeNull()
  await pointer(handle, 'pointermove', 300, 2)
  expect(width('name')).toBe('240px')
  await pointer(handle, 'pointerup', 270)
  expect(width('name')).toBe('250px')
  expect(JSON.parse(preference('resize-a:sqlite')!).name).toBe(250)
  expect(document.querySelector('th[aria-sort]')?.getAttribute('aria-sort')).toBe('none')
  expect(handle.hasPointerCapture(1)).toBe(false)
})

test('cancelled column drags restore widths and leave stored preferences untouched', async () => {
  await renderDirectory('resize-cancel:sqlite')
  const handle = document.querySelector<HTMLButtonElement>('[aria-label="调整连接名称列宽"]')!
  await pointer(handle, 'pointerdown', 200)
  await pointer(handle, 'pointermove', 260)
  await pointer(handle, 'pointercancel', 260)
  expect(width('name')).toBe('')
  await pointer(handle, 'pointerdown', 200)
  await pointer(handle, 'pointermove', 260)
  await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(width('name')).toBe('')
  expect(preference('resize-cancel:sqlite')).toBeNull()
  expect(handle.hasPointerCapture(1)).toBe(false)
})

test('minimum width and keyboard resizing persist independently for each provider', async () => {
  await renderDirectory('sqlite')
  let handle = document.querySelector<HTMLButtonElement>('[aria-label="调整连接名称列宽"]')!
  await pointer(handle, 'pointerdown', 200)
  await pointer(handle, 'pointerup', -200)
  expect(width('name')).toBe('130px')
  await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true })))
  expect(width('name')).toBe('170px')
  await renderDirectory('mysql')
  expect(width('name')).toBe('')
  await renderDirectory('postgres')
  expect(width('name')).toBe('')
  await renderDirectory('sqlite')
  expect(width('name')).toBe('170px')
  handle = document.querySelector<HTMLButtonElement>('[aria-label="调整连接名称列宽"]')!
  await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })))
  expect(width('name')).toBe('160px')
})
