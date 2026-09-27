import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { principal } from '@fouc/shared/knowledge/contracts';
import type { PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { comment, commentThread, notification } from '../../../platform/database/knowledge/schema';
import { withKnowledgeTenant } from '../../../platform/database/knowledge/tenant';
import { responseCookie, testPassword } from '../../../platform/identity/auth-test-server';
import type { FoucIdentity } from '../../../platform/identity/identity';
import { replaceAuthorizedPageAcl } from '../permissions/mutations';
import { createPermissionsFixture, type PermissionsFixture } from '../permissions/permissions-test-fixture';
import type { CommentErrorCode } from './errors';
import {
  createCommentThread,
  deleteCommentThreadAsAdmin,
  deleteOwnComment,
  reopenCommentThread,
  replyCommentThread,
  resolveCommentThread,
} from './mutations';
import { listPageCommentThreads } from './queries';

interface WorkspaceEventView { topic: string; event: { type: string; threadId?: string; pageId?: string; userId?: string; notificationId?: string } | null }

/** Real HTTP identities, a real organization, the real queue and the ordinary RLS role. */
describe('comment thread persistence and permissions', () => {
  let fixture: PermissionsFixture;

  beforeAll(async () => {
    fixture = await createPermissionsFixture();
  });
  afterAll(async () => {
    expect(fixture.errors).toEqual([]);
    await fixture.close();
  });
  beforeEach(async () => {
    await fixture.resetJobs();
  });

  async function grant(node: { workspaceId: string; pageId: string }, grants: { principal: string; level: PermissionLevel }[]) {
    await withKnowledgeTenant(fixture.pool, node.workspaceId, (db) =>
      replaceAuthorizedPageAcl(db, { workspaceId: node.workspaceId, pageId: node.pageId, grants }));
    await fixture.drain();
  }

  async function expectCode(run: () => Promise<unknown>, code: CommentErrorCode) {
    await expect(run()).rejects.toMatchObject({ code });
  }

  /** An extra real member used to prove notification recipient filtering. */
  async function invite(name: string): Promise<FoucIdentity> {
    const email = `${name}@comments.test`;
    const signup = await fixture.server.request('/sign-up/email', { email, name, password: testPassword });
    expect(signup.status).toBe(200);
    expect((await fixture.server.request(fixture.server.verificationPath(email))).status).toBe(302);
    const signed = await fixture.server.request('/sign-in/email', { email, password: testPassword });
    expect(signed.status).toBe(200);
    const identity = await (await fetch(`${fixture.server.origin}/test/identity`, { headers: { cookie: responseCookie(signed) } })).json() as FoucIdentity;
    const invitation = await fixture.organization.createInvitation(fixture.owner.identity, { workspaceId: fixture.alpha.id, email, role: 'member' });
    await fixture.organization.acceptInvitation(identity, { workspaceId: fixture.alpha.id, invitationId: invitation.invitation.id, token: invitation.token });
    return identity;
  }

  async function notificationsFor(pageId: string) {
    const rows = await fixture.admin.query<{ id: string; user_id: string; page_id: string; kind: string; payload: { threadId: string; commentId: string; actorId: string } }>(
      'SELECT id::text, user_id::text, page_id::text, kind, payload FROM knowledge.notification WHERE workspace_id=$1 AND page_id=$2 ORDER BY created_at, id',
      [fixture.alpha.id, pageId]);
    return rows.rows;
  }

  async function workspaceEvents(workspaceId: string): Promise<WorkspaceEventView[]> {
    const rows = await fixture.admin.query<{ topic: string; payload: { event?: WorkspaceEventView['event'] } }>(
      'SELECT topic::text AS topic, payload FROM knowledge.outbox WHERE workspace_id=$1 ORDER BY created_at, id', [workspaceId]);
    return rows.rows.map((row) => ({ topic: row.topic, event: row.payload.event ?? null }));
  }

  /** Everything a comment operation may leave behind, scoped to this page and thread. */
  async function residue(pageId: string, threadId: string) {
    const result = await fixture.admin.query<{ comments: string; notifications: string; outbox: string; jobs: string }>(`
      SELECT (SELECT count(*) FROM knowledge.comment WHERE workspace_id=$1 AND thread_id=$3::uuid)::text AS comments,
             (SELECT count(*) FROM knowledge.notification WHERE workspace_id=$1 AND page_id=$2::uuid)::text AS notifications,
             (SELECT count(*) FROM knowledge.outbox WHERE workspace_id=$1 AND (payload->'event'->>'threadId'=$3::text
                OR payload->'event'->>'notificationId' IN (SELECT id::text FROM knowledge.notification WHERE workspace_id=$1 AND page_id=$2::uuid)))::text AS outbox,
             (SELECT count(*) FROM knowledge_jobs._private_jobs)::text AS jobs`,
      [fixture.alpha.id, pageId, threadId]);
    return result.rows[0];
  }

  test('full lifecycle: creation, ordered replies, resolve/reopen state machine, deletions', async () => {
    const { pages } = await fixture.tree();
    const scope = { workspaceId: fixture.alpha.id, pageId: pages[1].pageId };
    const owner = fixture.owner.identity.userId;
    const reader = fixture.reader.identity.userId;
    await grant(pages[0], [
      { principal: principal('user', owner), level: 'full' },
      { principal: principal('user', reader), level: 'comment' },
    ]);

    const created = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: '  First observation  ',
    }));
    expect(created.thread).toMatchObject({ status: 'open', pageId: scope.pageId, workspaceId: scope.workspaceId });
    expect(created.comment).toMatchObject({ bodyMd: 'First observation', authorId: owner, threadId: created.thread.id });
    expect(created.notified).toEqual([]);

    const reply = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader, bodyMd: 'Reply one',
    }));
    expect(reply.thread.status).toBe('open');
    expect(reply.notified).toEqual([owner]);

    const resolved = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => resolveCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader,
    }));
    expect(resolved).toMatchObject({ changed: true, thread: { status: 'resolved' } });

    // Resolved threads refuse replies; reopening is the explicit way back to open.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader, bodyMd: 'While resolved',
    })), 'COMMENT_THREAD_RESOLVED');
    const reopened = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => reopenCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader,
    }));
    expect(reopened).toMatchObject({ changed: true, thread: { status: 'open' } });
    const second = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader, bodyMd: 'Reply two',
    }));
    // Re-applying the current status is an idempotent no-op.
    const noop = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => reopenCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader,
    }));
    expect(noop).toMatchObject({ changed: false, thread: { status: 'open' } });

    const listed = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, { ...scope, userId: reader }));
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: created.thread.id, status: 'open' });
    expect(listed[0].comments.map((entry) => entry.bodyMd)).toEqual(['First observation', 'Reply one', 'Reply two']);
    expect(listed[0].comments.map((entry) => entry.authorId)).toEqual([owner, reader, reader]);

    // Authors remove their own comments; removing someone else's is denied.
    const removedLast = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteOwnComment(db, {
      workspaceId: scope.workspaceId, commentId: second.comment.id, userId: reader,
    }));
    expect(removedLast.threadDeleted).toBe(false);
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteOwnComment(db, {
      workspaceId: scope.workspaceId, commentId: created.comment.id, userId: reader,
    })), 'COMMENT_ACCESS_DENIED');
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteOwnComment(db, {
      workspaceId: scope.workspaceId, commentId: created.comment.id, userId: owner,
    }));
    // Plain members cannot delete whole threads; workspace owners can.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteCommentThreadAsAdmin(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: reader,
    })), 'COMMENT_ACCESS_DENIED');
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteCommentThreadAsAdmin(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: owner,
    }));
    expect(await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, { ...scope, userId: owner }))).toEqual([]);
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: created.thread.id, userId: owner, bodyMd: 'Gone',
    })), 'COMMENT_THREAD_NOT_FOUND');

    // A thread whose last comment is deleted disappears with it.
    const solo = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: 'Solo',
    }));
    const soloRemoved = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteOwnComment(db, {
      workspaceId: scope.workspaceId, commentId: solo.comment.id, userId: owner,
    }));
    expect(soloRemoved.threadDeleted).toBe(true);
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => resolveCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: solo.thread.id, userId: owner,
    })), 'COMMENT_THREAD_NOT_FOUND');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: randomUUID(), userId: owner, bodyMd: 'Missing thread',
    })), 'COMMENT_THREAD_NOT_FOUND');
  });

  test('view level is read-only: reads pass and every write path is denied', async () => {
    const { pages } = await fixture.tree();
    const scope = { workspaceId: fixture.alpha.id, pageId: pages[1].pageId };
    const owner = fixture.owner.identity.userId;
    const reader = fixture.reader.identity.userId;
    await grant(pages[0], [{ principal: principal('user', owner), level: 'full' }]);
    const { thread } = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: 'Viewers see this',
    }));

    expect(await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, { ...scope, userId: reader }))).toHaveLength(1);
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: reader, bodyMd: 'No writes',
    })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: reader, bodyMd: 'No replies',
    })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => resolveCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: reader,
    })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => reopenCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: reader,
    })), 'COMMENT_ACCESS_DENIED');

    // Non-members cannot even read; missing pages deny identically.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, {
      ...scope, userId: fixture.foreign.identity.userId,
    })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, {
      workspaceId: scope.workspaceId, pageId: randomUUID(), userId: owner,
    })), 'COMMENT_ACCESS_DENIED');
    // Strict inputs: blank bodies and duplicate mentions never reach the database.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: '   ',
    })), 'INVALID_COMMENT_INPUT');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: 'x', mentions: [reader, reader],
    })), 'INVALID_COMMENT_INPUT');
  });

  test('comment, edit and full levels each permit the whole write lifecycle', async () => {
    const { pages } = await fixture.tree({ defaultAccess: null });
    const reader = fixture.reader.identity.userId;
    // All ACL grants and rebuild drains happen before any comment event exists:
    // the fixture's worker registers no workspace.event consumer yet, so draining
    // afterwards would retry forever by design.
    await grant(pages[0], [
      { principal: principal('user', fixture.owner.identity.userId), level: 'full' },
      { principal: principal('user', reader), level: 'comment' },
    ]);
    await grant(pages[1], [{ principal: principal('user', reader), level: 'edit' }]);
    await grant(pages[3], [{ principal: principal('user', reader), level: 'full' }]);

    // comment level on the root grant
    const atComment = await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => createCommentThread(db, {
      workspaceId: fixture.alpha.id, pageId: pages[0].pageId, userId: reader, bodyMd: 'Comment level',
    }));
    await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => resolveCommentThread(db, {
      workspaceId: fixture.alpha.id, threadId: atComment.thread.id, userId: reader,
    }));
    await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => reopenCommentThread(db, {
      workspaceId: fixture.alpha.id, threadId: atComment.thread.id, userId: reader,
    }));
    await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => replyCommentThread(db, {
      workspaceId: fixture.alpha.id, threadId: atComment.thread.id, userId: reader, bodyMd: 'Still comment level',
    }));

    // edit level inherited on the deeper subtree
    const atEdit = await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => createCommentThread(db, {
      workspaceId: fixture.alpha.id, pageId: pages[2].pageId, userId: reader, bodyMd: 'Edit level',
    }));
    await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => resolveCommentThread(db, {
      workspaceId: fixture.alpha.id, threadId: atEdit.thread.id, userId: reader,
    }));

    // full level on the explicit leaf grant
    const atFull = await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => createCommentThread(db, {
      workspaceId: fixture.alpha.id, pageId: pages[3].pageId, userId: reader, bodyMd: 'Full level',
    }));
    expect(atFull.thread.pageId).toBe(pages[3].pageId);
  });

  test('threads on recycled pages are inaccessible until the page is restored', async () => {
    const { pages } = await fixture.tree();
    const scope = { workspaceId: fixture.alpha.id, pageId: pages[2].pageId };
    const owner = fixture.owner.identity.userId;
    const reader = fixture.reader.identity.userId;
    await grant(pages[0], [
      { principal: principal('user', owner), level: 'full' },
      { principal: principal('user', reader), level: 'comment' },
    ]);
    const { thread, comment: entry } = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: 'Before recycle',
    }));

    await fixture.admin.query('UPDATE knowledge.page SET deleted_at=now() WHERE workspace_id=$1 AND id=$2', [scope.workspaceId, scope.pageId]);
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, { ...scope, userId: owner })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: owner, bodyMd: 'No',
    })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => resolveCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: owner,
    })), 'COMMENT_ACCESS_DENIED');
    // Even the author and workspace admins are locked out of recycled pages.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteOwnComment(db, {
      workspaceId: scope.workspaceId, commentId: entry.id, userId: owner,
    })), 'COMMENT_ACCESS_DENIED');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => deleteCommentThreadAsAdmin(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: owner,
    })), 'COMMENT_ACCESS_DENIED');

    await fixture.admin.query('UPDATE knowledge.page SET deleted_at=null WHERE workspace_id=$1 AND id=$2', [scope.workspaceId, scope.pageId]);
    const restored = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: reader, bodyMd: 'After restore',
    }));
    expect(restored.thread.status).toBe('open');
  });

  test('replies and mentions notify only viewing members, atomically with the business write', async () => {
    const ghost = await invite('ghost');
    const { pages } = await fixture.tree({ defaultAccess: null });
    const scope = { workspaceId: fixture.alpha.id, pageId: pages[1].pageId };
    const owner = fixture.owner.identity.userId;
    const reader = fixture.reader.identity.userId;
    await grant(pages[0], [
      { principal: principal('user', owner), level: 'full' },
      { principal: principal('user', reader), level: 'comment' },
    ]);

    // Mentions of a member without page access and of a non-member notify nobody.
    const { thread } = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: 'Root comment', mentions: [ghost.userId, fixture.foreign.identity.userId],
    }));
    expect(await notificationsFor(scope.pageId)).toEqual([]);

    const reply = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: reader, bodyMd: 'Mentioning the author',
      mentions: [owner, ghost.userId, fixture.foreign.identity.userId],
    }));
    expect(reply.notified).toEqual([owner]);

    const rows = await notificationsFor(scope.pageId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: owner, page_id: scope.pageId, kind: 'comment.mention' });
    expect(rows[0].payload).toEqual({ threadId: thread.id, commentId: reply.comment.id, actorId: reader });

    // One transaction, three artefacts: two thread events and one notification event.
    const events = await workspaceEvents(scope.workspaceId);
    expect(events.filter((event) => event.event?.type === 'comment.changed' && event.event.threadId === thread.id)).toHaveLength(2);
    const noticeEvents = events.filter((event) => event.event?.type === 'notification.created');
    expect(noticeEvents).toHaveLength(1);
    expect(noticeEvents[0].event).toMatchObject({ userId: owner, notificationId: rows[0].id });

    // A failure after the service wrote leaves no comment, notification or outbox residue.
    class LateFailure extends Error {}
    const before = await residue(scope.pageId, thread.id);
    await expect(withKnowledgeTenant(fixture.pool, scope.workspaceId, async (db) => {
      const result = await replyCommentThread(db, {
        workspaceId: scope.workspaceId, threadId: thread.id, userId: owner, bodyMd: 'Rolled back',
      });
      expect(result.notified).toEqual([reader]);
      throw new LateFailure();
    })).rejects.toBeInstanceOf(LateFailure);
    expect(await residue(scope.pageId, thread.id)).toEqual(before);

    // Invalid input never writes anything either.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: owner, bodyMd: '',
    })), 'INVALID_COMMENT_INPUT');
    expect(await residue(scope.pageId, thread.id)).toEqual(before);
  });

  test('tenant isolation: cross-workspace thread ids cannot be interacted with', async () => {
    const { pages } = await fixture.tree();
    const scope = { workspaceId: fixture.alpha.id, pageId: pages[1].pageId };
    const owner = fixture.owner.identity.userId;
    const foreign = fixture.foreign.identity.userId;
    await grant(pages[0], [{ principal: principal('user', owner), level: 'full' }]);
    const { thread, comment: entry } = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThread(db, {
      ...scope, userId: owner, bodyMd: 'Alpha only',
    }));

    // Beta's owner is an admin there, yet alpha thread ids do not resolve in beta's tenant.
    await expectCode(() => withKnowledgeTenant(fixture.pool, fixture.beta.id, (db) => replyCommentThread(db, {
      workspaceId: fixture.beta.id, threadId: thread.id, userId: foreign, bodyMd: 'Cross tenant',
    })), 'COMMENT_THREAD_NOT_FOUND');
    await expectCode(() => withKnowledgeTenant(fixture.pool, fixture.beta.id, (db) => deleteCommentThreadAsAdmin(db, {
      workspaceId: fixture.beta.id, threadId: thread.id, userId: foreign,
    })), 'COMMENT_THREAD_NOT_FOUND');
    await expectCode(() => withKnowledgeTenant(fixture.pool, fixture.beta.id, (db) => listPageCommentThreads(db, {
      workspaceId: fixture.beta.id, pageId: scope.pageId, userId: foreign,
    })), 'COMMENT_ACCESS_DENIED');

    // RLS hides alpha's rows from beta transactions entirely.
    expect(await withKnowledgeTenant(fixture.pool, fixture.beta.id, async (db) => ({
      threads: await db.select().from(commentThread).where(eq(commentThread.id, thread.id)),
      comments: await db.select().from(comment).where(eq(comment.id, entry.id)),
      notifications: await db.select().from(notification).where(eq(notification.pageId, scope.pageId)),
    }))).toEqual({ threads: [], comments: [], notifications: [] });

    // The same foreign user inside alpha's tenant is denied without a thread oracle.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId: thread.id, userId: foreign, bodyMd: 'Outsider',
    })), 'COMMENT_ACCESS_DENIED');
  });
});
