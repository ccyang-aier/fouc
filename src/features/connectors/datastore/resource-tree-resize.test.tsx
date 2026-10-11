import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act, useCallback, useRef, useState, type CSSProperties } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ResourceTreeResize as Resize } from './resource-tree-resize'

let browser: Window, root: Root, ResourceTreeResize: typeof Resize, containerWidth = 1000, frameId = 0
let changes: (number | undefined)[] = []
const frames = new Map<number, FrameRequestCallback>(), observers = new Set<() => void>(), capture = new Set<number>()
const property = '--resource-tree-width'
beforeAll(async () => {
  browser = new Window()
  const globals = globalThis as Record<string, unknown>
  for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent']) globals[name] = (browser as unknown as Record<string, unknown>)[name]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  globals.requestAnimationFrame = (callback: FrameRequestCallback) => { const id = ++frameId; frames.set(id, callback); return id }
  globals.cancelAnimationFrame = (id: number) => frames.delete(id)
  globals.ResizeObserver = class { constructor(private callback: () => void) { observers.add(callback) } observe() {} disconnect() { observers.delete(this.callback) } }
  ResourceTreeResize = (await import('./resource-tree-resize')).ResourceTreeResize
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort() })
function Harness() {
  const pane = useRef<HTMLElement>(null), [width, setWidth] = useState<number | undefined>()
  const change = useCallback((next: number | undefined) => { changes.push(next); setWidth(next) }, [])
  return <div ref={element => { if (element) element.getBoundingClientRect = () => ({ width: containerWidth }) as DOMRect }}>
    <aside ref={element => { pane.current = element; if (element) element.getBoundingClientRect = () => ({ width: Math.min(Math.max(210, containerWidth - 400), Math.min(520, parseFloat(element.style.getPropertyValue(property)) || 284)) }) as DOMRect }} style={width === undefined ? undefined : { [property]: `${width}px` } as CSSProperties}>
      <input aria-label="当前输入" defaultValue="未提交的输入" />
      <ResourceTreeResize paneRef={pane} controls="fixture-pane" onChange={change} />
    </aside>
  </div>
}
const handle = () => document.querySelector<HTMLButtonElement>('[role="separator"]')!
const pane = () => document.querySelector<HTMLElement>('aside')!
async function render(key: string) {
  changes = []; frames.clear(); capture.clear(); containerWidth = 1000
  await act(async () => root.render(<Harness key={key} />))
  handle().setPointerCapture = id => { capture.add(id) }
  handle().hasPointerCapture = id => capture.has(id)
  handle().releasePointerCapture = id => { capture.delete(id) }
}
async function pointer(type: string, x: number, pointerId = 1) { await act(async () => handle().dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId, clientX: x }))) }
async function frame() { await act(async () => { const queued = [...frames.values()]; frames.clear(); for (const callback of queued) callback(1); for (const measure of observers) measure() }) }
async function key(value: string, shiftKey = false) { await act(async () => handle().dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }))) }

test('drag previews do not commit or steal input focus; release commits the latest position once', async () => {
  await render('commit'); const input = document.querySelector<HTMLInputElement>('input')!; input.focus()
  await pointer('pointerdown', 300); await pointer('pointermove', 360); await frame()
  expect(pane().style.getPropertyValue(property)).toBe('344px'); expect(changes).toEqual([])
  expect(handle().getAttribute('aria-valuenow')).toBe('344')
  expect(document.activeElement).toBe(input); expect(input.value).toBe('未提交的输入')
  expect(pane().dataset.resourceResizing).toBe('true')
  expect(handle().dataset.resizing).toBe('true')
  await pointer('pointermove', 390); await pointer('pointerup', 395)
  expect(changes).toEqual([379]); expect(pane().style.getPropertyValue(property)).toBe('379px')
  expect(frames.size).toBe(0); expect(capture.size).toBe(0); expect(pane().dataset.resourceResizing).toBeUndefined()
  expect(handle().dataset.resizing).toBeUndefined()
})
test('release adapts to the current container and respects both width limits', async () => {
  await render('bounds'); await pointer('pointerdown', 300); await pointer('pointermove', 9000); await frame()
  expect(pane().style.getPropertyValue(property)).toBe('520px')
  containerWidth = 730; await frame(); await pointer('pointerup', 9000)
  expect(changes).toEqual([330]); expect(pane().getBoundingClientRect().width).toBe(330)
  await pointer('pointerdown', 300); await pointer('pointerup', -3000)
  expect(changes).toEqual([330, 210]); expect(pane().getBoundingClientRect().width).toBe(210)
})
test('Escape, pointer cancellation, capture loss and unmount cancel previews and queued frames', async () => {
  for (const method of ['escape', 'pointercancel', 'lostpointercapture', 'unmount']) {
    await render(method); await pointer('pointerdown', 300); await pointer('pointermove', 380); await frame()
    await pointer('pointermove', 400)
    const previous = pane()
    if (method === 'escape') await key('Escape')
    else if (method === 'unmount') await act(async () => root.render(null))
    else await pointer(method, 400)
    expect(changes).toEqual([]); expect(`${method}:${previous.style.getPropertyValue(property)}`).toBe(`${method}:`)
    expect(previous.dataset.resourceResizing).toBeUndefined(); expect(frames.size).toBe(0); expect(capture.size).toBe(0)
  }
})
test('keyboard steps, Home/End and double click reset use the same workbench bounds', async () => {
  await render('keyboard'); await key('ArrowRight'); await key('ArrowLeft', true); await key('Home'); await key('End')
  expect(changes).toEqual([300, 260, 210, 520])
  containerWidth = 730; await key('End'); expect(changes.at(-1)).toBe(330)
  await act(async () => handle().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
  expect(changes.at(-1)).toBeUndefined(); expect(pane().style.getPropertyValue(property)).toBe('')
})
