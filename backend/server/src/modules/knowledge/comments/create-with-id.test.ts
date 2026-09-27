import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { principal } from '@fouc/shared/knowledge/contracts';
import { withKnowledgeTenant } from '../../../platform/database/knowledge/tenant';
import { createPermissionsFixture, type PermissionsFixture } from '../permissions/permissions-test-fixture';
import { replaceAuthorizedPageAcl } from '../permissions/mutations';
import type { CommentErrorCode } from './errors';
import { createCommentThreadWithId } from './create-with-id';
import { listPageCommentThreads } from './queries';
import { replyCommentThread } from './mutations';

async function expectCode(run: () => Promise<unknown>, code: CommentErrorCode) {
  await expect(run()).rejects.toMatchObject({ code });
}

/** The N02 client-id creation path: same lifecycle as N01 plus retry idempotency. */
describe('comment thread creation with client ids', () => {
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

  test('creates the thread under the client ids, integrates with the N01 lifecycle, and retries are idempotent', async () => {
    const { pages } = await fixture.tree();
    const scope = { workspaceId: fixture.alpha.id, pageId: pages[1].pageId };
    const owner = fixture.owner.identity.userId;
    const reader = fixture.reader.identity.userId;
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) =>
      replaceAuthorizedPageAcl(db, { workspaceId: scope.workspaceId, pageId: pages[0].pageId, grants: [
        { principal: principal('user', owner), level: 'full' },
        { principal: principal('user', reader), level: 'comment' },
      ] }));
    await fixture.drain();

    const threadId = randomUUID();
    const commentId = randomUUID();
    const created = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThreadWithId(db, {
      ...scope, userId: owner, threadId, commentId, bodyMd:  '  Anchored observation  ',
    }));
    expect(created.existing).toBe(false);
    expect(created.thread).toMatchObject({ id: threadId, pageId: scope.pageId, status: 'open' });
    expect(created.comment).toMatchObject({ id: commentId, threadId, authorId: owner, bodyMd: 'Anchored observation' });

    // The retry of a lost response replays the exact same ids and is a no-op.
    const retried = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThreadWithId(db, {
      ...scope, userId: owner, threadId, commentId, bodyMd: 'Anchored observation',
    }));
    expect(retried.existing).toBe(true);
    expect(retried.thread.id).toBe(threadId);
    expect(retried.comment.id).toBe(commentId);

    // The rest of the N01 lifecycle sees an ordinary thread.
    const reply = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => replyCommentThread(db, {
      workspaceId: scope.workspaceId, threadId, userId: reader, bodyMd: 'Works with replies',
    }));
    expect(reply.notified).toEqual([owner]);
    const listed = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, { ...scope, userId: reader }));
    expect(listed).toHaveLength(1);
    expect(listed[0].comments.map((entry) => entry.bodyMd)).toEqual(['Anchored observation', 'Works with replies']);

    // A different comment id under an existing thread is misuse, and so is a
    // thread id that already exists on another page: neither creates anything.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThreadWithId(db, {
      ...scope, userId: owner, threadId, commentId: randomUUID(), bodyMd: 'Forked',
    })), 'INVALID_COMMENT_INPUT');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThreadWithId(db, {
      workspaceId: scope.workspaceId, pageId: pages[2].pageId, userId: owner, threadId, commentId, bodyMd: 'Reused',
    })), 'INVALID_COMMENT_INPUT');

    // Strict inputs and the permission gate behave like createCommentThread.
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThreadWithId(db, {
      ...scope, userId: owner, threadId: randomUUID(), commentId: randomUUID(), bodyMd: '   ',
    })), 'INVALID_COMMENT_INPUT');
    await expectCode(() => withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => createCommentThreadWithId(db, {
      ...scope, userId: fixture.foreign.identity.userId, threadId: randomUUID(), commentId: randomUUID(), bodyMd: 'No access',
    })), 'COMMENT_ACCESS_DENIED');
    const afterMisuse = await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => listPageCommentThreads(db, { ...scope, userId: owner }));
    expect(afterMisuse).toHaveLength(1);
  });
});
