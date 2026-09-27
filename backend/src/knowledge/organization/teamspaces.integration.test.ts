import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { PoolClient } from 'pg';
import { eq } from 'drizzle-orm';
import { principal, teamspaceSchema } from '@fouc/shared/knowledge/contracts';
import type { PermissionLevel, Teamspace } from '@fouc/shared/knowledge/contracts';
import { blockIndex, docState, page, pageEffectiveAcl, teamspace } from '../../database/knowledge/schema';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { createAuthTestServer, responseCookie, testPassword } from '../../identity/auth-test-server';
import type { AuthTestServer } from '../../identity/auth-test-server';
import type { FoucIdentity } from '../../identity/identity';
import { computeEffectivePermissions, permissionFor } from '../permissions/effective';
import { createOrganizationRoutes } from './http';
import { createOrganizationService } from './service';
import type { OrganizationService } from './service';
import { readTeamspacePermissionRoot } from './teamspaces';
import { teamspacePermissionInvalidator } from '../permissions/fence';
import { initializeKnowledgeJobs } from '../workers/initialize';

interface Actor { email: string; cookie: string; identity: FoucIdentity }
let server: AuthTestServer;
let service: OrganizationService;
let owner: Actor, admin: Actor, regular: Actor, guest: Actor, outsider: Actor;
let personalId: string, workspaceId: string, otherId: string;
const base = '/api/knowledge/workspaces';

