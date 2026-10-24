import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Channel } from '@fouc/shared/chats';
import type { ChatHistoryEntry } from '@/features/home/chat/chat-history';

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let scopeKey: string;
let principal = 'alice';
let testId = 0;
let renderSections: () => ReactNode;
let chat: typeof import('@/features/home/chat/chat-history');
let navigation: typeof import('@/features/chats/channel-navigation');
const directories = new Map<string, Channel[]>();
const notifications: Array<{ tone: string; title: string }> = [];
const opened: ChatHistoryEntry[] = [];

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'DocumentFragment']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const Icon = () => null;
  mock.module('@phosphor-icons/react', () => ({ ChatCircleDots: Icon, DotsThree: Icon, PencilSimple: Icon, Plus: Icon, PushPin: Icon, PushPinSlash: Icon, SortAscending: Icon, ChatsCircle: Icon, Trash: Icon, CaretRight: Icon, Check: Icon, MagnifyingGlass: Icon, X: Icon }));
  mock.module('@/features/identity/identity-provider', () => ({ useIdentity: () => ({ session: { status: 'authenticated', user: { id: principal } } }) }));
  mock.module('@/features/project/project-resources', () => ({ useProjectResources: () => ({ scopeKey, principal }) }));
  mock.module('@/features/chats/channel-data', () => ({ useChannelDirectory: () => ({ data: { items: directories.get(scopeKey) ?? [] }, isError: false, refetch: async () => {} }) }));
  mock.module('@/features/chats/channel-ui', () => ({ ChannelIcon: ({ channel }: { channel: Channel }) => <span data-channel-icon={channel.icon} /> }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: (tone: string, title: string) => { notifications.push({ tone, title }); return 1; } }) }));
  const { SidebarProjectSections } = await import('./sidebar-project-sections');
  const { TooltipProvider } = await import('@/components/ui/tooltip');
  chat = await import('@/features/home/chat/chat-history');
  navigation = await import('@/features/chats/channel-navigation');
  renderSections = () => <TooltipProvider><SidebarProjectSections key={scopeKey} onNewChat={() => {}} onAllChats={() => {}} onOpenChat={entry => opened.push(entry)} /></TooltipProvider>;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
}, 20_000);

beforeEach(async () => {
  await act(async () => root.render(null));
  scopeKey = `alice:server:project-${++testId}`;
  principal = 'alice';
  notifications.length = 0;
  opened.length = 0;
});

afterAll(async () => { await act(async () => root?.unmount()); await browser.happyDOM.abort(); });
async function render() { await act(async () => root.render(renderSections())); }
async function seed(channels: Channel[], entries: ChatHistoryEntry[] = [], favorites: string[] = []) {
  directories.set(scopeKey, channels);
  localStorage.setItem(`fouc.channel-preferences.${scopeKey}`, JSON.stringify({ favorites, muted: [], read: {} }));
  await act(async () => entries.forEach(entry => chat.saveChatConversation(scopeKey, entry)));
  await render();
}
function channel(id: string, name: string, ownerId = 'alice'): Channel {
  return { id, name, ownerId, projectId: 'project', description: '', icon: 'hash', color: 'violet', visibility: 'private', permissions: { invite: 'members', post: 'members' }, memberCount: 1, messageCount: 0, lastMessage: null, createdAt: '2026-10-24T00:00:00Z', updatedAt: '2026-10-24T00:00:00Z' };
}
function entry(id: string, title: string, pinned = false, minute = 0): ChatHistoryEntry {
  return { id, title, pinned, submissions: [], updatedAt: new Date(Date.UTC(2026, 9, 18, 8, minute)) };
}
function names(section: string) {
  return [...host.querySelectorAll(`section[aria-label="${section}"] button[title]`)].map(button => button.textContent);
}
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => button.click());
}

test('favorites share the pinned section with recent chats without duplicate channels', async () => {
  const pinnedChat = entry('same-id', 'Pinned chat', true);
  await seed([channel('same-id', 'Pinned channel'), channel('other', 'Other channel')], [pinnedChat, entry('recent', 'Recent chat')], ['same-id']);
  expect([...host.querySelectorAll('section')].map(section => section.getAttribute('aria-label'))).toEqual(['置顶', '频道', '最近']);
  expect(names('置顶')).toEqual(['Pinned channel', 'Pinned chat']);
  expect(names('频道')).toEqual(['Other channel']);
  expect(names('最近')).toEqual(['Recent chat']);
  await act(async () => host.querySelector<HTMLButtonElement>('section[aria-label="置顶"] button[title="Pinned chat"]')!.click());
  expect(opened).toEqual([pinnedChat]);
  await act(async () => host.querySelector<HTMLButtonElement>('section[aria-label="置顶"] button[title="Pinned channel"]')!.click());
  expect(navigation.channelNavigation.getSnapshot()).toMatchObject({ scope: scopeKey, channelId: 'same-id', create: false });
});

