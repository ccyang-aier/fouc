import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createPortal } from 'react-dom'
import type { useGridColumnInteractions as Interactions } from './column-interactions'
import { defaultGridLayout, gridColumnKeys, visibleGridColumns, type GridLayout } from './model'

let browser: Window, root: Root, useGridColumnInteractions: typeof Interactions
let changes: GridLayout[] = [], selections: number[] = [], frameId = 0
const frames = new Map<number, FrameRequestCallback>()
const keys = gridColumnKeys(['id', 'name', 'hidden', 'city'])
const initial = { ...defaultGridLayout(), hidden: [keys[2]], widths: { [keys[1]]: 130 } }

beforeAll(async () => {
  browser = new Window()
  const globals = globalThis as Record<string, unknown>
  for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent']) globals[name] = (browser as unknown as Record<string, unknown>)[name]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  globals.requestAnimationFrame = (callback: FrameRequestCallback) => { const id = ++frameId; frames.set(id, callback); return id }
  globals.cancelAnimationFrame = (id: number) => frames.delete(id)
  useGridColumnInteractions = (await import('./column-interactions')).useGridColumnInteractions
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  document.elementFromPoint = (x: number) => [...document.querySelectorAll<HTMLElement>('[data-grid-target="column"]')].find(element => {
    const rect = element.getBoundingClientRect(); return x >= rect.left && x < rect.right
  }) ?? null
})
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort() })

function Harness() {
  const [layout, setLayout] = useState(initial), viewport = useRef<HTMLDivElement>(null)
  const visible = visibleGridColumns(keys, layout)
  const { preview, start, move, finish, click } = useGridColumnInteractions({ viewport, keys, visible, widths: visible.map(column => layout.widths[keys[column]] ?? 100), layout, onChange: next => { changes.push(next); setLayout(next) } })
  return <div ref={viewport} data-viewport>{visible.map((column, index) => <div key={keys[column]} tabIndex={0} data-grid-target="column" data-grid-column={index} data-source={column} data-dragging={preview?.kind === 'move' && preview.column === column} data-slot={preview?.slot}
    onPointerDown={event => start(event, 'move', index)} onPointerMove={move} onPointerUp={finish} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
    onClick={event => { if (event.currentTarget.contains(event.target as Node) && !(event.target as Element).closest('button, [data-grid-column-actions]') && !click(event)) selections.push(column) }}>
    <span>{keys[column]}</span><div data-grid-column-actions><button type="button">菜单</button></div>
    <button type="button" data-resize onPointerDown={event => start(event, 'resize', index)} onPointerMove={move} onPointerUp={finish} onPointerCancel={event => finish(event, true)}>列宽</button>
    {column === 0 && createPortal(<div data-menu-item>值筛选</div>, document.body)}
  </div>)}</div>
}
async function render(key: string) {
  changes = []; selections = []; frames.clear()
  await act(async () => root.render(<Harness key={key} />))
  document.querySelector<HTMLElement>('[data-viewport]')!.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100 }) as DOMRect
  document.querySelector<HTMLElement>('[data-viewport]')!.scrollBy = () => undefined
  for (const [index, header] of [...document.querySelectorAll<HTMLElement>('[data-grid-target="column"]')].entries()) {
    header.getBoundingClientRect = () => ({ left: 100 + index * 100, right: 200 + index * 100, width: 100 }) as DOMRect
    for (const element of [header, header.querySelector<HTMLButtonElement>('[data-resize]')!]) {
      const capture = new Set<number>()
      element.setPointerCapture = id => { capture.add(id) }
      element.hasPointerCapture = id => capture.has(id)
      element.releasePointerCapture = id => { capture.delete(id) }
    }
  }
}
const header = (source: number) => document.querySelector<HTMLElement>(`[data-source="${source}"]`)!
const order = () => [...document.querySelectorAll<HTMLElement>('[data-source]')].map(element => Number(element.dataset.source))
async function pointer(element: HTMLElement, type: string, x: number) { await act(async () => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: 120 }))) }
async function held() { await act(async () => new Promise(resolve => setTimeout(resolve, 240))) }

test('short header clicks select once; menus and movement before the hold never start reordering', async () => {
  await render('short')
  await pointer(header(0), 'pointerdown', 125); await pointer(header(0), 'pointerup', 125)
  await act(async () => header(0).dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await held()
  expect(selections).toEqual([0]); expect(changes).toHaveLength(0)
  const menu = header(0).querySelector<HTMLButtonElement>('[data-grid-column-actions] button')!
  await pointer(menu, 'pointerdown', 170); await held(); await pointer(menu, 'pointerup', 170)
  expect(document.querySelector('[data-dragging="true"]')).toBeNull()
  const portalItem = document.querySelector<HTMLElement>('[data-menu-item]')!
  await pointer(portalItem, 'pointerdown', 170); await held(); await pointer(portalItem, 'pointerup', 170)
  await act(async () => portalItem.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(selections).toEqual([0]); expect(document.querySelector('[data-dragging="true"]')).toBeNull()
  await pointer(header(0), 'pointerdown', 125); await pointer(header(0), 'pointermove', 140); await held()
  expect(document.querySelector('[data-dragging="true"]')).toBeNull(); expect(changes).toHaveLength(0)
})

test('held headers preview an insertion and release uses the latest position, with one layout write and no click selection', async () => {
  await render('held')
  await pointer(header(0), 'pointerdown', 125); await held()
  expect(header(0).dataset.dragging).toBe('true')
  await pointer(header(0), 'pointermove', 230)
  await act(async () => { const queued = [...frames.values()]; frames.clear(); for (const callback of queued) callback(1) })
  expect(header(0).dataset.slot).toBe('1'); expect(order()).toEqual([0, 1, 3])
  await pointer(header(0), 'pointermove', 380)
  // Release before the next frame, in the empty header space after city.
  await pointer(header(0), 'pointerup', 480)
  await pointer(header(0), 'pointerup', 480)
  await act(async () => header(0).dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(order()).toEqual([1, 3, 0]); expect(changes).toHaveLength(1); expect(selections).toHaveLength(0)
  expect(changes[0].hidden).toEqual(initial.hidden); expect(changes[0].widths).toEqual(initial.widths)
  expect(document.querySelector('[data-dragging="true"]')).toBeNull(); expect(frames.size).toBe(0)
})

test('pointer cancellation and Escape clear holds; edge resizing remains immediate and commits the release width', async () => {
  await render('cancel')
  await pointer(header(0), 'pointerdown', 125); await pointer(header(0), 'pointercancel', 125); await held()
  expect(document.querySelector('[data-dragging="true"]')).toBeNull()
  await pointer(header(0), 'pointerdown', 125); await held(); await pointer(header(0), 'pointermove', 380)
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await pointer(header(0), 'pointerup', 380)
  expect(order()).toEqual([0, 1, 3]); expect(changes).toHaveLength(0); expect(frames.size).toBe(0)
  const resize = header(1).querySelector<HTMLButtonElement>('[data-resize]')!
  await pointer(resize, 'pointerdown', 290); await pointer(resize, 'pointermove', 300); await pointer(resize, 'pointerup', 325)
  expect(changes).toHaveLength(1); expect(changes[0].widths[keys[1]]).toBe(165)
  expect(order()).toEqual([0, 1, 3]); expect(selections).toHaveLength(0)
})
