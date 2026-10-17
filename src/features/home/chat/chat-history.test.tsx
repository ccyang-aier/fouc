import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { useProjectResources as ReadResources } from '@/features/project/project-resources';
import type { ChatHistoryEntry } from './chat-history';

type ResourceState = ReturnType<typeof ReadResources>;
let browser: Window;
let root: Root;
let session: { status: 'anonymous' } | { status: 'authenticated'; user: { id: string } };
let resources: ResourceState;
let history: ChatHistoryEntry[];
let save: typeof import('./chat-history').saveChatConversation;
let renderHistory: () => ReactNode;
let testId = 0;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('@/features/identity/identity-provider', () => ({ useIdentity: () => ({ session }) }));
  mock.module('@/features/project/project-client', () => ({ projectClient: { list: async () => [] } }));
  const { ProjectResourceProvider, useProjectResources } = await import('@/features/project/project-resources');
  const { saveChatConversation, useChatHistory } = await import('./chat-history');
  save = saveChatConversation;
  function Capture() {
    const project = useProjectResources();
    const entries = useChatHistory();
    useEffect(() => { resources = project; history = entries; }, [project, entries]);
    return null;
  }
  renderHistory = () => <ProjectResourceProvider><Capture /></ProjectResourceProvider>;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
  localStorage.clear();
  session = { status: 'anonymous' };
  testId++;
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

async function render() { await act(async () => root.render(renderHistory())); }
async function select(id: string) { await act(async () => resources.selectProject(id)); }
async function switchUser(id: string | null) {
  session = id ? { status: 'authenticated', user: { id } } : { status: 'anonymous' };
  await render();
}
function entry(id: string): ChatHistoryEntry { return { id, submissions: [], updatedAt: new Date('2026-10-17T08:00:00Z') }; }
async function write(value: ChatHistoryEntry, scopeKey = resources.scopeKey!) {
  await act(async () => save(scopeKey, value));
}

test('history follows two projects and two accounts, and returns intact when switching back', async () => {
  const first = `history-${testId}-a`, second = `history-${testId}-b`;
  localStorage.setItem('fouc.local-projects', JSON.stringify([{ id: first, name: '项目 A' }, { id: second, name: '项目 B' }]));
  await switchUser('history-user-a');
  expect(history).toEqual([]);
  const userAFirst = entry('user-a-first');
  await write(userAFirst);
  const firstScope = resources.scopeKey!;
  await select(second);
  expect(history).toEqual([]);
  const userASecond = entry('user-a-second');
  await write(userASecond);
  await select(first);
  expect(history).toEqual([userAFirst]);

  await switchUser('history-user-b');
  expect(resources.selectedProject?.id).toBe(first);
  expect(history).toEqual([]);
  const userBFirst = entry('user-b-first');
  await write(userBFirst);
  await select(second);
  expect(history).toEqual([]);
  const userBSecond = entry('user-b-second');
  await write(userBSecond);
  await write(entry('late-user-a-write'), firstScope);
  expect(history).toEqual([userBSecond]);

  await switchUser('history-user-a');
  expect(resources.selectedProject?.id).toBe(first);
  expect(history.map((item) => item.id)).toEqual(['late-user-a-write', 'user-a-first']);
  await select(second);
  expect(history).toEqual([userASecond]);
  await switchUser('history-user-b');
  expect(resources.selectedProject?.id).toBe(second);
  expect(history).toEqual([userBSecond]);
  await select(first);
  expect(history).toEqual([userBFirst]);
  await switchUser(null);
  expect(history).toEqual([]);
});

test('updating a conversation only replaces its own project entry, even with a shared conversation ID', async () => {
  const first = `history-${testId}-a`, second = `history-${testId}-b`;
  localStorage.setItem('fouc.local-projects', JSON.stringify([{ id: first, name: 'A' }, { id: second, name: 'B' }]));
  await render();
  const original = entry('same-conversation');
  await write(original);
  const firstScope = resources.scopeKey!;
  await select(second);
  const other = { ...entry('same-conversation'), updatedAt: new Date('2026-10-17T09:00:00Z') };
  await write(other);
  const updated = { ...original, updatedAt: new Date('2026-10-17T10:00:00Z') };
  await write(updated, firstScope);
  expect(history).toEqual([other]);
  await select(first);
  expect(history).toEqual([updated]);
  await select(second);
  expect(history).toEqual([other]);
});

test('without a selected real project the history stays empty when another scope receives a write', async () => {
  localStorage.setItem('fouc.local-projects', JSON.stringify([]));
  await render();
  expect(resources.scopeKey).toBeNull();
  expect(history).toEqual([]);
  await write(entry('unrelated'), `history-user-a:local:absent-${testId}`);
  expect(history).toEqual([]);
});
