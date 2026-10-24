import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState } from 'react';
import type { Root } from 'react-dom/client';

let browser: Window, host: HTMLDivElement, root: Root;
let Picker: typeof import('./modern-emoji-picker').ModernEmojiPicker;
let TooltipProvider: typeof import('@/components/ui/tooltip').TooltipProvider;
const onSelect = mock((emoji: string) => emoji);

beforeAll(async () => {
  browser = new Window({ url: 'http://127.0.0.1:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'FocusEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'ResizeObserver', 'MutationObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  browser.HTMLElement.prototype.scrollIntoView = () => {};
  const Icon = () => null;
  mock.module('@phosphor-icons/react', () => ({ AirplaneTilt: Icon, ClockCounterClockwise: Icon, Flag: Icon, ForkKnife: Icon, HandWaving: Icon, Heart: Icon, Leaf: Icon, Lightbulb: Icon, MagnifyingGlass: Icon, Smiley: Icon, SoccerBall: Icon, Question: Icon }));
  mock.module('@/lib/overlay-root', () => ({ getOverlayRoot: () => document.body }));
  ({ ModernEmojiPicker: Picker } = await import('./modern-emoji-picker'));
  ({ TooltipProvider } = await import('@/components/ui/tooltip'));
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
}, 20_000);
beforeEach(async () => { await act(async () => root.render(null)); browser.localStorage.clear(); onSelect.mockClear(); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });

async function open() {
  await act(async () => root.render(<TooltipProvider><Picker onSelect={onSelect} /></TooltipProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
}
function options() { return [...document.querySelectorAll<HTMLButtonElement>('[data-emoji-option]')]; }
async function key(key: string) { await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))); }
async function search(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('the picker shows local image artwork, searches Chinese and English, closes after selection and remembers recent use', async () => {
  await open();
  expect(options().length).toBeGreaterThan(100);
  expect(options()[0].querySelector('img')?.getAttribute('src')).toStartWith('/emoji/fluent/');
  expect(options()[0].textContent).toBe('');
  await search('点赞');
  const thumb = options().find(option => option.querySelector('img')?.getAttribute('alt') === '👍')!;
  await act(async () => thumb.click());
  expect(onSelect.mock.calls).toEqual([['👍']]);
  expect(document.querySelector('[data-emoji-picker]')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(options().length).toBeGreaterThan(100);
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="最近使用"]')!.click());
  expect(options()).toHaveLength(1);
  expect(options()[0].querySelector('img')?.getAttribute('alt')).toBe('👍');
  await search('rocket');
  expect(options().some(option => option.querySelector('img')?.getAttribute('alt') === '🚀')).toBe(true);
  expect(document.querySelector<HTMLAnchorElement>('a[href="/emoji/ATTRIBUTION.txt"]')?.textContent).toBe('Fluent Emoji · Twemoji');
});

test('keyboard navigation follows the eight-column grid and Escape restores the trigger', async () => {
  await open();
  expect(document.activeElement?.getAttribute('type')).toBe('search');
  await key('ArrowDown'); expect(document.activeElement).toBe(options()[0]);
  await key('ArrowDown'); expect(document.activeElement).toBe(options()[8]);
  await key('ArrowRight'); expect(document.activeElement).toBe(options()[9]);
  await key('End'); expect(document.activeElement).toBe(options().at(-1));
  await key('Home'); expect(document.activeElement).toBe(options()[0]);
  await key('Escape');
  expect(document.querySelector('[data-emoji-picker]')).toBeNull();
  expect(document.activeElement).toBe(host.querySelector('button'));
});

test('controlled open works and selecting leaves a caller-focused editor alone', async () => {
  function Fixture() {
    const [open, setOpen] = useState(true);
    return <TooltipProvider><input id="composer-caret" /><Picker open={open} onOpenChange={setOpen} onSelect={emoji => { onSelect(emoji); document.querySelector<HTMLInputElement>('#composer-caret')!.focus(); }} /></TooltipProvider>;
  }
  await act(async () => root.render(<Fixture />));
  expect(options().length).toBeGreaterThan(100);
  await act(async () => options()[0].click());
  expect(document.querySelector('[data-emoji-picker]')).toBeNull();
  expect(document.activeElement?.id).toBe('composer-caret');
});
