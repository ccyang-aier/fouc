import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createTRPCClient, httpLink } from '@trpc/client';
import { principal } from '@fouc/shared/knowledge/contracts';
import type { PermissionLevel } from '@fouc/shared/knowledge/contracts';
import {
  commentThreadSchema,
  commentThreadTransitionResultSchema,
  createCommentThreadResultSchema,
  replyCommentThreadResultSchema,
} from '@fouc/shared/knowledge/comments';
import { Pool } from 'pg';
import { blockIndex, page } from '../../database/knowledge/schema';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { createAuthTestServer, responseCookie, testPassword } from '../../knowledge/auth/auth-test-server';
import type { KnowledgeIdentity } from '../../knowledge/auth/identity';
import { createOrganizationService } from '../../knowledge/organization/service';
import { teamspacePermissionInvalidator } from '../../knowledge/permissions/fence';
import { replaceAuthorizedPageAcl, withAuthorizedPageTreeMutation } from '../../knowledge/permissions/mutations';
import { createPermissionRebuildConsumer } from '../../knowledge/permissions/rebuild';
import type { RunningRole } from '../../knowledge/runtime/lifecycle';
import { initializeKnowledgeJobs } from '../../knowledge/workers/initialize';
import { startKnowledgeWorker } from '../../knowledge/workers/runner';
import { createKnowledgeApiRoutes } from './http';
import { knowledgeCommentRouterRecord } from './comment-routes';
import { createKnowledgeRouter } from './procedures';

/**
 * The `comment.*` procedures over the real HTTP boundary: real session
 * credentials, the real RLS tenant transactions and the real N01 service, with
 * the router record mounted through the same `createKnowledgeApiRoutes`
 * factory the live listener will use (`comment: knowledgeCommentRouterRecord`
 * inside `createKnowledgeRouter`). A dedicated real HTTP server keeps the
 * canonical `/api/knowledge/:workspaceId/trpc` path.
 */

const commentRouter = createKnowledgeRouter({ comment: knowledgeCommentRouterRecord });
type CommentRouter = typeof commentRouter;

interface Actor { cookie: string; identity: KnowledgeIdentity }
interface PageRef { workspaceId: string; pageId: string }

