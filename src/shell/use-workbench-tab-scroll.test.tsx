import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { useWorkbenchTabScroll } from './use-workbench-tab-scroll';
import { createWorkbenchTabs, tabTarget } from './workbench-tabs';

let browser: Window, host: HTMLElement, root: Root;
let control: ReturnType<typeof useWorkbenchTabScroll>;
let active = 'current', tabs = createWorkbenchTabs('test', tabTarget('home')).tabs;
let dimensions = { viewport: 220, content: 600, left: 480, item: 120 };
const frames = new Map<number, FrameRequestCallback>();
const resizes = new Set<() => void>();
const scrolls: ScrollToOptions[] = [];
let frameId = 0;
class Resize {
  constructor(callback: () => void) { this.callback = callback; resizes.add(callback); }
  private callback: () => void;
  observe() {}
  disconnect() { resizes.delete(this.callback); }
}
function Probe() {
  const value = useWorkbenchTabScroll(active, tabs);
  const { strip, viewport, ref, newButton } = value;
  useEffect(() => { control = value; });
  return <div ref={strip} style={{ columnGap: 2 }}><div ref={viewport}><div ref={ref} role="tablist"><div data-item><button role="tab" aria-selected="true" /></div></div></div><button ref={newButton} /></div>;
}
beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'getComputedStyle']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  Object.assign(globals, { window: browser, ResizeObserver: Resize, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: (id: number) => frames.delete(id) });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => {
  await act(async () => root.render(null));
  active = 'current'; tabs = createWorkbenchTabs('test', tabTarget('home')).tabs; dimensions = { viewport: 220, content: 600, left: 480, item: 120 };
  scrolls.length = 0;
  await act(async () => root.render(<Probe />));
  Object.defineProperty(control.strip.current!, 'clientWidth', { get: () => 300, configurable: true });
  Object.defineProperty(control.newButton.current!, 'offsetWidth', { get: () => 28, configurable: true });
  Object.defineProperty(control.ref.current!, 'offsetWidth', { get: () => dimensions.content, configurable: true });
  Object.defineProperties(control.viewport.current!, {
    clientWidth: { get: () => dimensions.viewport, configurable: true }, scrollWidth: { get: () => dimensions.content, configurable: true },
  });
  const item = host.querySelector<HTMLElement>('[data-item]')!;
  Object.defineProperties(item, { offsetLeft: { get: () => dimensions.left, configurable: true }, offsetWidth: { get: () => dimensions.item, configurable: true } });
  // A moving FLIP projection must not change which logical position is revealed.
  item.getBoundingClientRect = () => ({ x: -999, left: -999, right: -879, width: 120 } as DOMRect);
  control.viewport.current!.scrollTo = (options?: ScrollToOptions | number) => {
    if (!options || typeof options !== 'object') return;
    scrolls.push(options); control.viewport.current!.scrollLeft = options.left ?? 0;
  };
  await resize();
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
async function resize() { await act(async () => resizes.forEach(callback => callback())); }
async function frame() {
  await act(async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); });
}
function wheel(options: Pick<WheelEventInit, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey'>) {
  const event = new browser.WheelEvent('wheel', { cancelable: true, bubbles: true, ...options });
  // Happy DOM's WheelEvent omits MouseEvent modifier fields.
  Object.defineProperty(event, 'ctrlKey', { value: options.ctrlKey ?? false });
  control.viewport.current!.dispatchEvent(event as unknown as Event);
  return event;
}

test('resize and overflow changes coalesce into one reveal using final offsets, not animated rectangles', async () => {
  dimensions.viewport = 210; await resize();
  await frame();
  dimensions.viewport = 190; await resize();
  await frame();
  expect(scrolls).toHaveLength(0);
  await frame();
  expect(scrolls).toEqual([{ left: 410, behavior: 'smooth' }]);
  await resize(); await frame(); await frame();
  expect(scrolls).toHaveLength(1);
});

test('closing at the scroll boundary does not re-scroll a visible neighbor after the browser clamps the range', async () => {
  await frame(); await frame();
  scrolls.length = 0;
  dimensions.content = 468; dimensions.left = 348;
  control.viewport.current!.scrollLeft = 248;
  active = 'previous'; tabs = [];
  await act(async () => root.render(<Probe />));
  await resize(); await frame(); await frame();
  expect(control.viewport.current!.scrollLeft).toBe(248);
  expect(scrolls).toHaveLength(0);
});

test('arrows do not cause their own overflow state when the content fits without them', async () => {
  dimensions.content = 260;
  await resize();
  expect(control.edges.overflow).toBe(false);
  dimensions.viewport = 260;
  await resize();
  expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(false);
});

test('reselecting the current page reveals it after manual wheel browsing', async () => {
  wheel({ deltaY: 90 });
  tabs = [...tabs];
  await act(async () => root.render(<Probe />));
  await frame(); await frame();
  expect(scrolls).toEqual([{ left: 380, behavior: 'smooth' }]);
});

test('wheel browsing cancels pending auto-reveal and preserves horizontal gestures, zoom and cleanup', async () => {
  expect(wheel({ deltaY: 90 }).defaultPrevented).toBe(true);
  expect(control.viewport.current!.scrollLeft).toBe(90);
  expect(wheel({ deltaY: 3, deltaMode: 1 }).defaultPrevented).toBe(true);
  expect(control.viewport.current!.scrollLeft).toBe(138);
  expect(wheel({ deltaX: 40, deltaY: 2 }).defaultPrevented).toBe(false);
  expect(wheel({ deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(false);
  await frame(); await frame();
  expect(scrolls).toHaveLength(0);
  expect(control.viewport.current!.scrollLeft).toBe(138);
  const element = control.viewport.current!;
  await act(async () => root.render(null));
  const event = new browser.WheelEvent('wheel', { deltaY: 90, cancelable: true });
  element.dispatchEvent(event as unknown as Event);
  expect(event.defaultPrevented).toBe(false);
  expect(frames.size).toBe(0);
});
