import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { TaskBoardView } from '@fouc/shared/tasks';
import type { TaskBoardViewSwitcher as SwitcherComponent } from './task-board-view-switcher';

let browser: Window, root: Root, host: HTMLDivElement;
let Switcher: typeof SwitcherComponent;
const views = [{ id: 'view-first', name: 'Planning', kind: 'kanban' as const }, { id: 'view-second', name: 'Delivery', kind: 'kanban' as const }];
const onRename = mock((view: TaskBoardView, anchor: HTMLElement) => Boolean(view.id && anchor)), onRemove = mock(() => {}), onChange = mock(() => {});
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'ResizeObserver', 'MutationObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  browser.localStorage.setItem('fouc.language', 'en-US');
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['CalendarDots', 'PencilSimple', 'PlusCircle', 'SquaresFour', 'Table', 'Trash'].map(name => [name, icon])));
  const pass = ({ children }: { children: ReactNode }) => children;
  mock.module('@/components/ui/tooltip', () => ({ Tooltip: pass, TooltipTrigger: pass, TooltipContent: () => null }));
  mock.module('@/lib/overlay-root', () => ({ getOverlayRoot: () => document.body }));
  ({ TaskBoardViewSwitcher: Switcher } = await import('./task-board-view-switcher'));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => { await act(async () => root.render(null)); onRename.mockClear(); onRemove.mockClear(); onChange.mockClear(); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });
async function render(editable = true, busy = false) {
  await act(async () => root.render(<Switcher views={views} value={views[0].id} onChange={onChange} editable={editable} busy={busy} onCreate={() => {}} onRename={onRename} onRemove={onRemove} />));
}
test('right-click targets the chosen view without selecting it or adding an ellipsis button', async () => {
  await render();
  const trigger = [...host.querySelectorAll('button')].find(button => button.textContent === 'Delivery')!;
  await act(async () => trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 140, clientY: 90 })));
  expect(document.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('View actions: Delivery');
  expect(Boolean(host.querySelector('button[aria-label^="View actions"]'))).toBe(false);
  expect(onChange.mock.calls.length).toBe(0);
  await act(async () => document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click());
  expect(onRename.mock.calls[0]?.[0]).toEqual(views[1]);
  expect(onRename.mock.calls[0]?.[1] === trigger).toBe(true);
  expect(Boolean(document.querySelector('[role="menu"]'))).toBe(false);
});
test('keyboard context actions remain available, while viewers and busy boards have no mutation menu', async () => {
  await render();
  const trigger = host.querySelector('button')!;
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true })));
  expect(Boolean(document.querySelector('[role="menu"]'))).toBe(true);
  await render(false);
  expect(Boolean(document.querySelector('[role="menu"]'))).toBe(false);
  await act(async () => trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  expect(Boolean(document.querySelector('[role="menu"]'))).toBe(false);
  await render(true, true);
  await act(async () => trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  expect(Boolean(document.querySelector('[role="menu"]'))).toBe(false);
});
