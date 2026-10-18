import { expect, test } from 'bun:test';
import { indexedDB } from 'fake-indexeddb';
import { ProjectUiSession } from './project-ui-session';

Object.assign(globalThis, { indexedDB });

test('fresh sessions restore typed data and stay isolated by principal, source and project', async () => {
  const scope = 'alice:local:project-a';
  const first = new ProjectUiSession(scope);
  await first.loaded;
  const draft = { text: 'unfinished', at: new Date('2026-10-18T10:00:00Z'), attachments: [new Blob(['actual bytes'], { type: 'text/plain' })] };
  first.set('page:7:draft', draft, null);
  first.set('tabs', { order: [7, 2], active: 7 }, null);
  const reopened = new ProjectUiSession(scope);
  await reopened.loaded;
  expect(reopened.get('tabs', null)).toEqual({ order: [7, 2], active: 7 });
  const restored = reopened.get<typeof draft | null>('page:7:draft', null)!;
  expect(restored.text).toBe('unfinished');
  expect(restored.at instanceof Date).toBe(true);
  expect(await restored.attachments[0].text()).toBe('actual bytes');
  for (const other of ['bob:local:project-a', 'alice:server:project-a', 'alice:local:project-b']) {
    const session = new ProjectUiSession(other);
    await session.loaded;
    expect(session.get('tabs', null)).toBeNull();
    expect(session.get('page:7:draft', null)).toBeNull();
  }
});

test('updates queued during hydration merge into stored data and closing only removes released page state', async () => {
  const first = new ProjectUiSession('pending:local:project');
  await first.loaded;
  first.set('chat.history', ['first'], []);
  first.set('page:1:draft', 'keep', '');
  first.set('page:2:draft', 'close', '');
  const restored = new ProjectUiSession(first.scope);
  restored.set<string[]>('chat.history', entries => [...entries, 'second'], []);
  await restored.loaded;
  expect(restored.get('chat.history', [])).toEqual(['first', 'second']);
  restored.retainPages([1]);
  const next = new ProjectUiSession(first.scope);
  await next.loaded;
  expect(next.get('page:1:draft', '')).toBe('keep');
  expect(next.get('page:2:draft', '')).toBe('');
  expect(next.get('chat.history', [])).toEqual(['first', 'second']);
});

test('storage failures are reported while the live UI state remains usable', async () => {
  const session = new ProjectUiSession('failure:local:project');
  await session.loaded;
  const unsupported = { callback: () => {} };
  session.set('page:1:draft', unsupported, null);
  expect(session.getStatus().ready).toBe(true);
  expect(session.getStatus().error instanceof Error).toBe(true);
  expect(session.get('page:1:draft', null)).toBe(unsupported);
  session.set('page:1:query', 'still usable', '');
  expect(session.get('page:1:query', '')).toBe('still usable');
});
