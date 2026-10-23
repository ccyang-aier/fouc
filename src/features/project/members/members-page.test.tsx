import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import type { Root } from 'react-dom/client';

let browser: Window, host: HTMLDivElement, root: Root;
let Page: typeof import('./members-page').ProjectMembersPage;
let scope = 'project-a';
let setLocale: typeof import('@/lib/i18n').setLocale;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/?view=members' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'DocumentFragment', 'MutationObserver', 'ResizeObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.requestAnimationFrame = browser.requestAnimationFrame.bind(browser);
  globals.cancelAnimationFrame = browser.cancelAnimationFrame.bind(browser);
  Object.defineProperties(browser.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['ClipboardText', 'FolderPlus', 'MagnifyingGlass', 'Plus', 'SlidersHorizontal', 'Stack', 'UserCircleGear', 'UserPlus', 'UsersThree', 'X', 'ArrowRight', 'CaretDown', 'CaretRight', 'Check', 'CheckCircle', 'Info', 'WarningCircle', 'XCircle', 'SquaresFour', 'Table'].map(name => [name, () => <svg aria-hidden />])));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: ({ name }: { name: string }) => <span>{name[0]}</span> }));
  mock.module('@/components/ui/date-picker', () => ({ DatePicker: ({ value }: { value: string }) => <button type="button">{value}</button> }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: () => {} }) }));
  mock.module('../project-resources', () => ({ useProjectResources: () => ({ scopeKey: scope }) }));
  setLocale = (await import('@/lib/i18n')).setLocale;
  Page = (await import('./members-page')).ProjectMembersPage;
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => { await act(async () => root.render(null)); scope = 'project-a'; setLocale('zh-CN'); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });
async function render() { await act(async () => root.render(<Page />)); }
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === text)!;
const card = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="查看 ${name}"]`)!;
const control = (name: string) => [...host.querySelectorAll('dialog label')].find(node => node.firstChild?.textContent === name)!.querySelector<HTMLInputElement>('input')!;
async function input(element: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function submit() { await act(async () => host.querySelector('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

test('the eight reference profiles remain searchable and switch to a complete list', async () => {
  await render(); expect(host.querySelectorAll('ul li')).toHaveLength(8);
  expect(host.textContent).toContain('Chief Operating Officer'); expect(host.textContent).toContain('(704) 555-0127');
  await input(host.querySelector<HTMLInputElement>('input[type=search]')!, 'binhan628');
  expect(host.querySelectorAll('ul li')).toHaveLength(1);
  await input(host.querySelector<HTMLInputElement>('input[type=search]')!, 'missing-person'); expect(host.textContent).toContain('没有匹配的成员');
  await act(async () => button('清除筛选').click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="成员列表"]')!.click());
  expect(host.querySelectorAll('tbody tr')).toHaveLength(8);
});

test('project scope changes discard reference edits and active search from the previous scope', async () => {
  await render(); await input(host.querySelector<HTMLInputElement>('input[type=search]')!, 'Esther');
  scope = 'project-b'; await render();
  expect(host.querySelector<HTMLInputElement>('input[type=search]')!.value).toBe('');
  expect(host.querySelectorAll('ul li')).toHaveLength(8);
});

test('editing, cancellation, Escape and removal confirmation form a complete preview flow', async () => {
  await render(); await act(async () => card('Esther Howard').click());
  await input(control('姓名'), 'Uncommitted name'); await act(async () => button('取消').click());
  expect(card('Esther Howard')).not.toBeNull(); expect(card('Uncommitted name')).toBeNull();
  await act(async () => card('Esther Howard').click()); await input(control('姓名'), 'Esther Howard Jr'); await submit();
  expect(card('Esther Howard Jr')).not.toBeNull();
  await act(async () => card('Esther Howard Jr').click()); await act(async () => button('移除成员').click());
  expect(host.querySelector('[role=alertdialog]')).not.toBeNull();
  await act(async () => button('取消').click()); expect(host.querySelectorAll('ul li')).toHaveLength(8);
  await act(async () => button('保存更改').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(host.querySelector('dialog')).toBeNull();
  await act(async () => card('Esther Howard Jr').click()); await act(async () => button('移除成员').click()); await act(async () => button('移除成员').click());
  expect(host.querySelectorAll('ul li')).toHaveLength(7);
});

test('a new department accepts a new preview member and reports duplicate department names', async () => {
  await render(); await act(async () => button('新建部门').click()); await input(control('部门名称'), 'Product');
  expect(host.querySelector('[role=alert]')).not.toBeNull(); expect(button('创建').disabled).toBe(true);
  await input(control('部门名称'), 'Design'); await submit();
  expect(host.querySelector('[role=tabpanel]')!.textContent).toContain('Design');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="添加 Design 成员"]')!.click());
  expect(control('部门').value).toBe('Design');
  await input(control('姓名'), 'New Designer'); await input(control('邮箱'), 'designer@example.test'); await submit();
  await act(async () => button('团队概览').click());
  expect(host.querySelectorAll('ul li')).toHaveLength(9); expect(card('New Designer')).not.toBeNull();
});


test('interface language follows app locale without discarding the open member draft', async () => {
  await render();
  expect(host.querySelector('h1')!.textContent).toBe('团队');
  expect(host.textContent).toContain('远程');
  expect(host.querySelector('time')!.textContent).toBe('2018年2月28日');
  await act(async () => card('Esther Howard').click());
  await input(control('姓名'), '草稿姓名');
  await act(async () => setLocale('en-US'));
  expect(host.querySelector('h1')!.textContent).toBe('Teams');
  expect(host.querySelector('time')!.textContent).toBe('February 28, 2018');
  expect(host.querySelector('dialog')!.textContent).toContain('Member details');
  expect(control('Name').value).toBe('草稿姓名');
  await act(async () => setLocale('zh-CN'));
  expect(control('姓名').value).toBe('草稿姓名');
  expect(button('保存更改')).toBeDefined();
});
