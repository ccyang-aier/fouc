import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DatabaseQueryResult } from '@fouc/shared'
import type { ResultGrid as Grid } from './result-grid'
import type { AppAlertProvider as Alerts } from '@/components/app-alert-provider'

let browser: Window, root: Root, ResultGrid: typeof Grid, AppAlertProvider: typeof Alerts
const result: DatabaseQueryResult = { columns: ['id', 'name', 'email'], columnTypes: ['INTEGER', 'TEXT', 'TEXT'], columnSortables: [true, true, true], rows: [[1, 'A', 'a@test'], [2, 'B', 'b@test'], [3, 'C', 'c@test']], affectedRows: 0, executionTimeMs: 1, hasMore: false, truncated: false, sessionId: null, messages: [] }

beforeAll(async () => {
  browser = new Window()
  const globals = globalThis as Record<string, unknown>
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'StorageEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) globals[name] = (browser as unknown as Record<string, unknown>)[name]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  ResultGrid = (await import('./result-grid')).ResultGrid
  AppAlertProvider = (await import('@/components/app-alert-provider')).AppAlertProvider
}, 20000)
beforeEach(() => { const host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren() })
afterAll(async () => { await browser.happyDOM.abort() })

async function mount(rows = result.rows) { await act(async () => root.render(<AppAlertProvider><ResultGrid result={{ ...result, rows }} showCellDetails={false} /></AppAlertProvider>)) }
function header(column: number) { return document.querySelector<HTMLElement>(`thead [data-grid-column="${column}"]`)! }
function cells(column: number) { return [...document.querySelectorAll<HTMLElement>(`td[data-grid-column="${column}"]`)] }
async function select(column: number, modifiers: MouseEventInit = {}) { await act(async () => header(column).dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers }))) }
function edges(column: number) { return cells(column).map(cell => Number(cell.dataset.edge)) }

test('first and middle columns join the selected header to the body in one outer frame', async () => {
  await mount()
  for (const column of [0, 1]) {
    await select(column)
    expect(header(column).getAttribute('aria-selected')).toBe('true')
    expect(header(column).dataset.selected).toBe('true')
    expect(header(column).dataset.edge).toBe('11') // Top and both sides; no divider under the header.
    expect(edges(column)).toEqual([10, 10, 14]) // Body continues the sides and closes only at the last row.
    expect(cells(column).every(cell => cell.dataset.selected === 'true')).toBe(true)
    expect(header(column === 0 ? 1 : 0).hasAttribute('data-selected')).toBe(false)
  }
})

test('Shift extends a continuous column selection; Ctrl adds a separate column frame', async () => {
  await mount()
  await select(0); await select(1, { shiftKey: true })
  expect(header(0).dataset.edge).toBe('9')
  expect(header(1).dataset.edge).toBe('3')
  expect(edges(0)).toEqual([8, 8, 12]); expect(edges(1)).toEqual([2, 2, 6])
  await select(0); await select(2, { ctrlKey: true })
  expect(header(0).dataset.edge).toBe('11'); expect(header(2).dataset.edge).toBe('11')
  expect(header(1).hasAttribute('data-selected')).toBe(false)
  expect(edges(0)).toEqual([10, 10, 14]); expect(edges(2)).toEqual([10, 10, 14])
})

test('a one-row column still has a header-to-body frame and Escape clears both', async () => {
  await mount([result.rows[0]])
  await select(0)
  expect(header(0).dataset.edge).toBe('11'); expect(edges(0)).toEqual([14])
  const viewport = document.querySelector<HTMLElement>('[role="grid"]')!
  await act(async () => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(header(0).hasAttribute('data-selected')).toBe(false)
  expect(cells(0)[0].hasAttribute('data-selected')).toBe(false)
  await act(async () => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
  expect(cells(0)[0].dataset.active).toBe('true')
  expect(cells(0)[0].dataset.edge).toBe('0') // Single cells retain their own focus outline.
  expect(header(0).hasAttribute('data-selected')).toBe(false)
})
