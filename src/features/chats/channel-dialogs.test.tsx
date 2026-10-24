import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { act, createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { Channel, CreateChannelInput, UpdateChannelInput } from '@fouc/shared/chats';

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let Form: typeof import('./channel-dialogs').ChannelFormDialog;
const submitted: Array<CreateChannelInput | UpdateChannelInput> = [];
const Menu = createContext<(open: boolean) => void>(() => {});
const Radio = createContext('');

function TestButton({ children, onClick, disabled, loading, type = 'button' }: ComponentProps<'button'> & { loading?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled || loading}>{children}</button>;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://127.0.0.1:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MutationObserver']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true;
  const Icon = () => null;
  mock.module('@phosphor-icons/react', () => ({ CaretDown: Icon, CaretRight: Icon, Check: Icon, DiceFive: Icon, LockSimple: Icon, MagnifyingGlass: Icon, Plus: Icon, Robot: Icon, Trash: Icon, X: Icon }));
  mock.module('@/lib/i18n', () => ({ defineMessages: (value: unknown) => value, useTranslation: () => ({ t: (key: string) => key }) }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: () => 1 }) }));
  mock.module('@/components/ui/button', () => ({ Button: TestButton }));
  mock.module('@/features/chats/channel-panel-modal', () => ({ ChannelPanelModal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div> }));
  mock.module('@/features/chats/channel-panel-people-picker', () => ({ ChannelPeoplePicker: () => null }));
  mock.module('@/features/chats/channel-ui', () => ({ ChannelIcon: ({ channel }: { channel: Pick<Channel, 'icon' | 'color'> }) => <span data-channel-icon={channel.icon} data-tone={channel.color} /> }));
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) => <Menu value={onOpenChange}>{children}</Menu>,
    DropdownMenuTrigger: ({ children, 'aria-label': label }: ComponentProps<'button'>) => { const open = useContext(Menu); return <button type="button" aria-label={label} onClick={() => open(true)}>{children}</button>; },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div role="menu">{children}</div>,
    DropdownMenuRadioGroup: ({ children, value, ...props }: ComponentProps<'div'> & { value: string }) => <Radio value={value}><div {...props}>{children}</div></Radio>,
    DropdownMenuRadioItem: ({ children, value, onSelect, 'aria-label': label }: { children: ReactNode; value: string; onSelect: (event: Event) => void; 'aria-label': string }) => { const selected = useContext(Radio) === value; return <button type="button" role="menuitemradio" aria-checked={selected} aria-label={label} onClick={() => onSelect(new Event('select', { cancelable: true }))}>{children}</button>; },
    DropdownMenuSeparator: () => <hr />,
  }));
  Form = (await import('./channel-dialogs')).ChannelFormDialog;
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
}, 20_000);

beforeEach(async () => { await act(async () => root.render(null)); submitted.length = 0; });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
async function render(channel?: Channel) { await act(async () => root.render(<Form channel={channel} projectMembers={[]} busy={false} onClose={() => {}} onSubmit={async input => { submitted.push(input); }} />)); }
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing picker button: ${label}`);
  await act(async () => button.click());
}
async function name(value: string) {
  const input = host.querySelector<HTMLInputElement>('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

test('new channel leaves color to the server and sends the default icon explicitly', async () => {
  await render(); await name('New channel');
  expect(host.textContent).toContain('randomColor');
  await submit();
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({ name: 'New channel', icon: 'hash' });
  expect(Object.hasOwn(submitted[0], 'color')).toBe(false);
});

test('icon and fixed color choices submit together, and random can be restored', async () => {
  await render(); await name('Launch'); await click('chooseIcon');
  const first = host.querySelector<HTMLButtonElement>('button[aria-label="icon_hash"]')!;
  first.focus();
  await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
  expect(document.activeElement?.getAttribute('aria-label')).toBe('icon_circles-four');
  await click('icon_rocket'); await click('blue'); await submit();
  expect(submitted[0]).toMatchObject({ name: 'Launch', icon: 'rocket', color: 'blue' });
  expect(host.querySelector('[aria-label="icon_rocket"]')?.getAttribute('aria-checked')).toBe('true');
  await click('randomColor'); await submit();
  expect(submitted[1]).toMatchObject({ icon: 'rocket' });
  expect(Object.hasOwn(submitted[1], 'color')).toBe(false);
});

test('editing keeps the saved icon and color and does not offer an unsupported random reset', async () => {
  const channel: Channel = { id: 'channel', projectId: 'project', name: 'Design', description: '', icon: 'palette', color: 'rose', visibility: 'private', ownerId: 'owner', permissions: { invite: 'members', post: 'members' }, memberCount: 1, messageCount: 0, lastMessage: null, createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z' };
  await render(channel); await click('chooseIcon');
  expect(host.querySelector('[aria-label="icon_palette"]')?.getAttribute('aria-checked')).toBe('true');
  expect(host.querySelector('[aria-label="rose"]')?.getAttribute('aria-checked')).toBe('true');
  expect(host.querySelector('[aria-label="randomColor"]')).toBeNull();
  await submit();
  expect(submitted[0]).toMatchObject({ name: 'Design', icon: 'palette', color: 'rose' });
});