test('pinning updates shared channel preferences and never writes old local channel records', async () => {
  await seed([channel('channel', 'Design')], [entry('chat', 'Planning')]);
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
  await click('置顶“Design”');
  await click('置顶“Planning”');
  expect(names('置顶')).toEqual(['Design', 'Planning']);
  expect(names('频道')).toEqual([]);
  expect(names('最近')).toEqual([]);
  expect(JSON.parse(localStorage.getItem(`fouc.channel-preferences.${scopeKey}`)!).favorites).toEqual(['channel']);
  expect(localStorage.getItem(`fouc.project.sidebar-tags.${scopeKey}`)).toBeNull();
  await click('取消置顶“Design”');
  expect(names('频道')).toEqual(['Design']);
  expect(names('置顶')).toEqual(['Planning']);
  await click('取消置顶“Planning”');
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
  expect(names('最近')).toEqual(['Planning']);
  expect(notifications.filter(item => item.tone === 'success')).toHaveLength(4);
});

test('pinned chats keep six recent slots and channel identities remain scoped to project and account', async () => {
  await seed([channel('design', 'Design')], [entry('pin-a', 'Pinned A', true), entry('pin-b', 'Pinned B', true), ...Array.from({ length: 7 }, (_, index) => entry(`recent-${index}`, `Recent ${index}`, false, index))], ['design']);
  expect(names('置顶')).toHaveLength(3);
  expect(names('最近')).toEqual(['Recent 6', 'Recent 5', 'Recent 4', 'Recent 3', 'Recent 2', 'Recent 1']);
  scopeKey += '-other';
  await render();
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
  expect(names('频道')).toEqual([]);
  expect(names('最近')).toEqual([]);
  principal = 'bob';
  scopeKey = `bob:server:project-${testId}`;
  await render();
  expect(names('频道')).toEqual([]);
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
});

test('creating routes to the real channel page and only owners get channel management menus', async () => {
  await seed([channel('owned', 'Owned'), channel('joined', 'Joined', 'bob')]);
  expect(host.querySelector('button[aria-label="“Owned”的更多操作"]')).not.toBeNull();
  expect(host.querySelector('button[aria-label="“Joined”的更多操作"]')).toBeNull();
  await click('新建频道');
  expect(navigation.channelNavigation.getSnapshot()).toMatchObject({ scope: scopeKey, channelId: null, create: true });
  expect(host.querySelector('dialog')).toBeNull();
});

test('owner channel actions route to settings and deletion confirmation in the channel page', async () => {
  await seed([channel('owned', 'Owned')]);
  async function openMenu() {
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="“Owned”的更多操作"]')!;
    await act(async () => { trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })); });
  }
  await openMenu();
  const rename = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === '重命名');
  expect(rename).toBeDefined();
  await act(async () => rename!.click());
  expect(navigation.channelNavigation.getSnapshot()).toMatchObject({ scope: scopeKey, channelId: 'owned', create: false, mode: 'settings' });
  await openMenu();
  const remove = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === '删除');
  expect(remove?.getAttribute('data-variant')).toBe('destructive');
  await act(async () => remove!.click());
  expect(navigation.channelNavigation.getSnapshot()).toMatchObject({ scope: scopeKey, channelId: 'owned', create: false, mode: 'delete' });
  expect(host.querySelector('dialog')).toBeNull();
});

test('visible channel activation survives consuming its navigation intent', async () => {
  await seed([channel('active', 'Active channel'), channel('other', 'Other channel')]);
  let release!: () => void;
  await act(async () => { release = navigation.channelActiveView.publish(scopeKey, 'active'); });
  const activeButton = host.querySelector<HTMLButtonElement>('button[title="Active channel"]')!;
  expect(activeButton.getAttribute('aria-current')).toBe('page');
  expect(activeButton.closest('[data-active]')?.getAttribute('data-active')).toBe('true');
  await act(async () => {
    navigation.requestChannelOpen(scopeKey, 'active');
    navigation.channelNavigation.consume(navigation.channelNavigation.getSnapshot()!.revision);
  });
  expect(navigation.channelNavigation.getSnapshot()).toBeNull();
  expect(activeButton.getAttribute('aria-current')).toBe('page');
  await act(async () => release());
  expect(host.querySelector('button[aria-current="page"]')).toBeNull();
});

test('hidden tab cleanup cannot erase a newer visible channel or activate a different project', async () => {
  await seed([channel('first', 'First'), channel('second', 'Second')]);
  let releaseFirst!: () => void, releaseSecond!: () => void;
  await act(async () => {
    releaseFirst = navigation.channelActiveView.publish(scopeKey, 'first');
    releaseSecond = navigation.channelActiveView.publish(scopeKey, 'second');
  });
  await act(async () => releaseFirst());
  expect(host.querySelector('button[aria-current="page"]')?.getAttribute('title')).toBe('Second');
  await act(async () => releaseSecond());
  let releaseOther!: () => void;
  await act(async () => { releaseOther = navigation.channelActiveView.publish(`${scopeKey}-other`, 'first'); });
  expect(host.querySelector('button[aria-current="page"]')).toBeNull();
  await act(async () => releaseOther());
});