function request(path: string, actor: Actor | undefined = owner, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
  return fetch(`${server.origin}${base}${path}`, { method, headers: {
    origin: server.webOrigin, ...(actor ? { cookie: actor.cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra,
  }, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function result<T>(response: Promise<Response>, status = 200): Promise<T> {
  const received = await response;
  expect(received.status).toBe(status);
  return received.json() as Promise<T>;
}

async function register(name: string): Promise<Actor> {
  const email = `${name}@teamspace.test`;
  expect((await server.request('/sign-up/email', { email, name, password: testPassword })).status).toBe(200);
  expect((await server.request(server.verificationPath(email))).status).toBe(302);
  const signed = await server.request('/sign-in/email', { email, password: testPassword });
  expect(signed.status).toBe(200);
  const cookie = responseCookie(signed);
  const identity = await (await fetch(`${server.origin}/test/identity`, { headers: { cookie } })).json() as FoucIdentity;
  return { email, cookie, identity };
}

const scope = (record: Teamspace) => ({ workspaceId: record.workspaceId, teamspaceId: record.id });
const path = (record: Teamspace) => `/${record.workspaceId}/teamspaces/${record.id}`;
async function create(name: string, defaultAccess: PermissionLevel | null = null, actor = owner, target = workspaceId) {
  return result<Teamspace>(request(`/${target}/teamspaces`, actor, 'POST', { name, defaultAccess }), 201);
}

async function insertPage(record: Teamspace, recycled = false) {
  const id = randomUUID();
  await withKnowledgeTenant(server.database.pool, record.workspaceId, async (db) => {
    await db.insert(page).values({ workspaceId: record.workspaceId, id, teamspaceId: record.id, position: 'a0', path: id.replaceAll('-', '_'), title: 'Preserve this page', createdBy: owner.identity.userId, deletedAt: recycled ? new Date() : null });
    await db.insert(docState).values({ workspaceId: record.workspaceId, pageId: id, state: new Uint8Array([0, 0]), stateVector: new Uint8Array([0]) });
    await db.insert(pageEffectiveAcl).values({ workspaceId: record.workspaceId, pageId: id, view: [principal('workspace', record.workspaceId)] });
    await db.insert(blockIndex).values({ workspaceId: record.workspaceId, pageId: id, blockId: 'text', blockType: 'paragraph', contentMd: 'Protected content', contentHash: 'a'.repeat(64), principals: [principal('workspace', record.workspaceId)] });
  });
  return id;
}

async function waitForTeamspaceLock(client: PoolClient) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await client.query('SELECT pg_stat_clear_snapshot()');
    const result = await client.query<{ blocked: boolean }>(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND usename = $1 AND wait_event_type = 'Lock' AND query LIKE '%teamspace%for update%') AS blocked`, [server.database.role.name]);
    if (result.rows[0]!.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Expected a request waiting for its Teamspace row lock');
}

beforeAll(async () => {
  server = await createAuthTestServer({ mount(app, { auth, database }) {
    service = createOrganizationService(database.pool, { permissions: teamspacePermissionInvalidator });
    app.route('/', createOrganizationRoutes(auth, service));
  } });
  await initializeKnowledgeJobs(server.database.admin, server.database.pool);
  owner = await register('owner'); admin = await register('admin'); regular = await register('member'); guest = await register('guest'); outsider = await register('outsider');
  personalId = (await result<{ id: string }>(request('', owner, 'POST', { name: 'Personal', kind: 'personal' }), 201)).id;
  workspaceId = (await result<{ id: string }>(request('', owner, 'POST', { name: 'Team', kind: 'team' }), 201)).id;
  otherId = (await result<{ id: string }>(request('', outsider, 'POST', { name: 'Other tenant', kind: 'team' }), 201)).id;
  for (const [actor, role] of [[admin, 'admin'], [regular, 'member'], [guest, 'guest']] as const) {
    const invite = await result<{ invitation: { id: string }; token: string }>(request(`/${workspaceId}/invitations`, owner, 'POST', { email: actor.email, role }), 201);
    await result(request(`/${workspaceId}/invitations/${invite.invitation.id}/accept`, actor, 'POST', { token: invite.token }));
  }
}, 30_000);

afterAll(async () => { if (server) await server.close(); }, 30_000);

describe('Teamspace metadata and root defaults over real HTTP/PostgreSQL', () => {
  test('personal and team workspaces use the same creation path with null as the safe default', async () => {
    for (const target of [personalId, workspaceId]) {
      const record = await result<Teamspace>(request(`/${target}/teamspaces`, owner, 'POST', { name: '  Research  ' }), 201);
      expect(teamspaceSchema.safeParse(record).success).toBe(true);
      expect(record.name).toBe('Research');
      expect(record.defaultAccess).toBeNull();
      expect(record.workspaceId).toBe(target);
      expect((await result<{ kind: string }>(request(`/${target}`))).kind).toBe(target === personalId ? 'personal' : 'team');
    }
  });

  test('owner/admin can create, rename, change root defaults and delete an empty Teamspace', async () => {
    for (const actor of [owner, admin]) {
      const record = await create('Managed', 'view', actor);
      const before = await server.database.admin.query<{ created_at: Date; updated_at: Date }>('SELECT created_at, updated_at FROM knowledge.teamspace WHERE workspace_id = $1 AND id = $2', [workspaceId, record.id]);
      const changed = await result<Teamspace>(request(path(record), actor, 'PATCH', { name: 'Managed renamed', defaultAccess: 'edit' }));
      expect(changed).toEqual({ ...record, name: 'Managed renamed', defaultAccess: 'edit' });
      const after = await server.database.admin.query<{ created_at: Date; updated_at: Date }>('SELECT created_at, updated_at FROM knowledge.teamspace WHERE workspace_id = $1 AND id = $2', [workspaceId, record.id]);
      expect(after.rows[0]!.created_at).toEqual(before.rows[0]!.created_at);
      expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(before.rows[0]!.updated_at.getTime());
      expect((await result<Teamspace>(request(path(record), actor))).defaultAccess).toBe('edit');
      expect(await result<{ removed: boolean }>(request(path(record), actor, 'DELETE', {}))).toEqual({ removed: true });
      expect((await request(path(record), actor)).status).toBe(404);
      expect((await request(path(record), actor, 'DELETE', {})).status).toBe(404);
    }
  });

  test('member can read metadata without acquiring page rights; guest and outsiders cannot browse', async () => {
    const record = await create('Metadata only', null);
    expect((await result<Teamspace>(request(path(record), regular))).defaultAccess).toBeNull();
    const listed = await result<{ items: Teamspace[] }>(request(`/${workspaceId}/teamspaces`, regular));
    expect(listed.items.some((row) => row.id === record.id)).toBe(true);
    for (const actor of [owner, admin, regular]) expect((await request(`/${workspaceId}/teamspaces`, actor)).status).toBe(200);
    expect((await request(`/${workspaceId}/teamspaces`, guest)).status).toBe(403);
    expect((await request(path(record), guest)).status).toBe(403);
    expect((await request(`/${workspaceId}/teamspaces`, outsider)).status).toBe(404);
    expect((await request(path(record), outsider)).status).toBe(404);
  });

  test('member/guest cannot create, mutate defaults, rename or delete; identity injection is rejected', async () => {
    const record = await create('Role ceilings', 'view');
    for (const actor of [regular, guest]) {
      expect((await request(`/${workspaceId}/teamspaces`, actor, 'POST', { name: 'Forbidden' })).status).toBe(403);
      expect((await request(path(record), actor, 'PATCH', { defaultAccess: 'full' })).status).toBe(403);
      expect((await request(path(record), actor, 'PATCH', { name: 'Forbidden' })).status).toBe(403);
      expect((await request(path(record), actor, 'DELETE', {})).status).toBe(403);
    }
    expect((await request(`/${workspaceId}/teamspaces`, owner, 'POST', { name: 'Injected', userId: outsider.identity.userId })).status).toBe(400);
    expect((await request(path(record), owner, 'PATCH', { name: 'Injected', workspaceId: otherId })).status).toBe(400);
    expect((await request(path(record), owner, 'PATCH', { defaultAccess: 'full', actorUserId: owner.identity.userId })).status).toBe(400);
    expect((await result<Teamspace>(request(path(record)))).name).toBe('Role ceilings');
  });

  test('all four persisted default levels and null are directly consumable by P01 permission calculation', async () => {
    const record = await create('Permission root');
    const pageId = randomUUID();
    for (const defaultAccess of ['view', 'comment', 'edit', 'full', null] as const) {
      const updated = await result<Teamspace>(request(path(record), owner, 'PATCH', { defaultAccess }));
      expect(updated.defaultAccess).toBe(defaultAccess);
      const root = await withKnowledgeTenant(server.database.pool, workspaceId, (db) => readTeamspacePermissionRoot(db, scope(record)));
      expect(root).toEqual({ ...scope(record), defaultAccess });
      const permissions = computeEffectivePermissions({ ...root, lineage: [{ id: pageId, parentId: null, workspaceId, teamspaceId: record.id, inheritsPermissions: true, grants: [] }] });
      expect(permissionFor([principal('workspace', workspaceId)], permissions)).toBe(defaultAccess);
    }
    expect((await result<Teamspace>(request(path(record), owner, 'PATCH', { name: 'Name-only patch' }))).defaultAccess).toBeNull();
  });

  test('lists use bounded UUID pagination and never include another workspace', async () => {
    const foreign = await create('Only in other workspace', 'full', outsider, otherId);
    const first = await result<{ items: Teamspace[]; nextCursor: string }>(request(`/${workspaceId}/teamspaces?limit=1`));
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeDefined();
    const second = await result<{ items: Teamspace[] }>(request(`/${workspaceId}/teamspaces?limit=1&cursor=${first.nextCursor}`));
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
    const all = await result<{ items: Teamspace[] }>(request(`/${workspaceId}/teamspaces`));
    expect(all.items.every((row) => row.workspaceId === workspaceId)).toBe(true);
    expect(all.items.some((row) => row.id === foreign.id)).toBe(false);
    expect((await request(`/${workspaceId}/teamspaces?limit=101`)).status).toBe(400);
    expect((await request(`/${workspaceId}/teamspaces?cursor=not-uuid`)).status).toBe(400);
  });

  test('same Teamspace UUID in different tenants never crosses read, update, delete or root lookup', async () => {
    const record = await create('Alpha scope', 'view');
    await withKnowledgeTenant(server.database.pool, otherId, (db) => db.insert(teamspace).values({ workspaceId: otherId, id: record.id, name: 'Beta scope', defaultAccess: 'full' }));
    const foreign = { ...record, workspaceId: otherId };
    expect((await result<Teamspace>(request(path(record)))).name).toBe('Alpha scope');
    expect((await result<Teamspace>(request(path(foreign), outsider))).name).toBe('Beta scope');
    expect((await request(path(foreign), owner, 'PATCH', { defaultAccess: null })).status).toBe(404);
    expect((await request(path(foreign), owner, 'DELETE', {})).status).toBe(404);
    await expect(withKnowledgeTenant(server.database.pool, workspaceId, (db) => readTeamspacePermissionRoot(db, scope(foreign)))).rejects.toMatchObject({ code: 'TEAMSPACE_NOT_FOUND' });
    await result(request(path(record), owner, 'DELETE', {}));
    expect((await result<Teamspace>(request(path(foreign), outsider))).defaultAccess).toBe('full');
  });

  test('invalid input and credential/origin confusion fail before mutation', async () => {
    const record = await create('Strict requests');
    for (const input of [{}, { name: ' ' }, { name: 'x'.repeat(121) }, { defaultAccess: 'owner' }, { id: randomUUID(), name: 'Forged ID' }, { settings: {} }]) {
      expect((await request(path(record), owner, 'PATCH', input)).status).toBe(400);
    }
    expect((await request(path(record), owner, 'PATCH', { name: 'Bad origin' }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await request(path(record), owner, 'PATCH', { name: 'Bad bearer' }, { authorization: 'Bearer invalid' })).status).toBe(401);
    expect((await request(path(record), owner, 'DELETE', {}, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await fetch(`${server.origin}${base}${path(record)}`)).status).toBe(401);
    expect((await result<Teamspace>(request(path(record)))).name).toBe('Strict requests');
  });
});

describe('Teamspace deletion and transactional permission invalidation', () => {
  for (const recycled of [false, true]) test(`${recycled ? 'recycled' : 'live'} pages prevent deletion; root changes fence ACLs without erasing data`, async () => {
    const record = await create(recycled ? 'Recycle bin protected' : 'Pages protected', 'view');
    const pageId = await insertPage(record, recycled);
    const before = await server.database.admin.query('SELECT name, default_access, updated_at FROM knowledge.teamspace WHERE workspace_id = $1 AND id = $2', [workspaceId, record.id]);
    expect((await result<{ code: string }>(request(path(record), owner, 'DELETE', {}), 409)).code).toBe('TEAMSPACE_NOT_EMPTY');
    const after = await server.database.admin.query('SELECT name, default_access, updated_at FROM knowledge.teamspace WHERE workspace_id = $1 AND id = $2', [workspaceId, record.id]);
    expect(after.rows).toEqual(before.rows);
    // Same-value and name-only updates are not permission changes.
    expect((await result<Teamspace>(request(path(record), admin, 'PATCH', { name: 'Safe rename', defaultAccess: 'view' }))).name).toBe('Safe rename');
    const beforeJobs = (await server.database.admin.query('SELECT count(*)::int AS n FROM knowledge.outbox')).rows[0]!.n;
    expect((await result<Teamspace>(request(path(record), owner, 'PATCH', { defaultAccess: null }))).defaultAccess).toBeNull();
    const saved = await withKnowledgeTenant(server.database.pool, workspaceId, async (db) => ({
      document: await db.select().from(docState).where(eq(docState.pageId, pageId)),
      acl: await db.select().from(pageEffectiveAcl).where(eq(pageEffectiveAcl.pageId, pageId)),
      index: await db.select().from(blockIndex).where(eq(blockIndex.pageId, pageId)),
    }));
    expect([...saved.document[0]!.state]).toEqual([0, 0]);
    expect(saved.acl[0]!.view).toEqual([]);
    expect(saved.acl[0]!.revision).toBe(0);
    expect(saved.index[0]!.principals).toEqual([]);
    expect((await server.database.admin.query('SELECT acl_revision FROM knowledge.page WHERE workspace_id=$1 AND id=$2', [workspaceId, pageId])).rows[0]!.acl_revision).toBe('1');
    expect((await server.database.admin.query('SELECT count(*)::int AS n FROM knowledge.outbox')).rows[0]!.n).toBe(beforeJobs + 1);
  });

  for (const operation of ['delete', 'default'] as const) test(`a child committed while ${operation} waits for the container lock is protected`, async () => {
    const record = await create(`Concurrent ${operation}`, 'view');
    const client = await server.database.admin.connect();
    let outcome: Promise<unknown> | undefined;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM knowledge.teamspace WHERE workspace_id = $1 AND id = $2 FOR UPDATE', [workspaceId, record.id]);
      outcome = (operation === 'delete' ? service.removeTeamspace(owner.identity, scope(record))
        : service.updateTeamspace(owner.identity, { ...scope(record), defaultAccess: 'full' })).catch((error: unknown) => error);
      await waitForTeamspaceLock(client);
      const id = randomUUID();
      await client.query('INSERT INTO knowledge.page (workspace_id, id, teamspace_id, position, path, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [workspaceId, id, record.id, 'a0', id.replaceAll('-', '_'), owner.identity.userId]);
      await client.query('COMMIT');
      expect(await outcome).toMatchObject(operation === 'delete' ? { code: 'TEAMSPACE_NOT_EMPTY' } : { defaultAccess: 'full' });
      expect((await result<Teamspace>(request(path(record)))).defaultAccess).toBe(operation === 'delete' ? 'view' : 'full');
      expect((await client.query('SELECT acl_revision FROM knowledge.page WHERE workspace_id = $1 AND id = $2', [workspaceId, id])).rows).toEqual([{ acl_revision: operation === 'delete' ? '0' : '1' }]);
    } finally { await client.query('ROLLBACK'); if (outcome) await outcome; client.release(); }
  });

  test('a session expiring while waiting for the Teamspace lock cannot mutate root defaults', async () => {
    const record = await create('Session deadline', 'view');
    const previous = await server.database.admin.query<{ expires_at: Date }>('SELECT expires_at FROM auth.session WHERE id = $1', [admin.identity.sessionId]);
    const client = await server.database.admin.connect();
    let outcome: Promise<unknown> | undefined;
    try {
      await client.query("UPDATE auth.session SET expires_at = clock_timestamp() + interval '400 milliseconds' WHERE id = $1", [admin.identity.sessionId]);
      await client.query('BEGIN');
      await client.query('SELECT id FROM knowledge.teamspace WHERE workspace_id = $1 AND id = $2 FOR UPDATE', [workspaceId, record.id]);
      outcome = service.updateTeamspace(admin.identity, { ...scope(record), defaultAccess: 'full' }).catch((error: unknown) => error);
      await waitForTeamspaceLock(client);
      await client.query('SELECT pg_sleep(0.45)');
      await client.query('COMMIT');
      expect(await outcome).toMatchObject({ code: 'UNAUTHENTICATED' });
      expect((await result<Teamspace>(request(path(record)))).defaultAccess).toBe('view');
    } finally {
      await client.query('ROLLBACK'); if (outcome) await outcome;
      await client.query('UPDATE auth.session SET expires_at = $2 WHERE id = $1', [admin.identity.sessionId, previous.rows[0]!.expires_at]);
      client.release();
    }
  });

  test('database failure rolls back both fields and returns a sanitized retryable error', async () => {
    const record = await create('Before failure', null);
    await server.database.admin.query(`CREATE FUNCTION knowledge.reject_test_teamspace() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.name = 'Injected failure' THEN RAISE EXCEPTION 'private database failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_test_teamspace BEFORE UPDATE ON knowledge.teamspace FOR EACH ROW EXECUTE FUNCTION knowledge.reject_test_teamspace();`);
    try {
      const failed = await request(path(record), owner, 'PATCH', { name: 'Injected failure', defaultAccess: 'full' });
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({ code: 'ORGANIZATION_UNAVAILABLE', message: 'Organization service is temporarily unavailable.', retryable: true });
      expect(await result<Teamspace>(request(path(record)))).toEqual(record);
    } finally {
      await server.database.admin.query('DROP TRIGGER reject_test_teamspace ON knowledge.teamspace; DROP FUNCTION knowledge.reject_test_teamspace();');
    }
    expect((await result<Teamspace>(request(path(record), owner, 'PATCH', { name: 'Recovered' }))).name).toBe('Recovered');
  });

  test('membership removal and stale or forged sessions immediately reject Teamspace operations', async () => {
    const record = await create('Revoked authority');
    await result(request(`/${workspaceId}/members/${regular.identity.userId}`, owner, 'DELETE', {}));
    expect((await request(path(record), regular)).status).toBe(404);
    await expect(service.getTeamspace({ ...owner.identity, userId: outsider.identity.userId }, scope(record))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await server.database.admin.query('DELETE FROM auth.session WHERE id = $1', [admin.identity.sessionId]);
    expect((await request(path(record), admin, 'PATCH', { defaultAccess: 'full' })).status).toBe(401);
    await expect(service.removeTeamspace(admin.identity, scope(record))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(server.database.idleErrors).toHaveLength(0);
  });
});
