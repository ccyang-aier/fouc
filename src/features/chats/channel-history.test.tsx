import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { ChannelAttachment, ChannelMessage, ChannelSnapshot } from '@fouc/shared/chats';
import { emptyChannelHistory, mergeChannelMessages, retainChannelHistory } from './channel-history';

let browser: Window;
let root: Root;
let api: typeof import('./channel-data');
let detail: ReturnType<typeof api.useChannelDetail>;
let assets: ReturnType<typeof api.useChannelAssets>;
let render: () => ReactNode;
let sequence = 0;
let resource: { selectedProject: { id: string; source: 'server' | 'local' }; scopeKey: string; principal: string };
let messages: ChannelMessage[];
let readError: Error | null;

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

function message(index: number): ChannelMessage {
  return { id: `message-${index}`, projectId: resource.selectedProject.id, channelId: 'channel', authorId: 'person', authorName: 'Owner', authorImage: null,
    authorKind: 'user', kind: 'text', body: `Message ${index}`, title: null, threadId: null, pinned: false, poll: null, reactions: [], attachments: [],
    createdAt: new Date(Date.UTC(2026, 9, 24, 8, index)).toISOString(), editedAt: null };
}

function snapshot(): ChannelSnapshot {
  return { channel: { id: 'channel', projectId: resource.selectedProject.id, name: 'Real channel', description: '', color: 'violet', visibility: 'private',
    ownerId: 'owner', permissions: { invite: 'members', post: 'members' }, memberCount: 1, messageCount: messages.length,
    lastMessage: messages.at(-1)?.body ?? null, createdAt: messages[0].createdAt, updatedAt: messages.at(-1)!.createdAt },
    actorId: 'person', actorRole: 'owner', members: [], messages: messages.slice(-2), hasMoreMessages: messages.length > 2 };
}

beforeAll(async () => {
  browser = new Window({ url: 'http://127.0.0.1:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('@/features/project/project-resources', () => ({ useProjectResources: () => resource }));
  mock.module('@/lib/page-visibility', () => ({ usePageVisible: () => true }));
  mock.module('@/features/chats/channel-client', () => ({ ChannelRequestError: RequestError, channelClient: {
    get: async () => { if (readError) throw readError; return snapshot(); },
    history: async (_project: string, _channel: string, before?: string) => {
      if (readError) throw readError;
      const position = before ? messages.findIndex(item => item.id === before) : messages.length;
      if (position < 0) throw new RequestError(404, 'INVALID_INPUT', 'Cursor was deleted');
      return { items: messages.slice(Math.max(0, position - 100), position), hasMore: position > 100 };
    },
    assets: async () => { if (readError) throw readError; return { items: [{ id: 'old-document', name: 'Specification.md', mime: 'text/markdown', size: 12,
      messageId: messages[0].id, createdAt: messages[0].createdAt }] satisfies ChannelAttachment[] }; },
  } }));
  api = await import('./channel-data');
  function Capture() { detail = api.useChannelDetail('channel'); assets = api.useChannelAssets('channel'); return null; }
  render = () => <Capture />;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
  sequence++;
  resource = { principal: `owner-${sequence}`, scopeKey: `owner-${sequence}:server:project-${sequence}`, selectedProject: { id: `project-${sequence}`, source: 'server' } };
  messages = [1, 2, 3, 4].map(message);
  readError = null;
});

afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

async function settle(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  expect(predicate()).toBe(true);
}
async function mount() { await act(async () => root.render(render())); await settle(() => Boolean(detail.data && assets.data)); }

test('merging a live snapshot updates overlapping messages and does not overwrite the latest channel summary', () => {
  const original = message(3);
  const changed = { ...original, body: 'Edited on the server' };
  expect(mergeChannelMessages([message(1), original], [changed, message(4)]).map(item => item.body)).toEqual(['Message 1', 'Edited on the server', 'Message 4']);
  const previous = snapshot();
  const next = { ...previous, messages: [message(4)], hasMoreMessages: true };
  expect(retainChannelHistory({ ...emptyChannelHistory, loaded: true, messages: [message(1)] }, previous, next).messages.map(item => item.id)).toEqual(['message-1', 'message-3']);
  expect(next.channel.lastMessage).toBe('Message 4');
});

test('loaded history survives a moving live window and refresh, while assets include files outside that window', async () => {
  await mount();
  expect(detail.data?.messages.map(item => item.id)).toEqual(['message-3', 'message-4']);
  expect(assets.data?.items[0].messageId).toBe('message-1');
  await act(async () => detail.loadEarlier());
  await settle(() => detail.data?.messages.length === 4);
  expect(detail.hasMore).toBe(false);
  messages = [...messages, message(5), message(6)];
  await act(async () => { await detail.refetch(); });
  await settle(() => detail.data?.messages.length === 6);
  expect(detail.data?.channel.lastMessage).toBe('Message 6');
  messages = messages.map(item => item.id === 'message-1' ? { ...item, body: 'Updated earlier message' } : item);
  await act(async () => { api.publishChannelSnapshot(resource.scopeKey, snapshot()); });
  await settle(() => detail.data?.messages[0]?.body === 'Updated earlier message');
  expect(detail.data?.messages.at(-1)?.id).toBe('message-6');
});

test('revocation clears loaded content and rejects a late mutation even after a fresh authorized GET', async () => {
  await mount();
  await act(async () => detail.loadEarlier());
  const scope = resource.scopeKey;
  const revision = api.captureChannelAccess(scope, 'channel');
  let finish!: (value: ChannelSnapshot) => void;
  const pending = api.runChannelMutation(scope, 'channel', () => new Promise(resolve => { finish = resolve; }));
  const failure = pending.catch(error => error);
  readError = new RequestError(403, 'FORBIDDEN', 'Membership revoked');
  await act(async () => { await detail.refetch(); });
  await settle(() => !detail.data && !assets.data);
  expect(api.publishChannelSnapshot(scope, snapshot())).toBe(false);
  readError = null;
  await act(async () => { await detail.refetch(); });
  await settle(() => Boolean(detail.data));
  expect(api.captureChannelAccess(scope, 'channel')).toBeGreaterThan(revision);
  expect(api.publishChannelSnapshot(scope, snapshot(), revision)).toBe(false);
  finish(snapshot());
  expect(await failure).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  expect(detail.data?.messages.map(item => item.id)).toEqual(['message-3', 'message-4']);
});

test('history and assets do not follow a same-named channel into another identity/project or a local project', async () => {
  await mount();
  await act(async () => detail.loadEarlier());
  resource = { principal: 'another-owner', scopeKey: 'another-owner:server:another-project', selectedProject: { id: 'another-project', source: 'server' } };
  messages = [message(8), message(9)];
  await act(async () => root.render(render()));
  await settle(() => detail.data?.channel.projectId === 'another-project');
  expect(detail.data?.messages.map(item => item.id)).toEqual(['message-8', 'message-9']);
  resource = { ...resource, scopeKey: 'another-owner:local:local-project', selectedProject: { id: 'local-project', source: 'local' } };
  await act(async () => root.render(render()));
  expect(detail.data).toBeUndefined();
  expect(assets.data).toBeUndefined();
});
