import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { and, asc, eq, sql } from 'drizzle-orm';
import * as Y from 'yjs';
import type { OutboxEvent, PageScope, Principal } from '@fouc/shared/knowledge/contracts';
import { backlink, docState, page } from '../../database/knowledge/schema';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { replaceAuthorizedPageAcl } from '../permissions/mutations';
import { createPermissionsFixture, until } from '../permissions/permissions-test-fixture';
import type { PermissionsFixture } from '../permissions/permissions-test-fixture';
import { createPermissionRebuildConsumer } from '../permissions/rebuild';
import type { RunningRole } from '../runtime/lifecycle';
import { appendKnowledgeOutbox } from '../workers/outbox';
import { startKnowledgeWorker } from '../workers/runner';
import type { KnowledgeConsumer, KnowledgeWorkerDiagnostic } from '../workers/types';
import { PAGE_BODY_FRAGMENT, countPageBacklinkRows, createBacklinkConsumer, extractPageBodyReferences, readPageBacklinks, readPageOutgoingReferences, refreshPageBacklinks } from './backlinks';

/** Real identities, real outbox queue, real tenant transactions. */
describe('page backlink derivation', () => {
  let fixture: PermissionsFixture;
  const runners = new Set<RunningRole>();

  beforeAll(async () => {
    fixture = await createPermissionsFixture();
  }, 60_000);
  afterAll(async () => {
    expect(fixture.errors).toEqual([]);
    for (const runner of runners) await runner.close();
    await fixture.close();
  }, 30_000);
  beforeEach(async () => {
    await fixture.resetJobs();
    await fixture.server.database.admin.query('DELETE FROM knowledge.backlink');
  });

  interface DraftLink { target?: string; targetBlockId?: string; pageId?: string }
  interface DraftBlock { blockId?: string; nodeName?: string; text?: string; links?: readonly DraftLink[] }

  /** Encoded exactly the way y-prosemirror stores a body in the default fragment. */
  function encodeBody(blocks: readonly DraftBlock[]) {
    const document = new Y.Doc();
    const fragment = document.getXmlFragment(PAGE_BODY_FRAGMENT);
    document.transact(() => {
      for (const block of blocks) {
        const element = new Y.XmlElement(block.nodeName ?? 'paragraph');
        if (block.blockId !== undefined) element.setAttribute('blockId', block.blockId);
        let at = 0;
        if (block.text) { const text = new Y.XmlText(); text.insert(0, block.text); element.insert(at++, [text]); }
        for (const link of block.links ?? []) {
          const anchor = new Y.XmlElement('wikiLink');
          if (link.target !== undefined) anchor.setAttribute('target', link.target);
          if (link.targetBlockId !== undefined) anchor.setAttribute('targetBlockId', link.targetBlockId);
          if (link.pageId !== undefined) anchor.setAttribute('pageId', link.pageId);
          element.insert(at++, [anchor]);
        }
        fragment.insert(fragment.length, [element]);
      }
    });
    return { state: Buffer.from(Y.encodeStateAsUpdate(document)), stateVector: Buffer.from(Y.encodeStateVector(document)) };
  }

  /** The same atomic commit onStoreDocument performs: state, vector, doc.changed. */
  async function writeBody(node: { workspaceId: string; pageId: string }, blocks: readonly DraftBlock[], userId = fixture.owner.identity.userId) {
    const scope = scopeOf(node);
    const { state, stateVector } = encodeBody(blocks);
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, async (db) => {
      await db.insert(docState).values({ ...scope, state, stateVector })
        .onConflictDoUpdate({ target: [docState.workspaceId, docState.pageId], set: { state, stateVector, updatedAt: sql`clock_timestamp()` } });
      const event: OutboxEvent = { workspaceId: scope.workspaceId, topic: 'doc.changed', pageId: scope.pageId, actor: { kind: 'human', userId }, occurredAt: new Date().toISOString() };
      await appendKnowledgeOutbox(db, event);
    });
  }

  async function writeCorruptBody(node: { workspaceId: string; pageId: string }) {
    const scope = scopeOf(node);
    const state = Buffer.from([0x02, 0xff, 0xff, 0xff]);
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, async (db) => {
      await db.insert(docState).values({ ...scope, state, stateVector: Buffer.alloc(0) })
        .onConflictDoUpdate({ target: [docState.workspaceId, docState.pageId], set: { state, stateVector: Buffer.alloc(0), updatedAt: sql`clock_timestamp()` } });
      const event: OutboxEvent = { workspaceId: scope.workspaceId, topic: 'doc.changed', pageId: scope.pageId, actor: { kind: 'human', userId: fixture.owner.identity.userId }, occurredAt: new Date().toISOString() };
      await appendKnowledgeOutbox(db, event);
    });
  }

  function consumers(): KnowledgeConsumer[] {
    return [createPermissionRebuildConsumer(fixture.pool), createBacklinkConsumer(fixture.pool)];
  }

  async function process(timeout = 15_000): Promise<KnowledgeWorkerDiagnostic[]> {
    const diagnostics: KnowledgeWorkerDiagnostic[] = [];
    const runner = await startKnowledgeWorker({
      pool: fixture.pool,
      consumers: consumers(),
      concurrency: 2, pollIntervalMs: 20, shutdownAbortAfterMs: 100,
      observer: (item) => diagnostics.push(item),
    });
    runners.add(runner);
    try {
      await until(async () => (await fixture.jobs()).length === 0, timeout);
    } finally {
      await runner.close();
      runners.delete(runner);
    }
    return diagnostics;
  }

  async function retitle(scope: PageScope, title: string) {
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) =>
      db.update(page).set({ title }).where(and(eq(page.workspaceId, scope.workspaceId), eq(page.id, scope.pageId))));
  }

  async function recycle(scope: PageScope) {
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) =>
      db.update(page).set({ deletedAt: new Date() }).where(and(eq(page.workspaceId, scope.workspaceId), eq(page.id, scope.pageId))));
  }

  async function grant(scope: PageScope, principalText: string, level: 'view' | 'comment' | 'edit' | 'full') {
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) =>
      replaceAuthorizedPageAcl(db, { workspaceId: scope.workspaceId, pageId: scope.pageId, grants: [{ principal: principalText, level }] }));
  }

  async function sourceRows(scope: PageScope) {
    return withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => db.select({ srcPageId: backlink.srcPageId, srcBlockId: backlink.srcBlockId, dstPageId: backlink.dstPageId, dstBlockId: backlink.dstBlockId })
      .from(backlink)
      .where(and(eq(backlink.workspaceId, scope.workspaceId), eq(backlink.srcPageId, scope.pageId)))
      .orderBy(asc(backlink.srcBlockId), asc(backlink.dstBlockId)));
  }

  /** tree() rows carry parent/path data; strict page scopes reject extra keys. */
  function scopeOf(node: { workspaceId: string; pageId: string }): PageScope {
    return { workspaceId: node.workspaceId, pageId: node.pageId };
  }

  function outgoing(node: { workspaceId: string; pageId: string }) {
    const scope = scopeOf(node);
    return withKnowledgeTenant(fixture.pool, scope.workspaceId, (db) => readPageOutgoingReferences(db, scope));
  }

  function incoming(node: { workspaceId: string; pageId: string }, principals: readonly Principal[]) {
    return withKnowledgeTenant(fixture.pool, node.workspaceId, (db) => readPageBacklinks(db, { workspaceId: node.workspaceId, pageId: node.pageId, principals }));
  }

  function subjects(userId: string) {
    return fixture.subjects(userId, fixture.alpha.id);
  }

  test('extractPageBodyReferences validates anchors, carriers and fragment boundaries', () => {
    const document = new Y.Doc();
    const fragment = document.getXmlFragment(PAGE_BODY_FRAGMENT);
    const orphan = new Y.XmlElement('paragraph');
    const plain = new Y.XmlElement('paragraph');
    plain.setAttribute('blockId', 'p1');
    const brokenAnchor = new Y.XmlElement('wikiLink');
    brokenAnchor.setAttribute('target', 'A');
    brokenAnchor.setAttribute('targetBlockId', 'bad#id');
    const brokenId = new Y.XmlElement('wikiLink');
    brokenId.setAttribute('target', 'B');
    brokenId.setAttribute('pageId', 'not-a-uuid');
    const bare = new Y.XmlElement('wikiLink');
    const quote = new Y.XmlElement('blockquote');
    quote.setAttribute('blockId', 'q1');
    const nested = new Y.XmlElement('paragraph');
    const nestedLink = new Y.XmlElement('wikiLink');
    nestedLink.setAttribute('target', 'C');
    document.transact(() => {
      orphan.insert(0, [new Y.XmlElement('wikiLink')]);
      plain.insert(0, [brokenAnchor, brokenId, bare]);
      nested.insert(0, [nestedLink]);
      quote.insert(0, [nested]);
      fragment.insert(0, [orphan, plain, quote]);
      document.getXmlFragment('other').insert(0, [new Y.XmlElement('paragraph')]);
    });
    expect(extractPageBodyReferences(document)).toEqual([
      { srcBlockId: 'p1', target: 'A', targetBlockId: null, explicitPageId: null },
      { srcBlockId: 'p1', target: 'B', targetBlockId: null, explicitPageId: null },
      { srcBlockId: 'p1', target: '', targetBlockId: null, explicitPageId: null },
      { srcBlockId: 'q1', target: 'C', targetBlockId: null, explicitPageId: null },
    ]);
  });

  test('explicit ids, unique titles and block anchors resolve; the rest dangles', async () => {
    const { pages } = await fixture.tree({ parents: [null, 0, 0, 0] });
    const [index, guide, notes] = pages;
    await retitle(index, 'Index');
    await retitle(guide, 'Guide');
    await retitle(notes, 'Notes');
    const beta = await fixture.tree({ tenant: 'beta', parents: [null] });

    await writeBody(index, [
      { blockId: 'blkA', text: 'explicit ', links: [{ pageId: guide.pageId, target: 'Guide' }] },
      { blockId: 'blkB', links: [{ target: 'Notes' }] },
      { blockId: 'blkC', links: [{ target: 'Guide', targetBlockId: 'blk_9' }] },
      { blockId: 'blkD', links: [{ target: 'Ghost' }] },
      { blockId: 'blkE', links: [{ pageId: beta.pages[0].pageId }] },
    ]);
    await process();

    expect(await sourceRows(index)).toEqual([
      { srcPageId: index.pageId, srcBlockId: 'blkA', dstPageId: guide.pageId, dstBlockId: null },
      { srcPageId: index.pageId, srcBlockId: 'blkB', dstPageId: notes.pageId, dstBlockId: null },
      { srcPageId: index.pageId, srcBlockId: 'blkC', dstPageId: guide.pageId, dstBlockId: 'blk_9' },
    ]);
    expect(await withKnowledgeTenant(fixture.pool, fixture.alpha.id, (db) => countPageBacklinkRows(db, fixture.alpha.id))).toBe(3);

    const owner = await subjects(fixture.owner.identity.userId);
    expect(await incoming(guide, owner)).toEqual([
      { srcPageId: index.pageId, srcTitle: 'Index', srcBlockId: 'blkA', dstBlockId: null },
      { srcPageId: index.pageId, srcTitle: 'Index', srcBlockId: 'blkC', dstBlockId: 'blk_9' },
    ]);

    // Dangling references keep an explicit status and never target another page silently.
    const resolved = await outgoing(index);
    expect(resolved).toEqual([
      { status: 'linked', srcBlockId: 'blkA', dstPageId: guide.pageId, dstBlockId: null },
      { status: 'linked', srcBlockId: 'blkB', dstPageId: notes.pageId, dstBlockId: null },
      { status: 'linked', srcBlockId: 'blkC', dstPageId: guide.pageId, dstBlockId: 'blk_9' },
      { status: 'dangling', srcBlockId: 'blkD', target: 'Ghost', targetBlockId: null },
      { status: 'dangling', srcBlockId: 'blkE', target: '', targetBlockId: null },
    ]);
  }, 30_000);

  test('ambiguous titles, dead explicit ids and recycled targets stay dangling', async () => {
    const { pages } = await fixture.tree({ parents: [null, 0, 0, 0, 0] });
    const [index, amb1, amb2, recycled, fallback] = pages;
    await retitle(amb1, 'Amb');
    await retitle(amb2, 'Amb');
    await retitle(recycled, 'Recycled');
    await retitle(fallback, 'Fallback');
    await recycle(recycled);

    await writeBody(index, [
      { blockId: 'blk1', links: [{ target: 'Amb' }] },
      { blockId: 'blk2', links: [{ pageId: amb2.pageId, target: 'Amb' }] },
      // The explicit id is dead; the title text would match a live page but must not be used.
      { blockId: 'blk3', links: [{ pageId: recycled.pageId, target: 'Fallback' }] },
    ]);
    await process();

    expect(await sourceRows(index)).toEqual([
      { srcPageId: index.pageId, srcBlockId: 'blk2', dstPageId: amb2.pageId, dstBlockId: null },
    ]);
    expect(await outgoing(index)).toEqual([
      { status: 'dangling', srcBlockId: 'blk1', target: 'Amb', targetBlockId: null },
      { status: 'linked', srcBlockId: 'blk2', dstPageId: amb2.pageId, dstBlockId: null },
      { status: 'dangling', srcBlockId: 'blk3', target: 'Fallback', targetBlockId: null },
    ]);
  }, 30_000);

  test('body changes replace the outgoing set wholly and reruns stay idempotent', async () => {
    const { pages } = await fixture.tree({ parents: [null, 0, 0, 0] });
    const [index, one, two, three] = pages;
    await retitle(one, 'One');
    await retitle(two, 'Two');
    await retitle(three, 'Three');
    const scope = { workspaceId: index.workspaceId, pageId: index.pageId };

    await writeBody(index, [
      { blockId: 'blk1', links: [{ target: 'One' }] },
      // Duplicate links inside one block collapse into a single row.
      { blockId: 'blk2', links: [{ target: 'Two' }, { target: 'Two' }] },
    ]);
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, async (db) => {
      await expect(refreshPageBacklinks(db, scope)).resolves.toEqual({ linked: 2, dangling: 0 });
    });
    expect(await sourceRows(index)).toEqual([
      { srcPageId: index.pageId, srcBlockId: 'blk1', dstPageId: one.pageId, dstBlockId: null },
      { srcPageId: index.pageId, srcBlockId: 'blk2', dstPageId: two.pageId, dstBlockId: null },
    ]);

    // A consumer-driven rerun after the body changed replaces, not accumulates.
    await writeBody(index, [
      { blockId: 'blk1', links: [{ target: 'Three' }, { target: 'Three' }] },
      { blockId: 'blk2', links: [{ target: 'Ghost' }] },
    ]);
    await process();
    expect(await sourceRows(index)).toEqual([
      { srcPageId: index.pageId, srcBlockId: 'blk1', dstPageId: three.pageId, dstBlockId: null },
    ]);

    // Replaying the same state - directly and through another queued event - is a no-op.
    await withKnowledgeTenant(fixture.pool, scope.workspaceId, async (db) => {
      await expect(refreshPageBacklinks(db, scope)).resolves.toEqual({ linked: 1, dangling: 1 });
      await expect(refreshPageBacklinks(db, scope)).resolves.toEqual({ linked: 1, dangling: 1 });
    });
    await writeBody(index, [
      { blockId: 'blk1', links: [{ target: 'Three' }, { target: 'Three' }] },
      { blockId: 'blk2', links: [{ target: 'Ghost' }] },
    ]);
    await process();
    expect(await sourceRows(index)).toEqual([
      { srcPageId: index.pageId, srcBlockId: 'blk1', dstPageId: three.pageId, dstBlockId: null },
    ]);
  }, 30_000);

  test('incoming links hide sources without view permission, recycled sources and foreign users', async () => {
    const target = await fixture.tree({ parents: [null, 0] });
    const [goal, publicSource] = target.pages;
    await retitle(goal, 'Target');
    await retitle(publicSource, 'Public Source');
    const privateTree = await fixture.tree({ parents: [null, 0], defaultAccess: null });
    const [, privateSource] = privateTree.pages;
    await retitle(privateSource, 'Private Source');
    await grant(privateTree.root, `user:${fixture.owner.identity.userId}`, 'full');

    await writeBody(publicSource, [{ blockId: 'blk1', links: [{ target: 'Target' }] }]);
    await writeBody(privateSource, [{ blockId: 'blk1', links: [{ pageId: goal.pageId }] }]);
    await process();

    const owner = await subjects(fixture.owner.identity.userId);
    const reader = await subjects(fixture.reader.identity.userId);
    const foreign = await subjects(fixture.foreign.identity.userId);
    expect(foreign).toEqual([]);
    expect(await incoming(goal, owner)).toEqual([
      { srcPageId: privateSource.pageId, srcTitle: 'Private Source', srcBlockId: 'blk1', dstBlockId: null },
      { srcPageId: publicSource.pageId, srcTitle: 'Public Source', srcBlockId: 'blk1', dstBlockId: null },
    ]);
    expect(await incoming(goal, reader)).toEqual([
      { srcPageId: publicSource.pageId, srcTitle: 'Public Source', srcBlockId: 'blk1', dstBlockId: null },
    ]);
    expect(await incoming(goal, foreign)).toEqual([]);

    // Recycling the public source removes it from the readable view immediately.
    await recycle(publicSource);
    expect(await incoming(goal, reader)).toEqual([]);

    // Dangling rewrites leave nothing behind to query: no target existence leaks.
    await writeBody(publicSource, [{ blockId: 'blk1', links: [{ target: 'Ghost' }] }]);
    await process();
    expect(await sourceRows(publicSource)).toEqual([]);
    expect(await incoming(goal, owner)).toEqual([
      { srcPageId: privateSource.pageId, srcTitle: 'Private Source', srcBlockId: 'blk1', dstBlockId: null },
    ]);
  }, 30_000);

  test('a failing derivation retries without blocking the queue', async () => {
    const { pages } = await fixture.tree({ parents: [null, 0] });
    const [broken, healthy] = pages;
    await retitle(broken, 'Broken');
    await retitle(healthy, 'Healthy');

    await writeBody(healthy, [{ blockId: 'blk1', links: [{ target: 'Broken' }] }]);
    await writeCorruptBody(broken);
    const diagnostics: KnowledgeWorkerDiagnostic[] = [];
    const runner = await startKnowledgeWorker({
      pool: fixture.pool,
      consumers: consumers(),
      concurrency: 2, pollIntervalMs: 20, shutdownAbortAfterMs: 100,
      observer: (item) => diagnostics.push(item),
    });
    runners.add(runner);
    try {
      // The healthy page finishes while the broken derivation keeps failing.
      await until(async () => (await sourceRows(healthy)).length === 1);
      await until(async () => (await fixture.jobs()).some((job) => job.task === 'knowledge.consume.update_backlinks' && job.attempts >= 1 && job.last_error !== null));
      expect(diagnostics.some((item) => item.type === 'job_failed' && item.code === 'consumer_failed')).toBe(true);

      // Repairing the authoritative state lets the retried job complete.
      await writeBody(broken, [{ blockId: 'blk1', links: [{ target: 'Healthy', targetBlockId: 'blk_h' }] }]);
      await until(async () => (await fixture.jobs()).length === 0, 30_000);
    } finally {
      await runner.close();
      runners.delete(runner);
    }
    expect(await sourceRows(broken)).toEqual([
      { srcPageId: broken.pageId, srcBlockId: 'blk1', dstPageId: healthy.pageId, dstBlockId: 'blk_h' },
    ]);
  }, 45_000);
});
