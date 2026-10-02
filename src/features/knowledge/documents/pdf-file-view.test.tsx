import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PdfFileView as View } from './pdf-file-view';
let browser: Window, root: Root, PdfFileView: typeof View;
type Comments = NonNullable<Parameters<typeof View>[0]['comments']>;
const changes: number[] = [], zooms: number[] = [];
const blob = new Blob(['PDF test fixture']);
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'WheelEvent', 'MouseEvent', 'PointerEvent', 'ResizeObserver', 'IntersectionObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ destroy: async () => {}, promise: Promise.resolve({ numPages: 3, getPage: async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale, scale }), render: () => ({ promise: Promise.resolve(), cancel() {} }), getTextContent: async () => ({}) }) }) }), TextLayer: class { render() { return Promise.resolve(); } cancel() {} } }));
  ({ PdfFileView } = await import('./pdf-file-view'));
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
}, 30000);
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
async function render(mode: 'continuous' | 'paged', page = 1, zoom = 100, comments?: Comments) {
  await act(async () => root.render(<PdfFileView blob={blob} page={page} zoom={zoom} mode={mode} thumbnails={false} onThumbnailsChange={() => {}} onPageChange={number => changes.push(number)} onZoomChange={number => zooms.push(number)} onPages={() => {}} comments={comments} />));
  await act(async () => { await Promise.resolve(); });
  return document.querySelector<HTMLDivElement>(`[aria-label="${mode === 'continuous' ? '连续滚动 PDF' : '分页阅读 PDF'}"]`)!;
}
test('continuous mode keeps all page placeholders and native wheel scrolling; Ctrl-wheel only zooms', async () => {
  const viewport = await render('continuous');
  expect(document.querySelectorAll('[data-pdf-page]')).toHaveLength(3);
  const scroll = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
  await act(async () => viewport.dispatchEvent(scroll)); expect(scroll.defaultPrevented).toBe(false); expect(changes).toEqual([]);
  const zoom = new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, cancelable: true });
  Object.defineProperty(zoom, 'ctrlKey', { value: true });
  await act(async () => viewport.dispatchEvent(zoom)); expect(zoom.defaultPrevented).toBe(true); expect(zooms).toEqual([110]); expect(changes).toEqual([]);
  await render('continuous', 1, 50);
  const limit = new WheelEvent('wheel', { deltaY: 120, cancelable: true }); Object.defineProperty(limit, 'ctrlKey', { value: true });
  await act(async () => viewport.dispatchEvent(limit));
  expect(zooms.at(-1)).toBe(50);
});
test('paged wheel scrolls inside a tall page and advances only at its boundary', async () => {
  const viewport = await render('paged', 2);
  expect(document.querySelectorAll('[data-pdf-page]')).toHaveLength(1);
  expect(document.querySelector('[data-pdf-page]')?.getAttribute('data-pdf-page')).toBe('2');
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 900 });
  viewport.scrollTop = 200;
  const within = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
  await act(async () => viewport.dispatchEvent(within)); expect(within.defaultPrevented).toBe(false); expect(changes).toEqual([]);
  viewport.scrollTop = 500;
  const boundary = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
  await act(async () => viewport.dispatchEvent(boundary)); expect(boundary.defaultPrevented).toBe(true); expect(changes).toEqual([3]);
});
test('persisted annotation geometry scales with the page and its badge opens its own discussion', async () => {
  const selected: string[] = [];
  const anchor = { assetHash: 'a'.repeat(64), quote: 'PDF quote', pages: [{ page: 2, rects: [{ x: .1, y: .2, width: .4, height: .03 }] }] };
  const comments: Comments = { assetHash: anchor.assetHash, canComment: true, activeThreadId: 'thread', highlights: [{ id: 'thread', anchor, count: 3, resolved: false }], onSelect: id => selected.push(id), onCompose: () => {}, locate: null };
  await render('paged', 2, 150, comments);
  const badge = document.querySelector<HTMLButtonElement>('[aria-label="查看第 2 页批注：PDF quote"]')!;
  expect(badge.textContent).toBe('3');
  const rect = badge.parentElement!.querySelector('span')!;
  expect(rect.style.left).toBe('10%'); expect(rect.style.top).toBe('20%'); expect(rect.style.width).toBe('40%');
  await act(async () => badge.click()); expect(selected).toEqual(['thread']);
});
