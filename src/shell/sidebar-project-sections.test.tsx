import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SidebarChannel } from './sidebar-channels';
import type { ChatHistoryEntry } from '@/features/home/chat/chat-history';

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let scopeKey: string;
let testId = 0;
let renderSections: () => ReactNode;
let saveChannels: typeof import('./sidebar-channels').saveSidebarChannels;
let chat: typeof import('@/features/home/chat/chat-history');
const notifications: Array<{ tone: string; title: string }> = [];
const opened: ChatHistoryEntry[] = [];

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'DocumentFragment']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  // Glyph rendering is covered by browser QA; this suite exercises list behavior.
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => ({ ChatCircleDots: icon, DotsThree: icon, Hash: icon, Plus: icon, SortAscending: icon, ChatsCircle: icon, PencilSimple: icon, PushPin: icon, PushPinSlash: icon, Trash: icon, CaretRight: icon, X: icon, Check: icon }));
  mock.module('@/features/project/project-resources', () => ({ useProjectResources: () => ({ scopeKey }) }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: (tone: string, title: string) => { notifications.push({ tone, title }); return 1; } }) }));
  const { SidebarProjectSections } = await import('./sidebar-project-sections');
  const { TooltipProvider } = await import('@/components/ui/tooltip');
  saveChannels = (await import('./sidebar-channels')).saveSidebarChannels;
  chat = await import('@/features/home/chat/chat-history');
  renderSections = () => <TooltipProvider><SidebarProjectSections key={scopeKey} onNewChat={() => {}} onAllChats={() => {}} onOpenChat={entry => opened.push(entry)} /></TooltipProvider>;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
  scopeKey = `pinned-ui:local:project-${++testId}`;
  notifications.length = 0;
  opened.length = 0;
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

async function render() { await act(async () => root.render(renderSections())); }
async function seed(channels: SidebarChannel[], entries: ChatHistoryEntry[] = []) {
  await act(async () => { saveChannels(scopeKey, channels); entries.forEach(entry => chat.saveChatConversation(scopeKey, entry)); });
  await render();
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

test('pinned channels and chats appear once above channels and retain chat opening', async () => {
  const pinnedChat = entry('same-id', 'Pinned chat', true);
  await seed([{ id: 'same-id', name: 'Pinned channel', pinned: true }, { id: 'other', name: 'Other channel' }], [pinnedChat, entry('recent', 'Recent chat')]);
  expect([...host.querySelectorAll('section')].map(section => section.getAttribute('aria-label'))).toEqual(['置顶', '频道', '最近']);
  expect(names('置顶')).toEqual(['Pinned channel', 'Pinned chat']);
  expect(names('频道')).toEqual(['Other channel']);
  expect(names('最近')).toEqual(['Recent chat']);
  const button = host.querySelector<HTMLButtonElement>('section[aria-label="置顶"] button[title="Pinned chat"]')!;
  await act(async () => button.click());
  expect(opened).toEqual([pinnedChat]);
});

test('pin and unpin move entries between sections and remove the last empty pinned section', async () => {
  await seed([{ id: 'channel', name: 'Design' }], [entry('chat', 'Planning')]);
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
  await click('置顶“Design”');
  await click('置顶“Planning”');
  expect(names('置顶')).toEqual(['Design', 'Planning']);
  expect(names('频道')).toEqual([]);
  expect(names('最近')).toEqual([]);
  await click('取消置顶“Design”');
  expect(names('频道')).toEqual(['Design']);
  expect(names('置顶')).toEqual(['Planning']);
  await click('取消置顶“Planning”');
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
  expect(names('最近')).toEqual(['Planning']);
  expect(notifications.filter(item => item.tone === 'success')).toHaveLength(4);
});

test('pinned chats do not consume recent slots and the next project has no pinned entries', async () => {
  await seed([], [entry('pin-a', 'Pinned A', true), entry('pin-b', 'Pinned B', true), ...Array.from({ length: 7 }, (_, index) => entry(`recent-${index}`, `Recent ${index}`, false, index))]);
  expect(names('置顶')).toHaveLength(2);
  expect(names('最近')).toEqual(['Recent 6', 'Recent 5', 'Recent 4', 'Recent 3', 'Recent 2', 'Recent 1']);
  scopeKey += '-other';
  await render();
  expect(host.querySelector('section[aria-label="置顶"]')).toBeNull();
  expect(names('频道')).toEqual([]);
  expect(names('最近')).toEqual([]);
});
