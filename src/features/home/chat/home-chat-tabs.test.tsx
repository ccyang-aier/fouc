import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { indexedDB } from 'fake-indexeddb';
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getProjectUiSession } from '@/lib/project-ui-session';
import { PageSessionNamespace, ProjectUiSessionContext } from '@/lib/page-session-state';
import type { ChatContext, ChatSubmission } from './chat-types';
import type { ChatComposer } from './chat-composer';

let browser: Window, host: HTMLElement, root: Root;
let renderTabs: () => ReactNode;
const scope = 'chat-tab-test:local:project';
const context: ChatContext = { execution: { kind: 'auto' }, autoRules: { modelIds: null, reasoningEffort: 'medium' }, projectId: 'project', projectName: 'Project', knowledgeBaseId: null, knowledgeBaseName: null };
const message = (text: string): ChatSubmission => ({ id: crypto.randomUUID(), text, context, createdAt: new Date(), mode: null, attachments: [] });

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  Object.assign(globals, { window: browser, indexedDB, IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: () => 0 });
  mock.module('@/features/identity/identity-provider', () => ({ useIdentity: () => ({ session: { status: 'anonymous' } }) }));
  mock.module('@/features/project/project-resources', () => ({ useProjectResources: () => ({ scopeKey: scope, selectedProject: { id: 'project', name: 'Project' } }) }));
  mock.module('motion/react', () => ({ motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> } }));
  mock.module('@phosphor-icons/react', () => ({ ArrowLeft: () => null, ChatText: () => null }));
  mock.module('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
  mock.module('./chat-conversation', () => ({ ChatConversation: ({ submissions }: { submissions: ChatSubmission[] }) => <article>{submissions.map(item => <p key={item.id}>{item.text}</p>)}</article> }));
  mock.module('./chat-greeting', () => ({ ChatGreeting: () => null }));
  mock.module('./chat-recent-conversations', () => ({ ChatRecentConversations: () => null }));
  mock.module('./chat-composer', () => ({ ChatComposer: ({ draft, setDraft, onSubmit }: ComponentProps<typeof ChatComposer>) => <div><input value={draft.text} onInput={event => { const text = event.currentTarget.value; setDraft(current => ({ ...current, text })); }} /><button onClick={() => onSubmit(message(draft.text))}>Send</button></div> }));
  const { HomeChat } = await import('./home-chat');
  const { saveChatConversation } = await import('./chat-history');
  const session = getProjectUiSession(scope);
  await session.loaded;
  const conversation = { id: 'conversation', submissions: [message('first')], updatedAt: new Date() };
  saveChatConversation(scope, conversation);
  renderTabs = () => <ProjectUiSessionContext value={session}>{[0, 1].map(instance => <PageSessionNamespace key={instance} name={`page:${instance}`}><div data-copy={instance}><HomeChat conversation={conversation} t={key => key} onOpenConnectors={() => {}} /></div></PageSessionNamespace>)}</ProjectUiSessionContext>;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

test('conversation copies share live messages so a second tab cannot overwrite a newer submission', async () => {
  await act(async () => root.render(renderTabs()));
  const first = host.querySelector<HTMLElement>('[data-copy="0"]')!;
  const second = host.querySelector<HTMLElement>('[data-copy="1"]')!;
  async function send(page: HTMLElement, text: string) {
    await act(async () => { const input = page.querySelector('input')!; input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => page.querySelector('input')!.nextElementSibling!.dispatchEvent(new Event('click', { bubbles: true })));
  }
  await send(first, 'from first tab');
  expect([...second.querySelectorAll('article p')].map(item => item.textContent)).toEqual(['first', 'from first tab']);
  await send(second, 'from second tab');
  for (const page of [first, second]) expect([...page.querySelectorAll('article p')].map(item => item.textContent)).toEqual(['first', 'from first tab', 'from second tab']);
  expect(first.querySelector('input')!.value).toBe('from first tab');
  expect(second.querySelector('input')!.value).toBe('from second tab');
});
