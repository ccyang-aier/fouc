import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { OutboxEvent, PageScope, Principal } from '@fouc/shared/knowledge/contracts';
import { knowledgeSchema, member, page, teamspace, workspace } from '../../../platform/database/knowledge/schema';
import { authUser } from '../../../platform/database/identity/schema';
import { createTenantTestDatabase } from '../../../platform/database/knowledge/tenant-test-database';
import { withKnowledgeTenant } from '../../../platform/database/knowledge/tenant';
import type { KnowledgeTenantTransaction } from '../../../platform/database/knowledge/tenant';
import type { TenantTestDatabase } from '../../../platform/database/knowledge/tenant-test-database';
import { effectivePageAccessCondition, readMaterializedPagePermissions } from '../permissions/queries';
import { rebuildPermissionSubtree } from '../permissions/rebuild';
import { initializeKnowledgeJobs } from '../workers/initialize';
import { KnowledgePageError } from './errors';
import type { PageErrorCode } from './errors';
import { createAuthorizedPage, moveAuthorizedPage, recycleAuthorizedPage, restoreAuthorizedPage } from './tree';

const canonical = /^[0-9a-z]{6}(?:[0-9a-z]*[1-9a-z])?$/;
const label = (pageId: string) => pageId.replaceAll('-', '_');
type AclEvent = Extract<OutboxEvent, { topic: 'acl.changed' }>;
type PageRow = { id: string; parent_id: string | null; path: string; position: string; revision: string; deleted: string | null };

let database: TenantTestDatabase;
let concurrent: Pool;
const alpha = { workspaceId: randomUUID(), userId: randomUUID(), main: randomUUID(), other: randomUUID() };
const beta = { workspaceId: randomUUID(), userId: randomUUID(), teamspace: randomUUID() };

function postgresError(error: unknown): { code: string; constraint: string } | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string' && 'constraint' in error && typeof error.constraint === 'string') {
    return { code: error.code, constraint: error.constraint };
  }
  return 'cause' in error ? postgresError(error.cause) : undefined;
}

async function rejects(operation: () => Promise<unknown>, code: PageErrorCode) {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(KnowledgePageError);
  expect((failure as KnowledgePageError).code).toBe(code);
}

const tenant = <T>(operation: (db: KnowledgeTenantTransaction) => Promise<T>, pool?: Pool) =>
  withKnowledgeTenant(pool ?? database.pool, alpha.workspaceId, operation);

async function create(seed: { id?: string; parentId?: string | null; teamspaceId?: string; afterPageId?: string | null; title?: string } = {}) {
  return tenant((db) => createAuthorizedPage(db, {
    id: seed.id ?? randomUUID(),
    workspaceId: alpha.workspaceId,
    teamspaceId: seed.teamspaceId ?? alpha.main,
    parentId: seed.parentId ?? null,
    kind: 'doc',
    databaseId: null,
    title: seed.title ?? '页面',
    afterPageId: seed.afterPageId ?? null,
  }, alpha.userId));
}

async function move(seed: { pageId: string; parentId: string | null; afterPageId?: string | null; teamspaceId?: string }, pool?: Pool) {
  return tenant((db) => moveAuthorizedPage(db, {
    workspaceId: alpha.workspaceId,
    pageId: seed.pageId,
    parentId: seed.parentId,
    teamspaceId: seed.teamspaceId ?? alpha.main,
    afterPageId: seed.afterPageId ?? null,
    operationId: randomUUID(),
  }), pool);
}

async function rows<T extends Record<string, unknown>>(query: string, values: unknown[] = []): Promise<T[]> {
  return (await database.admin.query(query, values)).rows as T[];
}

const pageRows = () => rows<PageRow>(
  'SELECT id::text, parent_id::text AS parent_id, path::text AS path, position, acl_revision::text AS revision, deleted_at::text AS deleted FROM knowledge.page WHERE workspace_id=$1 ORDER BY id',
  [alpha.workspaceId],
);

async function childOrder(parentId: string | null) {
  return rows<{ id: string; position: string }>(
    `SELECT id::text, position FROM knowledge.page WHERE workspace_id=$1 AND parent_id ${parentId === null ? 'IS NULL' : '= $2'} AND deleted_at IS NULL ORDER BY position, id`,
    parentId === null ? [alpha.workspaceId] : [alpha.workspaceId, parentId],
  );
}

