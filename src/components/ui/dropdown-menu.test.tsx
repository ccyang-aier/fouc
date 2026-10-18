import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let browser: Window;
let root: Root;
let overlay: HTMLElement;
let renderMenu: () => ReactNode;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle']) {
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.requestAnimationFrame = browser.requestAnimationFrame.bind(browser);
  globals.cancelAnimationFrame = browser.cancelAnimationFrame.bind(browser);
  mock.module('@/lib/overlay-root', () => ({ getOverlayRoot: () => overlay }));
  const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } = await import('./dropdown-menu');
  renderMenu = () => <DropdownMenu><DropdownMenuTrigger>Open menu</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Move task</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterAll(async () => {
  await act(async () => root.unmount());
  await browser.happyDOM.abort();
  mock.restore();
});

test('opening a menu after its previously rendered native dialog was removed uses the live overlay', async () => {
  const previousDialog = document.createElement('dialog');
  const workbench = document.createElement('main');
  document.body.append(previousDialog, workbench);
  overlay = previousDialog;
  await act(async () => root.render(renderMenu()));
  previousDialog.remove();
  overlay = workbench;
  await act(async () => {
    document.querySelector<HTMLButtonElement>('button')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  });
  for (let turn = 0; turn < 30 && !workbench.querySelector('[role="menuitem"]'); turn++) await act(async () => { await Bun.sleep(0); });
  const menu = document.querySelector('[role="menu"]');
  expect(menu?.isConnected).toBe(true);
  expect(workbench.contains(menu)).toBe(true);
  expect(menu?.textContent).toBe('Move task');
  expect(previousDialog.querySelector('[role="menu"]')).toBeNull();
});