async function createCommentRoutesFixture() {
  let apiServer!: Server;
  let pool!: Pool;
  let admin!: { query: (sql: string, values?: unknown[]) => Promise<{ rowCount: number | null }> };
  let webOrigin = '';
  const runners = new Set<RunningRole>();

  const server = await createAuthTestServer({ mount(app, { auth, database }) {
    admin = database.admin as typeof admin;
    pool = new Pool({ ...database.pool.options, max: 4 });
    const api = createKnowledgeApiRoutes({ auth, pool, router: commentRouter });
    apiServer = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) for (const item of value) headers.append(key, item);
          else if (value !== undefined) headers.set(key, value);
        }
        const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
        const delivered = await api.fetch(new Request(url.toString(), { method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined, duplex: 'half' }));
        response.writeHead(delivered.status, Object.fromEntries(delivered.headers));
        response.end(Buffer.from(await delivered.arrayBuffer()));
      } catch (error) {
        response.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    });
    apiServer.listen(0, '127.0.0.1');
    void app;
  } });
  webOrigin = server.webOrigin;

  async function actor(name: string): Promise<Actor> {
    const email = `${name}@comment-routes.test`;
    const signup = await server.request('/sign-up/email', { email, name, password: testPassword });
    expect(signup.status).toBe(200);
    expect((await server.request(server.verificationPath(email))).status).toBe(302);
    const signed = await server.request('/sign-in/email', { email, password: testPassword });
    expect(signed.status).toBe(200);
    const cookie = responseCookie(signed);
    const identity = await (await fetch(`${server.origin}/test/identity`, { headers: { cookie } })).json() as KnowledgeIdentity;
    return { cookie, identity };
  }

  const owner = await actor('owner');
  const reader = await actor('reader');
  const foreign = await actor('foreign');
  const workspaceId = randomUUID();
  await admin.query("INSERT INTO knowledge.workspace(workspace_id,name,kind) VALUES ($1,'Comment Routes','team')", [workspaceId]);
  await admin.query("INSERT INTO knowledge.member(workspace_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'member')", [workspaceId, owner.identity.userId, reader.identity.userId]);
  await initializeKnowledgeJobs(admin as never, pool);
  const organization = createOrganizationService(pool, { permissions: teamspacePermissionInvalidator });

  async function jobCount(): Promise<number> {
    return (await admin.query('SELECT j.id FROM knowledge_jobs._private_jobs j')).rowCount ?? 0;
  }
  async function drain() {
    const runner = await startKnowledgeWorker({ pool, consumers: [createPermissionRebuildConsumer(pool)], concurrency: 2, pollIntervalMs: 20, shutdownAbortAfterMs: 100 });
    runners.add(runner);
    try {
      let last = -1;
      let stableSince = Date.now();
      // acl.changed dispatches are consumed by the rebuild consumer; the
      // comment writes' workspace.event dispatches have no consumer in this
      // fixture (the B06 broadcaster lives in the collaboration suite), so a
      // stable nonzero remainder of exactly those is cleared, never anything
      // the rebuild consumer should have made progress on.
      for (;;) {
        const count = await jobCount();
        if (count === 0) break;
        if (count !== last) {
          last = count;
          stableSince = Date.now();
        } else if (Date.now() - stableSince > 1_500) {
          await admin.query(`DELETE FROM knowledge_jobs._private_jobs j
            USING knowledge.outbox o, knowledge_jobs._private_tasks t
            WHERE t.id = j.task_id AND t.identifier='knowledge.dispatch'
              AND (j.payload->>'outboxId')::uuid = o.id AND o.topic='workspace.event'`);
          if ((await jobCount()) === 0) break;
          stableSince = Date.now();
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      await runner.close();
      runners.delete(runner);
    }
  }

  /** A one-page teamspace subtree whose default access is the given level. */
  async function tree(defaultAccess: PermissionLevel): Promise<PageRef> {
    const space = await organization.createTeamspace(owner.identity, { workspaceId, name: `Comment tree ${defaultAccess}`, defaultAccess });
    const pageId = randomUUID();
    await withKnowledgeTenant(pool, workspaceId, (db) => withAuthorizedPageTreeMutation(db, { workspaceId, pageId }, async () => {
      await db.insert(page).values({ workspaceId, id: pageId, parentId: null, path: pageId.replaceAll('-', '_'), teamspaceId: space.id, position: 'a0', createdBy: owner.identity.userId, inheritsPermissions: true, deletedAt: null });
      await db.insert(blockIndex).values({ workspaceId, pageId, blockId: 'text', blockType: 'paragraph', contentMd: 'Comment routes content', contentHash: 'b'.repeat(64) });
    }));
    await drain();
    return { workspaceId, pageId };
  }

  /** Replaces the root ACL and waits for the subtree rematerialization. */
  async function grantRootDefault(root: PageRef, grants: { principal: string; level: PermissionLevel }[]): Promise<void> {
    await withKnowledgeTenant(pool, workspaceId, (db) => replaceAuthorizedPageAcl(db, { workspaceId, pageId: root.pageId, grants }));
    await drain();
  }

  /**
   * Comment writes queue `workspace.event` dispatch jobs this fixture has no
   * consumer for (the B06 broadcaster belongs to the collaboration suite);
   * dropping them between tests keeps later drains meaningful — same shape as
   * the N01 comment suite's `resetJobs`.
   */
  async function resetJobs(): Promise<void> {
    for (const runner of runners) {
      await runner.close();
      runners.delete(runner);
    }
    await admin.query('DELETE FROM knowledge_jobs._private_jobs; DELETE FROM knowledge.outbox');
  }

  return {
    origin: `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`,
    webOrigin,
    workspaceId,
    owner,
    reader,
    foreign,
    seed: async () => ({ commentPage: await tree('comment'), viewPage: await tree('view') }),
    grantRootDefault,
    resetJobs,
    async close() {
      for (const runner of runners) await runner.close();
      await new Promise<void>((resolve) => apiServer.close(() => resolve()));
      await pool.end();
      await server.close();
    },
  };
}

type CommentRoutesFixture = Awaited<ReturnType<typeof createCommentRoutesFixture>>;

describe('comment tRPC routes over the real HTTP boundary', () => {
  let fixture: CommentRoutesFixture;

  beforeAll(async () => {
    fixture = await createCommentRoutesFixture();
  });
  afterAll(async () => {
    await fixture.resetJobs();
    await fixture.close();
  });
  beforeEach(async () => {
    await fixture.resetJobs();
  });

  function client(actor?: Actor, targetWorkspace = fixture.workspaceId) {
    // Cookie-authenticated POSTs must carry the trusted web origin (CSRF rule).
    const headers: Record<string, string> = { origin: fixture.webOrigin, ...(actor ? { cookie: actor.cookie } : {}) };
    return createTRPCClient<CommentRouter>({
      links: [httpLink({ url: `${fixture.origin}/api/knowledge/${targetWorkspace}/trpc`, headers })],
    });
  }

  test('full wire lifecycle: create with client ids, reply chain, resolve/reopen, delete', async () => {
    const { commentPage: scope } = await fixture.seed();
    const ownerClient = client(fixture.owner);
    const readerClient = client(fixture.reader);

    // Creation carries the client thread/comment ids the CRDT anchor already binds.
    const threadId = randomUUID();
    const commentId = randomUUID();
    const created = await ownerClient.comment.create.mutate({
      workspaceId: scope.workspaceId, pageId: scope.pageId, threadId, commentId, bodyMd: '  Anchored observation  ', mentions: [],
    });
    expect(createCommentThreadResultSchema.parse(created)).toEqual(created);
    expect(created.existing).toBe(false);
    expect(created.thread).toMatchObject({ id: threadId, pageId: scope.pageId, status: 'open' });
    expect(created.comment).toMatchObject({ id: commentId, threadId, authorId: fixture.owner.identity.userId, bodyMd: 'Anchored observation' });
    expect(created.notified).toEqual([]);

    // The retry of a lost response replays the exact same ids over the wire.
    const retried = await ownerClient.comment.create.mutate({
      workspaceId: scope.workspaceId, pageId: scope.pageId, threadId, commentId, bodyMd: 'Anchored observation', mentions: [],
    });
    expect(retried.existing).toBe(true);
    expect(retried.thread.id).toBe(threadId);

    const reply = await readerClient.comment.reply.mutate({
      workspaceId: scope.workspaceId, threadId, bodyMd: 'Reply one', mentions: [],
    });
    expect(replyCommentThreadResultSchema.parse(reply)).toEqual(reply);
    expect(reply.notified).toEqual([fixture.owner.identity.userId]);

    // The list joins threads with their reply chains and parses as the strict wire contract.
    const listed = await readerClient.comment.list.query({ workspaceId: scope.workspaceId, pageId: scope.pageId });
    expect(listed.map((thread) => commentThreadSchema.parse(thread))).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: threadId, status: 'open' });
    expect(listed[0]!.comments.map((entry) => entry.bodyMd)).toEqual(['Anchored observation', 'Reply one']);
    expect(listed[0]!.comments.map((entry) => entry.authorId)).toEqual([fixture.owner.identity.userId, fixture.reader.identity.userId]);

    const resolved = await readerClient.comment.resolve.mutate({ workspaceId: scope.workspaceId, threadId });
    expect(commentThreadTransitionResultSchema.parse(resolved)).toEqual(resolved);
    expect(resolved).toMatchObject({ changed: true, thread: { status: 'resolved' } });
    // Re-applying is the documented idempotent no-op.
    expect(await readerClient.comment.resolve.mutate({ workspaceId: scope.workspaceId, threadId })).toMatchObject({ changed: false });

    // Replying to a resolved thread arrives as CONFLICT, the sidebar's reopen cue.
    await expect(readerClient.comment.reply.mutate({ workspaceId: scope.workspaceId, threadId, bodyMd: 'While resolved', mentions: [] }))
      .rejects.toMatchObject({ data: { code: 'CONFLICT' } });
    expect(await readerClient.comment.reopen.mutate({ workspaceId: scope.workspaceId, threadId })).toMatchObject({ changed: true, thread: { status: 'open' } });

    // Deleting the other author's comment is FORBIDDEN over the wire.
    await expect(ownerClient.comment.delete.mutate({ workspaceId: scope.workspaceId, commentId: reply.comment.id }))
      .rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });

    const removedReply = await readerClient.comment.delete.mutate({ workspaceId: scope.workspaceId, commentId: reply.comment.id });
    expect(removedReply).toEqual({ threadDeleted: false });
    const removedRoot = await ownerClient.comment.delete.mutate({ workspaceId: scope.workspaceId, commentId });
    expect(removedRoot).toEqual({ threadDeleted: true });
    expect(await ownerClient.comment.list.query(scope)).toEqual([]);
  });

  test('the page ACL gates each procedure: view reads, comment writes, strangers nothing', async () => {
    const { viewPage: scope } = await fixture.seed();
    const readerClient = client(fixture.reader);
    await expect(readerClient.comment.list.query(scope)).resolves.toEqual([]);
    await expect(readerClient.comment.create.mutate({
      workspaceId: scope.workspaceId, pageId: scope.pageId, threadId: randomUUID(), commentId: randomUUID(), bodyMd: 'View cannot comment', mentions: [],
    })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });

    // A non-member cannot even establish a workspace credential here.
    await expect(client(fixture.foreign).comment.list.query(scope))
      .rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });

    // No credential at all is UNAUTHORIZED before any tenant work.
    await expect(client().comment.list.query(scope))
      .rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
  });

  test('unknown threads and invalid input map to NOT_FOUND / BAD_REQUEST', async () => {
    const { commentPage: scope } = await fixture.seed();
    const ownerClient = client(fixture.owner);

    await expect(ownerClient.comment.reply.mutate({
      workspaceId: scope.workspaceId, threadId: randomUUID(), bodyMd: 'Ghost', mentions: [],
    })).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } });

    // The strict input contract rejects a blank body before any SQL runs.
    await expect(ownerClient.comment.create.mutate({
      workspaceId: scope.workspaceId, pageId: scope.pageId, threadId: randomUUID(), commentId: randomUUID(), bodyMd: '   ', mentions: [],
    })).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
  });

  test('acl hardening: a revoked comment level fails closed on the next call', async () => {
    const { viewPage: scope } = await fixture.seed();
    const ownerClient = client(fixture.owner);
    const readerClient = client(fixture.reader);

    // Default view cannot comment; an explicit user grant lifts the reader.
    await expect(readerClient.comment.create.mutate({
      workspaceId: scope.workspaceId, pageId: scope.pageId, threadId: randomUUID(), commentId: randomUUID(), bodyMd: 'Before grant', mentions: [],
    })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    await fixture.grantRootDefault(scope, [
      { principal: principal('user', fixture.owner.identity.userId), level: 'full' },
      { principal: principal('user', fixture.reader.identity.userId), level: 'comment' },
    ]);
    const created = await ownerClient.comment.create.mutate({
      workspaceId: scope.workspaceId, pageId: scope.pageId, threadId: randomUUID(), commentId: randomUUID(), bodyMd: 'After grant', mentions: [],
    });
    await expect(readerClient.comment.reply.mutate({ workspaceId: scope.workspaceId, threadId: created.thread.id, bodyMd: 'Allowed', mentions: [] }))
      .resolves.toMatchObject({ comment: { bodyMd: 'Allowed' } });

    // The replaced ACL drops the reader's grant: the very next reply fails closed.
    await fixture.grantRootDefault(scope, [
      { principal: principal('user', fixture.owner.identity.userId), level: 'full' },
    ]);
    await expect(readerClient.comment.reply.mutate({ workspaceId: scope.workspaceId, threadId: created.thread.id, bodyMd: 'After revocation', mentions: [] }))
      .rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    // Reading survives at the default view level.
    await expect(readerClient.comment.list.query(scope)).resolves.toHaveLength(1);
  });
});