async function subtree(scope: PageScope) {
  return rows<{ id: string; path: string; depth: string }>(
    `SELECT id::text, path::text AS path, nlevel(path)::text AS depth FROM knowledge.page WHERE workspace_id=$1 AND path <@ (SELECT path FROM knowledge.page WHERE workspace_id=$1 AND id=$2)::ltree`,
    [scope.workspaceId, scope.pageId],
  );
}

async function latestAclEvent(scope: PageScope): Promise<AclEvent> {
  const result = await rows<{ payload: AclEvent }>(
    "SELECT payload FROM knowledge.outbox WHERE workspace_id=$1 AND topic='acl.changed' AND payload->>'rootPageId'=$2 ORDER BY (payload->>'revision')::bigint DESC LIMIT 1",
    [scope.workspaceId, scope.pageId],
  );
  if (!result[0]) throw new Error('Expected an acl.changed event');
  return result[0].payload;
}

async function rebuild(scope: PageScope) {
  const event = await latestAclEvent(scope);
  await tenant((db) => rebuildPermissionSubtree(db, event));
}

async function visiblePageIds() {
  const principal = `workspace:${alpha.workspaceId}` as Principal;
  const found = await tenant((db) => db.select({ id: page.id }).from(page)
    .where(and(eq(page.workspaceId, alpha.workspaceId), effectivePageAccessCondition({ workspaceId: alpha.workspaceId, principals: [principal], required: 'view' }))));
  return found.map((row) => row.id).sort();
}

