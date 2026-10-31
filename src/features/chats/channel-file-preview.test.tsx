import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { act, useState, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { ChannelAttachment } from '@fouc/shared/chats';
import type { ChannelWorkbench } from './use-channel-workbench';

type Pending = { projectId: string; channelId: string; resolve: (value: Blob) => void; reject: (error: Error) => void };
let browser: Window;
let root: Root;
let host: HTMLDivElement;
let Preview: typeof import('./channel-file-preview').ChannelFilePreview;
let visible = true;
const requests: Pending[] = [];
const created: string[] = [];
const revoked: string[] = [];
let restoreUrls: () => void;
const attachment: ChannelAttachment = { id: 'attachment-a', messageId: 'message-a', name: 'notes.md', mime: 'text/markdown', size: 80, createdAt: '2026-10-24T00:00:00Z' };

function TestButton({ children, onClick, disabled, loading, type = 'button', 'aria-label': label }: ComponentProps<'button'> & { loading?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled || loading} aria-label={label}>{children}</button>;
}
function TestModal({ title, children, headerIcon, metadata, onClose }: { title: string; children: ReactNode; headerIcon?: ReactNode; metadata?: ReactNode; onClose: () => void }) {
  return <div role="dialog" aria-label={title}>{headerIcon}<h2>{title}</h2>{metadata}<button type="button" aria-label="Close preview" onClick={onClose}>Close</button>{children}</div>;
}
function Harness({ workbench, initiallyOpen = false }: { workbench: ChannelWorkbench; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <><button type="button" aria-label="Open preview" onClick={() => setOpen(true)}>Open</button>{open && <Preview attachment={attachment} workbench={workbench} onClose={() => setOpen(false)} />}</>;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://127.0.0.1:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const Icon = () => null;
  mock.module('next/image', () => ({ default: () => null }));
  mock.module('react-markdown', () => ({ default: ({ children }: { children: ReactNode }) => <div data-markdown>{children}</div> }));
  mock.module('remark-gfm', () => ({ default: () => {} }));
  mock.module('@/lib/i18n', () => ({ defineMessages: (value: unknown) => value, useTranslation: () => ({ t: (key: string) => key, locale: 'zh-CN' }) }));
  mock.module('@/lib/page-visibility', () => ({ usePageVisible: () => visible }));
  mock.module('@/components/ui/button', () => ({ Button: TestButton }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: () => 1 }) }));
  mock.module('@/components/app-alert', () => ({ AppAlert: ({ title, description, action }: { title: string; description: ReactNode; action: ReactNode }) => <div role="alert"><strong>{title}</strong><p>{description}</p>{action}</div> }));
  mock.module('@/features/chats/channel-panel-modal', () => ({ ChannelPanelModal: TestModal }));
  mock.module('@/features/chats/channel-file-icon', () => ({ ChannelFileIcon: Icon }));
  mock.module('@/features/chats/channel-ui', () => ({ ChannelTool: ({ label, ...props }: ComponentProps<'button'> & { label: string }) => <TestButton {...props} aria-label={label} />, formatFileSize: (size: number) => `${size} B` }));
  class RequestError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
  mock.module('@/features/chats/channel-client', () => ({ ChannelRequestError: RequestError, channelClient: { attachment: (projectId: string, channelId: string) => new Promise<Blob>((resolve, reject) => requests.push({ projectId, channelId, resolve, reject })) } }));
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => { const url = `blob:preview-test-${created.length + 1}`; created.push(url); return url; };
  URL.revokeObjectURL = url => { revoked.push(url); };
  restoreUrls = () => { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; };
  Preview = (await import('./channel-file-preview')).ChannelFilePreview;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
}, 20_000);

beforeEach(async () => {
  await act(async () => root.render(null));
  visible = true; requests.length = 0; created.length = 0; revoked.length = 0;
});
afterAll(async () => { await act(async () => root.unmount()); restoreUrls(); await browser.happyDOM.abort(); });

// Only the resource scope is consumed by the preview; mutations stay outside this fixture.
function scope(projectId = 'project-a', channelId = 'channel-a', principal = 'alice'): ChannelWorkbench {
  return { channel: { id: channelId, projectId }, project: { scopeKey: `${principal}:server:${projectId}`, principal, selectedProject: { id: projectId } } } as ChannelWorkbench;
}
async function render(workbench = scope(), initiallyOpen = false) { await act(async () => root.render(<Harness workbench={workbench} initiallyOpen={initiallyOpen} />)); }
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ?? [...host.querySelectorAll('button')].find(item => item.textContent === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => button.click());
}
async function resolve(request: Pending, body: string) { await act(async () => request.resolve(new Blob([body], { type: 'text/markdown' }))); }

test('original content is requested only after opening a visible authenticated channel', async () => {
  await render();
  expect(requests).toHaveLength(0);
  visible = false; await click('Open preview');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(requests).toHaveLength(0);
  visible = true; await render(scope('project-a', 'channel-a', 'guest'));
  expect(requests).toHaveLength(0);
  const mismatched = scope(); mismatched.project.selectedProject!.id = 'other-project';
  await render(mismatched);
  expect(requests).toHaveLength(0);
  await render(scope());
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ projectId: 'project-a', channelId: 'channel-a' });
});

test('a real failed load can be retried and recovers into the readable document', async () => {
  await render(scope(), true);
  await act(async () => requests[0].reject(new Error('Connection interrupted')));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('failed');
  expect(created).toHaveLength(0);
  await click('retry');
  expect(requests).toHaveLength(2);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  await resolve(requests[1], '# Recovered document');
  expect(host.querySelector('[data-markdown]')?.textContent).toBe('# Recovered document');
  expect(host.querySelector('[role="status"]')).toBeNull();
  expect(created).toHaveLength(1);
  expect([...host.querySelectorAll('button')].find(button => button.textContent === 'download')?.disabled).toBe(false);
});

test('closing revokes a loaded Blob and a later closed-session response cannot restore it', async () => {
  await render(scope(), true);
  await resolve(requests[0], '# First document');
  const firstUrl = created[0];
  await click('Close preview');
  expect(revoked).toEqual([firstUrl]);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await click('Open preview');
  const pending = requests[1];
  await click('Close preview');
  await resolve(pending, '# Too late');
  expect(created).toEqual([firstUrl]);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain('Too late');
});

test('project and channel switches dispose old resources and reject stale in-flight content', async () => {
  await render(scope(), true);
  await resolve(requests[0], '# Project A');
  const firstUrl = created[0];
  await render(scope('project-b', 'channel-b'));
  expect(revoked).toEqual([firstUrl]);
  expect(host.textContent).not.toContain('Project A');
  const pendingProjectB = requests[1];
  await render(scope('project-b', 'channel-c'));
  expect(requests).toHaveLength(3);
  await resolve(pendingProjectB, '# Stale channel B');
  expect(created).toEqual([firstUrl]);
  expect(host.textContent).not.toContain('Stale channel B');
  await resolve(requests[2], '# Current channel C');
  expect(host.querySelector('[data-markdown]')?.textContent).toBe('# Current channel C');
  expect(created).toHaveLength(2);
  visible = false; await render(scope('project-b', 'channel-c'));
  expect(revoked).toEqual(created);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
