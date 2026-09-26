import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { WebSocket as NodeWebSocket } from 'ws';
import type { AuthorizedScope } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { principal } from '@fouc/shared/knowledge/contracts';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { replaceAuthorizedPageAcl } from '../permissions/mutations';
import { createPermissionsFixture, until, type PermissionsFixture } from '../permissions/permissions-test-fixture';
import { pageDocumentName } from './page-documents';
import { createPageCollaborationListener } from './page-collaboration-bun';
import type { PageCollaborationListener } from './page-collaboration-bun';

/** Official protocol client against the real Bun-sidecar listener assembly. */
class HeaderWebSocket extends NodeWebSocket {
  constructor(url: string, protocols?: string[]) {
    super(url, protocols, { headers: HeaderWebSocket.headers, maxPayload: 8 * 1024 * 1024 });
  }
  static headers: Record<string, string> = {};
}

interface ClientHandle {
  provider: HocuspocusProvider;
  document: Y.Doc;
  scope(): AuthorizedScope | undefined;
  failure(): string | undefined;
  synced(): boolean;
  destroy(): Promise<void>;
}

let listener: PageCollaborationListener;
let serverWebOrigin: string;

function connect(name: string, authorization?: string): ClientHandle {
  const headers: Record<string, string> = { origin: serverWebOrigin };
  if (authorization?.startsWith('Bearer ')) headers.authorization = authorization;
  else if (authorization) headers.cookie = authorization;
  HeaderWebSocket.headers = headers;
  const document = new Y.Doc();
  const state = { scope: undefined as AuthorizedScope | undefined, failure: undefined as string | undefined, synced: false };
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${listener.port}`,
    name,
    document,
    WebSocketPolyfill: HeaderWebSocket,
    maxAttempts: 1,
    delay: 0,
    minDelay: 0,
    jitter: false,
    onAuthenticated: ({ scope }: { scope: AuthorizedScope }) => { state.scope = scope; },
    onAuthenticationFailed: ({ reason }: { reason: string }) => { state.failure = reason; },
    onSynced: ({ state: value }: { state: boolean }) => { state.synced = value; },
  } as never);
  return {
    provider, document,
    scope: () => state.scope,
    failure: () => state.failure,
    synced: () => state.synced,
    async destroy() {
      provider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 30));
    },
  };
}

describe('authenticated page collaboration websocket boundary', () => {
  let fixture: PermissionsFixture;

  beforeAll(async () => {
    fixture = await createPermissionsFixture();
    listener = createPageCollaborationListener({ authenticator: fixture.authenticator, pool: fixture.pool });
    serverWebOrigin = fixture.server.webOrigin;
  });
  afterAll(async () => {
    expect(fixture.errors).toEqual([]);
    await listener.close();
    await fixture.close();
  });
  beforeEach(async () => {
    await fixture.resetJobs();
  });

  async function grant(node: { workspaceId: string; pageId: string }, grants: { principal: string; level: 'view' | 'comment' | 'edit' | 'full' }[]) {
    return withKnowledgeTenant(fixture.pool, node.workspaceId, (db) => replaceAuthorizedPageAcl(db, { workspaceId: node.workspaceId, pageId: node.pageId, grants }));
  }

  test('an edit-level session reads and writes; a second client converges', async () => {
    const { pages } = await fixture.tree({ defaultAccess: null });
    await grant(pages[0], [{ principal: principal('user', fixture.reader.identity.userId), level: 'edit' }]);
    await fixture.drain();

    const name = pageDocumentName({ workspaceId: fixture.alpha.id, pageId: pages[1].pageId });
    const writer = connect(name, fixture.reader.cookie);
    await until(async () => writer.scope() !== undefined && writer.synced());
    expect(writer.scope()).toBe('read-write');

    writer.document.getText('content').insert(0, 'collaborative body');
    const reader = connect(name, fixture.reader.cookie);
    await until(async () => reader.document.getText('content').toString() === 'collaborative body');
    expect(reader.scope()).toBe('read-write');
    await writer.destroy();
    await reader.destroy();
  });

  test('view and comment connections sync read-only and their updates never land', async () => {
    const { pages } = await fixture.tree({ defaultAccess: null });
    await grant(pages[0], [
      { principal: principal('user', fixture.reader.identity.userId), level: 'view' },
      { principal: principal('user', fixture.owner.identity.userId), level: 'comment' },
    ]);
    await fixture.drain();
    const name = pageDocumentName({ workspaceId: fixture.alpha.id, pageId: pages[2].pageId });

    const viewer = connect(name, fixture.reader.cookie);
    await until(async () => viewer.scope() === 'readonly' && viewer.synced());
    viewer.document.getText('content').insert(0, 'must-not-land');

    const commenter = connect(name, fixture.owner.cookie);
    await until(async () => commenter.scope() === 'readonly' && commenter.synced());

    const auditor = connect(name, fixture.reader.cookie);
    await until(async () => auditor.synced());
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(auditor.document.getText('content').toString()).toBe('');
    await viewer.destroy();
    await commenter.destroy();
    await auditor.destroy();
  });

  test('unauthenticated, unauthorized, fenced and foreign pages all reject identically', async () => {
    const { pages } = await fixture.tree({ defaultAccess: null });
    await grant(pages[0], [{ principal: principal('user', fixture.reader.identity.userId), level: 'view' }]);
    await fixture.drain();

    const anonymous = connect(pageDocumentName({ workspaceId: fixture.alpha.id, pageId: pages[1].pageId }));
    const missing = connect(pageDocumentName({ workspaceId: fixture.alpha.id, pageId: crypto.randomUUID() }), fixture.reader.cookie);
    const foreignCookie = connect(pageDocumentName({ workspaceId: fixture.alpha.id, pageId: pages[1].pageId }), fixture.foreign.cookie);
    // A fenced subtree denies during the rebuild window exactly like a missing page.
    await grant(pages[0], [{ principal: principal('user', fixture.reader.identity.userId), level: 'edit' }]);
    const fenced = connect(pageDocumentName({ workspaceId: fixture.alpha.id, pageId: pages[3].pageId }), fixture.reader.cookie);

    await until(async () => Boolean(anonymous.failure() && missing.failure() && fenced.failure() && foreignCookie.failure()));
    const reasons = new Set([anonymous.failure(), missing.failure(), fenced.failure(), foreignCookie.failure()]);
    expect(reasons).toEqual(new Set(['permission-denied']));
    for (const client of [anonymous, missing, fenced, foreignCookie]) await client.destroy();
  });

  test('non-page document names and workspace channels are refused', async () => {
    for (const name of [`ws:${fixture.alpha.id}`, 'workspace', `page:${fixture.alpha.id}`, `page:${fixture.alpha.id}:not-a-uuid`]) {
      const client = connect(name, fixture.owner.cookie);
      await until(async () => client.failure() !== undefined);
      expect(client.failure()).toBe('permission-denied');
      await client.destroy();
    }
  });

  test('PAT credentials bind to their scopes: read stays read-only, read+write may edit', async () => {
    const { pages } = await fixture.tree({ defaultAccess: null });
    await grant(pages[0], [{ principal: principal('user', fixture.reader.identity.userId), level: 'edit' }]);
    await fixture.drain();
    const name = pageDocumentName({ workspaceId: fixture.alpha.id, pageId: pages[1].pageId });

    const readOnly = connect(name, await fixture.createToken(fixture.reader, ['read']));
    await until(async () => readOnly.scope() === 'readonly' && readOnly.synced());
    readOnly.document.getText('content').insert(0, 'pat-write-attempt');

    const readWrite = connect(name, await fixture.createToken(fixture.reader, ['read', 'write']));
    await until(async () => readWrite.scope() === 'read-write' && readWrite.synced());
    readWrite.document.getText('content').insert(0, 'pat-body');

    await until(async () => readWrite.document.getText('content').toString().includes('pat-body'));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(readWrite.document.getText('content').toString()).not.toContain('pat-write-attempt');
    await readOnly.destroy();
    await readWrite.destroy();
  });

  test('the host keeps Yjs garbage collection enabled', () => {
    expect(listener.hocuspocus.configuration.yDocOptions.gc).toBe(true);
  });
});