beforeAll(async () => {
  database = await createTenantTestDatabase();
  concurrent = new Pool({ ...database.pool.options, max: 4 });
  await initializeKnowledgeJobs(database.admin, database.pool);
  const client = await database.admin.connect();
  try {
    await client.query('BEGIN');
    const db = drizzle(client, { schema: knowledgeSchema });
    for (const [workspaceId, userId, name] of [[alpha.workspaceId, alpha.userId, 'Tree Alpha'], [beta.workspaceId, beta.userId, 'Tree Beta']] as const) {
      await db.insert(authUser).values({ id: userId, name, email: `${userId}@tree.test` });
      await db.insert(workspace).values({ id: workspaceId, name, kind: 'team' });
      await db.insert(member).values({ workspaceId, userId, role: 'owner' });
    }
    await db.insert(teamspace).values([
      { workspaceId: alpha.workspaceId, id: alpha.main, name: 'Main', defaultAccess: 'view' },
      { workspaceId: alpha.workspaceId, id: alpha.other, name: 'Other', defaultAccess: 'view' },
      { workspaceId: beta.workspaceId, id: beta.teamspace, name: 'Beta', defaultAccess: 'view' },
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}, 60_000);

afterAll(async () => {
  if (concurrent) await concurrent.end();
  if (database) await database.dispose();
}, 60_000);

describe('T01 offline UUID creation and idempotency', () => {
  test('accepts client-generated UUIDs and stores the verified server author', async () => {
    const id = randomUUID();
    const created = await create({ id, title: '离线页面' });
    expect(created).toMatchObject({ pageId: id, parentId: null, teamspaceId: alpha.main, path: label(id) });
    expect(created.position).toMatch(canonical);
    const [row] = await rows<{ position: string; path: string; created_by: string; title: string }>(
      'SELECT position, path::text AS path, created_by::text AS created_by, title FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, id]);
    expect(row).toMatchObject({ path: label(id), created_by: alpha.userId, title: '离线页面' });
  });

  test('replaying or conflicting with an existing id resolves to the stored page', async () => {
    const id = randomUUID();
    const elsewhere = await create();
    const first = await create({ id, title: '第一次' });
    const replay = await create({ id, title: '第一次' });
    const conflict = await create({ id, title: '第二次', parentId: elsewhere.pageId });
    expect(replay).toEqual(first);
    expect(conflict.pageId).toBe(id);
    const [row] = await rows<{ title: string; parent_id: string | null }>(
      'SELECT title, parent_id::text AS parent_id FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, id]);
    const [count] = await rows<{ n: string }>('SELECT count(*)::text AS n FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, id]);
    expect(row).toEqual({ title: '第一次', parent_id: null });
    expect(count!.n).toBe('1');
  });
});

describe('T01 fractional sibling ordering', () => {
  test('afterPageId inserts between neighbours without touching any sibling key', async () => {
    const parent = await create();
    const first = await create({ parentId: parent.pageId });
    const second = await create({ parentId: parent.pageId });
    const middle = await create({ parentId: parent.pageId, afterPageId: first.pageId });
    expect((await childOrder(parent.pageId)).map((row) => row.id)).toEqual([first.pageId, middle.pageId, second.pageId]);
    const before = await childOrder(parent.pageId);
    await create({ parentId: parent.pageId, afterPageId: middle.pageId });
    const after = await childOrder(parent.pageId);
    expect(after.filter((row) => before.some((previous) => previous.id === row.id))).toEqual(before);
  });

  test('database ORDER BY position agrees with the canonical client ordering', async () => {
    const parent = await create();
    let state = 123456789;
    const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
    const order: string[] = [];
    for (let count = 0; count < 40; count++) {
      const insertAt = order.length === 0 ? 0 : 1 + Math.floor(next() * order.length);
      const created = await create({ parentId: parent.pageId, afterPageId: order[insertAt - 1] ?? null });
      order.splice(insertAt, 0, created.pageId);
    }
    expect((await childOrder(parent.pageId)).map((row) => row.id)).toEqual(order);
  }, 30_000);

  test('appending many siblings keeps keys distinct, ordered and stable', async () => {
    const parent = await create();
    const appended: string[] = [];
    for (let count = 0; count < 30; count++) appended.push((await create({ parentId: parent.pageId })).pageId);
    const stored = await childOrder(parent.pageId);
    expect(stored.map((row) => row.id)).toEqual(appended);
    expect(new Set(stored.map((row) => row.position)).size).toBe(30);
    expect(stored.every((row) => canonical.test(row.position))).toBe(true);
    await create({ parentId: parent.pageId });
    expect((await childOrder(parent.pageId)).slice(0, 30)).toEqual(stored);
  }, 30_000);

  test('exhausted or legacy neighbour keys trigger a local sibling renumber only', async () => {
    const parent = await create();
    const outsider = await create();
    const legacy = randomUUID();
    const badOne = randomUUID();
    const badTwo = randomUUID();
    await tenant((db) => db.insert(page).values([
      { workspaceId: alpha.workspaceId, id: legacy, teamspaceId: alpha.main, parentId: parent.pageId, position: 'a0', path: `${parent.path}.${label(legacy)}`, createdBy: alpha.userId },
      { workspaceId: alpha.workspaceId, id: badOne, teamspaceId: alpha.main, parentId: parent.pageId, position: `ghflao${'1'.repeat(250)}`, path: `${parent.path}.${label(badOne)}`, createdBy: alpha.userId },
      { workspaceId: alpha.workspaceId, id: badTwo, teamspaceId: alpha.main, parentId: parent.pageId, position: `ghflao${'1'.repeat(249)}2`, path: `${parent.path}.${label(badTwo)}`, createdBy: alpha.userId },
    ]));
    const outsiderBefore = await rows<{ id: string; position: string }>('SELECT id::text, position FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, outsider.pageId]);
    const mover = await create({ parentId: parent.pageId, afterPageId: badOne });
    const stored = await childOrder(parent.pageId);
    expect(stored.map((row) => row.id)).toEqual([legacy, badOne, mover.pageId, badTwo]);
    expect(stored.every((row) => canonical.test(row.position) && row.position.length <= 256)).toBe(true);
    expect(new Set(stored.map((row) => row.position)).size).toBe(4);
    expect(await rows<{ id: string; position: string }>('SELECT id::text, position FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, outsider.pageId])).toEqual(outsiderBefore);
  });
});

describe('T01 ltree subtree moves', () => {
  test('moving a subtree rewrites server-derived descendant paths and fences them', async () => {
    const source = await create();
    const node = await create({ parentId: source.pageId });
    const childOne = await create({ parentId: node.pageId });
    const childTwo = await create({ parentId: node.pageId });
    const grand = await create({ parentId: childOne.pageId });
    const target = await create();
    const revisions = new Map((await rows<{ id: string; revision: string }>(
      'SELECT id::text, acl_revision::text AS revision FROM knowledge.page WHERE workspace_id=$1 AND path <@ $2::ltree', [alpha.workspaceId, node.path])).map((row) => [row.id, Number(row.revision)]));

    const moved = await move({ pageId: node.pageId, parentId: target.pageId });

    expect(moved).toMatchObject({ pageId: node.pageId, parentId: target.pageId, path: `${target.path}.${label(node.pageId)}` });
    const expected: Record<string, string> = {
      [node.pageId]: `${target.path}.${label(node.pageId)}`,
      [childOne.pageId]: `${target.path}.${label(node.pageId)}.${label(childOne.pageId)}`,
      [childTwo.pageId]: `${target.path}.${label(node.pageId)}.${label(childTwo.pageId)}`,
      [grand.pageId]: `${target.path}.${label(node.pageId)}.${label(childOne.pageId)}.${label(grand.pageId)}`,
    };
    const movedSubtree = await subtree({ workspaceId: alpha.workspaceId, pageId: node.pageId });
    expect(movedSubtree).toHaveLength(4);
    for (const row of movedSubtree) {
      expect(row.path).toBe(expected[row.id]!);
      expect(row.depth).toBe(String((row.path.match(/\./g) ?? []).length + 1));
    }
    const after = new Map((await rows<{ id: string; revision: string }>(
      'SELECT id::text, acl_revision::text AS revision FROM knowledge.page WHERE workspace_id=$1 AND path <@ $2::ltree', [alpha.workspaceId, moved.path])).map((row) => [row.id, Number(row.revision)]));
    for (const [id, revision] of after) expect(revision).toBe(revisions.get(id)! + 1);
    const event = await latestAclEvent({ workspaceId: alpha.workspaceId, pageId: node.pageId });
    expect(event).toMatchObject({ rootPageId: node.pageId, revision: after.get(node.pageId)! });
  });

  test('root invariants hold when promotion and demotion cross the root level', async () => {
    const root = await create();
    const node = await create({ parentId: root.pageId });
    const child = await create({ parentId: node.pageId });
    const promoted = await move({ pageId: node.pageId, parentId: null });
    expect(promoted).toMatchObject({ parentId: null, path: label(node.pageId) });
    const [level] = await rows<{ depth: string; parent_id: string | null }>(
      'SELECT nlevel(path)::text AS depth, parent_id::text AS parent_id FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, node.pageId]);
    expect(level).toEqual({ depth: '1', parent_id: null });
    const [childRow] = await rows<{ path: string }>('SELECT path::text AS path FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, child.pageId]);
    expect(childRow.path).toBe(`${label(node.pageId)}.${label(child.pageId)}`);
    const demoted = await move({ pageId: node.pageId, parentId: root.pageId });
    expect(demoted.path).toBe(`${root.path}.${label(node.pageId)}`);
    const rootless = randomUUID();
    let failure: ReturnType<typeof postgresError>;
    try {
      await tenant((db) => db.insert(page).values({ workspaceId: alpha.workspaceId, id: rootless, teamspaceId: alpha.main, parentId: null, position: 'a0', path: `${label(randomUUID())}.${label(rootless)}`, createdBy: alpha.userId }));
    } catch (error) {
      failure = postgresError(error);
    }
    expect(failure?.code).toBe('23514');
    expect(failure?.constraint).toBe('page_root_path_depth');
  });
});

describe('T01 forbidden moves', () => {
  test('rejects cycles, self-parenting and missing or recycled subjects before any write', async () => {
    const root = await create();
    const child = await create({ parentId: root.pageId });
    const grand = await create({ parentId: child.pageId });
    const before = await pageRows();
    await rejects(() => move({ pageId: root.pageId, parentId: grand.pageId }), 'INVALID_PAGE_MOVE');
    await rejects(() => move({ pageId: root.pageId, parentId: root.pageId }), 'INVALID_PAGE_INPUT');
    await rejects(() => move({ pageId: randomUUID(), parentId: null }), 'PAGE_NOT_FOUND');
    expect(await pageRows()).toEqual(before);
    await tenant((db) => recycleAuthorizedPage(db, { workspaceId: alpha.workspaceId, pageId: grand.pageId }));
    await rejects(() => move({ pageId: grand.pageId, parentId: null }), 'PAGE_NOT_FOUND');
  });

  test('rejects cross-teamspace parents, lied teamspaces and misplaced afterPageId', async () => {
    const mainRoot = await create();
    const otherRoot = await create({ teamspaceId: alpha.other });
    await rejects(() => create({ parentId: otherRoot.pageId }), 'INVALID_PAGE_PARENT');
    await rejects(() => move({ pageId: otherRoot.pageId, parentId: mainRoot.pageId, teamspaceId: alpha.other }), 'INVALID_PAGE_PARENT');
    await rejects(() => move({ pageId: mainRoot.pageId, parentId: null, teamspaceId: alpha.other }), 'INVALID_PAGE_MOVE');
    const anchor = await create({ parentId: mainRoot.pageId });
    await rejects(() => move({ pageId: mainRoot.pageId, parentId: null, afterPageId: anchor.pageId }), 'INVALID_PAGE_PLACEMENT');
    const recycled = await create({ parentId: mainRoot.pageId });
    await tenant((db) => recycleAuthorizedPage(db, { workspaceId: alpha.workspaceId, pageId: recycled.pageId }));
    await rejects(() => create({ parentId: recycled.pageId }), 'INVALID_PAGE_PARENT');
    await rejects(() => create({ parentId: mainRoot.pageId, afterPageId: recycled.pageId }), 'INVALID_PAGE_PLACEMENT');
  });

  test('the schema itself refuses cross-tenant parentage', async () => {
    const id = randomUUID();
    let failure: ReturnType<typeof postgresError>;
    try {
      await tenant((db) => db.insert(page).values({ workspaceId: alpha.workspaceId, id, teamspaceId: beta.teamspace, path: label(id), position: 'a0', createdBy: alpha.userId }));
    } catch (error) {
      failure = postgresError(error);
    }
    expect(failure?.code).toBe('23503');
    expect(failure?.constraint).toBe('page_teamspace_fk');
  });
});

describe('T01 recycle and restore visibility', () => {
  test('a recycled subtree fails closed and a restore re-materializes it', async () => {
    const root = await create();
    const child = await create({ parentId: root.pageId });
    const grand = await create({ parentId: child.pageId });
    await rebuild({ workspaceId: alpha.workspaceId, pageId: root.pageId });
    expect(await visiblePageIds()).toEqual([root.pageId, child.pageId, grand.pageId].sort());

    const recycled = await tenant((db) => recycleAuthorizedPage(db, { workspaceId: alpha.workspaceId, pageId: child.pageId }));
    expect(recycled).toMatchObject({ workspaceId: alpha.workspaceId, pageId: child.pageId });
    expect(recycled.deletedAt).not.toBeNull();
    expect((await tenant((db) => readMaterializedPagePermissions(db, { workspaceId: alpha.workspaceId, pageId: child.pageId }))).status).toBe('unavailable');

    await rebuild({ workspaceId: alpha.workspaceId, pageId: child.pageId });
    const grandPermissions = await tenant((db) => readMaterializedPagePermissions(db, { workspaceId: alpha.workspaceId, pageId: grand.pageId }));
    expect(grandPermissions).toMatchObject({ status: 'ready', permissions: { view: [] } });
    expect(await visiblePageIds()).toEqual([root.pageId]);

    const restored = await tenant((db) => restoreAuthorizedPage(db, { workspaceId: alpha.workspaceId, pageId: child.pageId }));
    expect(restored).toMatchObject({ deletedAt: null });
    await rebuild({ workspaceId: alpha.workspaceId, pageId: child.pageId });
    expect(await visiblePageIds()).toEqual([root.pageId, child.pageId, grand.pageId].sort());
  });
});

describe('T01 transactional rollback', () => {
  test('a caller failure after a successful move reverts every row and event', async () => {
    const target = await create();
    const node = await create();
    await create({ parentId: node.pageId });
    const before = await pageRows();
    const outboxBefore = (await rows<{ n: string }>('SELECT count(*)::text AS n FROM knowledge.outbox WHERE workspace_id=$1', [alpha.workspaceId]))[0]!.n;
    let failure: unknown;
    try {
      await tenant(async (db) => {
        await moveAuthorizedPage(db, { workspaceId: alpha.workspaceId, pageId: node.pageId, parentId: target.pageId, teamspaceId: alpha.main, afterPageId: null, operationId: randomUUID() });
        throw new Error('caller aborted after the move');
      });
    } catch (error) {
      failure = error;
    }
    expect((failure as Error).message).toBe('caller aborted after the move');
    expect(await pageRows()).toEqual(before);
    expect((await rows<{ n: string }>('SELECT count(*)::text AS n FROM knowledge.outbox WHERE workspace_id=$1', [alpha.workspaceId]))[0]!.n).toBe(outboxBefore);
  });
});

describe('T01 concurrent moves', () => {
  test('distinct nodes moving under one parent serialize with distinct keys', async () => {
    const target = await create();
    const one = await create();
    const two = await create();
    const [first, second] = await Promise.all([
      move({ pageId: one.pageId, parentId: target.pageId }, concurrent),
      move({ pageId: two.pageId, parentId: target.pageId }, concurrent),
    ]);
    expect([first.parentId, second.parentId]).toEqual([target.pageId, target.pageId]);
    expect(first.position).not.toBe(second.position);
    const stored = await childOrder(target.pageId);
    expect(stored.map((row) => row.id).sort()).toEqual([one.pageId, two.pageId].sort());
    expect(new Set(stored.map((row) => row.position)).size).toBe(2);
  });

  test('the same node racing to two parents ends in exactly one consistent tree', async () => {
    const left = await create();
    const right = await create();
    const node = await create();
    const child = await create({ parentId: node.pageId });
    const results = await Promise.all([
      move({ pageId: node.pageId, parentId: left.pageId }, concurrent).then(() => 'left', () => 'failed'),
      move({ pageId: node.pageId, parentId: right.pageId }, concurrent).then(() => 'right', () => 'failed'),
    ]);
    expect(results).not.toContain('failed');
    const [stored] = await rows<{ parent_id: string; path: string }>(
      'SELECT parent_id::text AS parent_id, path::text AS path FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, node.pageId]);
    expect([left.pageId, right.pageId]).toContain(stored.parent_id);
    const expectedParent = stored.parent_id === left.pageId ? left : right;
    expect(stored.path).toBe(`${expectedParent.path}.${label(node.pageId)}`);
    const [childRow] = await rows<{ path: string }>('SELECT path::text AS path FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, child.pageId]);
    expect(childRow.path).toBe(`${stored.path}.${label(child.pageId)}`);
  });
});

describe('T01 large subtrees', () => {
  test('a hundred-node deep subtree relocates with every derived path intact', async () => {
    // 当前 schema 的两个 path 索引设定了物理深度上限(page_path_gist_idx 约五十层、
    // page_workspace_path_unique 约六十八层),百级字面深度不可存储;此测试用
    // 48 层主干加分支构造 101 节点子树验证同一条推导路径。
    const spine = Array.from({ length: 48 }, () => randomUUID());
    const leaves = Array.from({ length: 53 }, () => randomUUID());
    const seeds = spine.map((id, index) => ({
      workspaceId: alpha.workspaceId,
      id,
      teamspaceId: alpha.main,
      parentId: index === 0 ? null : spine[index - 1]!,
      position: 'a0',
      path: spine.slice(0, index + 1).map(label).join('.'),
      createdBy: alpha.userId,
    }));
    for (const [index, leaf] of leaves.entries()) {
      const attach = spine[index % (spine.length - 1) + 1]!;
      const parent = seeds.find((seed) => seed.id === attach)!;
      seeds.push({ workspaceId: alpha.workspaceId, id: leaf, teamspaceId: alpha.main, parentId: attach, position: 'a1', path: `${parent.path}.${label(leaf)}`, createdBy: alpha.userId });
    }
    await tenant((db) => db.insert(page).values(seeds));
    const target = await create();
    const moved = await move({ pageId: spine[1]!, parentId: target.pageId });
    expect(moved.path).toBe(`${target.path}.${label(spine[1]!)}`);
    const stored = new Map((await rows<{ id: string; path: string }>(
      'SELECT id::text, path::text AS path FROM knowledge.page WHERE workspace_id=$1 AND id = ANY($2::uuid[])', [alpha.workspaceId, [...spine, ...leaves]])).map((row) => [row.id, row.path]));
    for (const seed of seeds) {
      const tail = seed.path.split('.').slice(1).join('.');
      expect(stored.get(seed.id)).toBe(seed.parentId === null ? seed.path : `${target.path}.${tail}`);
    }
    expect(await subtree({ workspaceId: alpha.workspaceId, pageId: spine[1]! })).toHaveLength(100);
  }, 60_000);

  test('paths beyond the indexed depth ceiling are refused by the schema itself', async () => {
    const chain = Array.from({ length: 90 }, () => randomUUID());
    let failure: ReturnType<typeof postgresError>;
    try {
      await tenant((db) => db.insert(page).values(chain.map((id, index) => ({
        workspaceId: alpha.workspaceId,
        id,
        teamspaceId: alpha.main,
        parentId: index === 0 ? null : chain[index - 1]!,
        position: 'a0',
        path: chain.slice(0, index + 1).map(label).join('.'),
        createdBy: alpha.userId,
      }))));
    } catch (error) {
      failure = postgresError(error);
    }
    expect(failure?.code).toMatch(/^5[24]/);
  }, 60_000);
});
