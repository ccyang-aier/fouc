import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import type { ProjectMembers } from '@fouc/shared/projects';

let browser: Window, host: HTMLDivElement, root: Root;
let Page: typeof import('./members-page').ProjectMembersPage;
let scope = 'project-a';
let actorRole: ProjectMembers['actorRole'] = 'owner';
let addFailure = false;
const added = mock(async () => { if (addFailure) throw new Error('Unavailable'); return directory(); });
const directory = (): ProjectMembers => ({ actorRole, items: [
  { userId: 'owner', name: 'Project owner', email: 'owner@example.test', role: 'owner', image: null, joinedAt: '2026-10-01T00:00:00Z' },
  { userId: 'reader', name: scope === 'project-a' ? 'Alice Reader' : 'Bob Reader', email: scope === 'project-a' ? 'alice@example.test' : 'bob@example.test', role: 'member', image: null, joinedAt: '2026-10-02T00:00:00Z' },
] });

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/?view=members' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'DocumentFragment', 'MutationObserver', 'ResizeObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.requestAnimationFrame = browser.requestAnimationFrame.bind(browser);
  globals.cancelAnimationFrame = browser.cancelAnimationFrame.bind(browser);
  browser.localStorage.setItem('fouc.language', 'en-US');
  Object.defineProperties(browser.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['ArrowClockwise', 'CaretDown', 'CaretRight', 'Check', 'MagnifyingGlass', 'ShieldCheck', 'SlidersHorizontal', 'UserPlus', 'UsersThree', 'X', 'ArrowRight', 'Copy', 'CheckCircle', 'Info', 'WarningCircle', 'XCircle', 'SquaresFour', 'Table'].map(name => [name, () => <svg aria-hidden />])));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: ({ name }: { name: string }) => <span>{name[0]}</span> }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: () => {} }) }));
  mock.module('@/features/identity/identity-provider', () => ({ useIdentity: () => ({ session: { status: 'authenticated', user: { id: 'owner' } } }) }));
  mock.module('../project-resources', () => ({ useProjectResources: () => ({ selectedProject: { source: 'server', id: scope }, scopeKey: scope }) }));
  mock.module('../project-client', () => ({ projectClient: { members: async () => directory(), addMember: added }, ProjectRequestError: class extends Error {} }));
  Page = (await import('./members-page')).ProjectMembersPage;
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => { await act(async () => root.render(null)); scope = 'project-a'; actorRole = 'owner'; addFailure = false; added.mockClear(); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });
async function until(condition: () => boolean) { for (let i = 0; i < 40 && !condition(); i++) await act(async () => { await Bun.sleep(0); }); expect(condition()).toBe(true); }
async function render() { await act(async () => root.render(<Page />)); await until(() => host.textContent!.includes(scope === 'project-a' ? 'Alice Reader' : 'Bob Reader')); }
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === text)!;
async function input(element: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }); }

test('search, empty results and list mode update the real directory projection', async () => {
  await render();
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await input(search, 'alice@'); expect(host.querySelectorAll('ul li')).toHaveLength(1);
  await input(search, 'not-found'); expect(host.textContent).toContain('No matching members');
  await act(async () => button('Clear filters').click()); expect(host.querySelectorAll('ul li')).toHaveLength(2);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Member list"]')!.click()); expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
});

test('switching projects resets filters and discards the previous project directory', async () => {
  await render(); await input(host.querySelector<HTMLInputElement>('input[type="search"]')!, 'alice');
  scope = 'project-b'; await render();
  expect(host.textContent).not.toContain('Alice Reader'); expect(host.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('');
});

test('ordinary members cannot add people and owner details expose no mutation controls', async () => {
  actorRole = 'member'; await render(); expect(button('Add member')).toBeUndefined();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="View member: Project owner"]')!.click());
  expect(host.querySelector('dialog')).not.toBeNull(); expect(button('Remove member')).toBeUndefined(); expect(button('Save changes')).toBeUndefined();
  await act(async () => button('Done').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(host.querySelector('dialog')).toBeNull();
});

test('failed additions preserve the email draft and remain retryable', async () => {
  await render(); await act(async () => button('Add member').click());
  await input(host.querySelector<HTMLInputElement>('input[type="email"]')!, 'someone@example.test'); addFailure = true;
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await until(() => Boolean(host.querySelector('[role="alert"]')));
  expect(host.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('someone@example.test');
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
});
