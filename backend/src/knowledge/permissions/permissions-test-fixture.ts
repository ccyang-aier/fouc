import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { OutboxEvent, PageScope, PermissionLevel, Principal, Teamspace } from '@fouc/shared/knowledge/contracts';
import { createKnowledgeApiRoutes } from '../../api/knowledge/http';
import { knowledgeApiRouter } from '../../api/knowledge/router';
import { blockIndex, groupMember, member, page } from '../../database/knowledge/schema';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { createAuthTestServer, responseCookie, testPassword } from '../../identity/auth-test-server';
import { createKnowledgeRequestAuthenticator, createKnowledgeTokenService } from '../access';
import type { KnowledgeRequestAuthenticator, KnowledgeTokenScope } from '../access';
import type { FoucAuth } from '../../identity/service';
import type { FoucIdentity } from '../../identity/identity';

type KnowledgeTokenService = ReturnType<typeof createKnowledgeTokenService>;
import { createOrganizationRoutes } from '../organization/http';
import { createOrganizationService } from '../organization/service';
import type { OrganizationService } from '../organization/service';
import type { RunningRole } from '../../runtime/lifecycle';
import { initializeKnowledgeJobs } from '../workers/initialize';
import { startKnowledgeWorker } from '../workers/runner';
import type { KnowledgeConsumer, KnowledgeWorkerDiagnostic } from '../workers/types';
import { expandPrincipals } from './effective';
import { teamspacePermissionInvalidator } from './fence';
import { withAuthorizedPageTreeMutation } from './mutations';
import { effectivePageAccessCondition, indexedBlockAccessCondition } from './queries';
import { createPermissionRebuildConsumer } from './rebuild';

export interface PermissionTestActor { cookie: string; identity: FoucIdentity }
type AclEvent = Extract<OutboxEvent, { topic: 'acl.changed' }>;

export async function until(check: () => Promise<boolean>, timeout = 10_000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeout) throw new Error('Permission acceptance condition timed out');
    await delay(15);
  }
}

export function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

/** Real HTTP identities/organization, real queue, ordinary-role business writes. */
/** Extra routes an embedding test mounts into the same authenticated server. */
export type PermissionsFixtureMount = (app: Hono, context: { auth: FoucAuth; pool: Pool; authenticator: KnowledgeRequestAuthenticator }) => void;

export async function createPermissionsFixture(options: { mount?: PermissionsFixtureMount } = {}) {
  let pool!: Pool;
  let organization!: OrganizationService;
  let authenticator!: KnowledgeRequestAuthenticator;
  let tokens!: KnowledgeTokenService;
  const errors: Error[] = [];
  const server = await createAuthTestServer({ mount(app, { database, auth }) {
    pool = new Pool({ ...database.pool.options, max: 8 });
    pool.on('error', (error) => errors.push(error));
    authenticator = createKnowledgeRequestAuthenticator({ auth, pool });
    tokens = createKnowledgeTokenService({ auth, pool });
    organization = createOrganizationService(pool, { permissions: teamspacePermissionInvalidator });
    app.route('/', createOrganizationRoutes(auth, organization));
    app.route('/', createKnowledgeApiRoutes({ auth, pool }));
    options.mount?.(app, { auth, pool, authenticator });
  } });
  const admin = server.database.admin;
  const runners = new Set<RunningRole>();
  await initializeKnowledgeJobs(admin, pool);
  async function actor(name: string): Promise<PermissionTestActor> {
    const email = `${name}@permission.test`;
    const signup = await server.request('/sign-up/email', { email, name, password: testPassword });
    if (signup.status !== 200 || (await server.request(server.verificationPath(email))).status !== 302) throw new Error('Permission fixture authentication failed');
    const signed = await server.request('/sign-in/email', { email, password: testPassword });
    if (signed.status !== 200) throw new Error('Permission fixture sign-in failed');
    const cookie = responseCookie(signed);
    const response = await fetch(`${server.origin}/test/identity`, { headers: { cookie } });
    if (response.status !== 200) throw new Error('Permission fixture identity failed');
    return { cookie, identity: await response.json() as FoucIdentity };
  }
  const owner = await actor('owner'), foreign = await actor('foreign'), reader = await actor('reader');
  const alpha = await organization.createWorkspace(owner.identity, { name: 'Alpha', kind: 'team' });
  const beta = await organization.createWorkspace(foreign.identity, { name: 'Beta', kind: 'personal' });
  const invitation = await organization.createInvitation(owner.identity, { workspaceId: alpha.id, email: reader.identity.email, role: 'member' });
  await organization.acceptInvitation(reader.identity, { workspaceId: alpha.id, invitationId: invitation.invitation.id, token: invitation.token });

  async function jobs() {
    return (await admin.query<{ id: string; task: string; attempts: number; last_error: string | null }>(
      'SELECT j.id::text, t.identifier AS task, j.attempts, j.last_error FROM knowledge_jobs._private_jobs j JOIN knowledge_jobs._private_tasks t ON t.id=j.task_id',
    )).rows;
  }
  async function start(options: { consumer?: KnowledgeConsumer; diagnostics?: KnowledgeWorkerDiagnostic[] } = {}) {
    const runner = await startKnowledgeWorker({ pool, consumers: [options.consumer ?? createPermissionRebuildConsumer(pool)], concurrency: 2, pollIntervalMs: 20,
      shutdownAbortAfterMs: 100, observer: (event) => options.diagnostics?.push(event) });
    runners.add(runner);
    return runner;
  }
  async function stop(runner: RunningRole) { await runner.close(); runners.delete(runner); }
  async function drain() { const runner = await start(); try { await until(async () => (await jobs()).length === 0); } finally { await stop(runner); } }
  async function resetJobs() {
    for (const runner of runners) await runner.close();
    runners.clear();
    await admin.query('DELETE FROM knowledge_jobs._private_jobs; DELETE FROM knowledge.outbox');
  }
  async function tree(options: { teamspace?: Teamspace; tenant?: 'alpha' | 'beta'; defaultAccess?: PermissionLevel | null; parents?: (number | null)[]; breaks?: number[]; recycled?: number[]; ids?: string[] } = {}) {
    const workspaceId = options.tenant === 'beta' ? beta.id : alpha.id;
    const author = options.tenant === 'beta' ? foreign : owner;
    const space = options.teamspace ?? await organization.createTeamspace(author.identity, { workspaceId, name: 'Permission tree', defaultAccess: options.defaultAccess === undefined ? 'view' : options.defaultAccess });
    const parents = options.parents ?? [null, 0, 1, 0];
    const pages: (PageScope & { parentId: string | null; path: string })[] = [];
    for (const [index, parentIndex] of parents.entries()) {
      const id = options.ids?.[index] ?? randomUUID();
      const parent = parentIndex === null ? undefined : pages[parentIndex];
      if (parentIndex !== null && !parent) throw new Error('Invalid test tree');
      pages.push({ workspaceId, pageId: id, parentId: parent?.pageId ?? null, path: `${parent ? `${parent.path}.` : ''}${id.replaceAll('-', '_')}` });
    }
    const root = { workspaceId, pageId: pages[0]!.pageId };
    await withKnowledgeTenant(pool, workspaceId, (db) => withAuthorizedPageTreeMutation(db, root, async () => {
      for (let offset = 0; offset < pages.length; offset += 250) {
        const batch = pages.slice(offset, offset + 250);
        await db.insert(page).values(batch.map((node, batchIndex) => ({ workspaceId, id: node.pageId, parentId: node.parentId, path: node.path, teamspaceId: space.id, position: `a${offset + batchIndex}`, createdBy: author.identity.userId,
          inheritsPermissions: !options.breaks?.includes(offset + batchIndex), deletedAt: options.recycled?.includes(offset + batchIndex) ? new Date() : null })));
        await db.insert(blockIndex).values(batch.map((node) => ({ workspaceId, pageId: node.pageId, blockId: 'text', blockType: 'paragraph', contentMd: 'Tenant-scoped content', contentHash: 'a'.repeat(64) })));
      }
    }));
    return { root, pages, teamspace: space };
  }
  async function latestEvent(scope: PageScope): Promise<AclEvent> {
    const result = await admin.query<{ payload: AclEvent }>("SELECT payload FROM knowledge.outbox WHERE workspace_id=$1 AND topic='acl.changed' AND payload->>'rootPageId'=$2 ORDER BY (payload->>'revision')::bigint DESC LIMIT 1", [scope.workspaceId, scope.pageId]);
    if (!result.rows[0]) throw new Error('Expected an ACL event');
    return result.rows[0].payload;
  }
  async function access(scope: PageScope, principals: Principal[], required: PermissionLevel = 'view') {
    return withKnowledgeTenant(pool, scope.workspaceId, async (db) => ({
      pages: (await db.select({ id: page.id }).from(page).where(and(eq(page.id, scope.pageId), effectivePageAccessCondition({ workspaceId: scope.workspaceId, principals, required })))).length,
      blocks: (await db.select({ id: blockIndex.id }).from(blockIndex).where(and(eq(blockIndex.pageId, scope.pageId), indexedBlockAccessCondition({ workspaceId: scope.workspaceId, principals })))).length,
    }));
  }
  async function subjects(userId: string, workspaceId = alpha.id) {
    return withKnowledgeTenant(pool, workspaceId, async (db) => {
      const [membership] = await db.select().from(member).where(and(eq(member.workspaceId, workspaceId), eq(member.userId, userId)));
      if (!membership) return [];
      const groups = await db.select().from(groupMember).where(and(eq(groupMember.workspaceId, workspaceId), eq(groupMember.userId, userId)));
      return expandPrincipals({ workspaceId, userId, member: membership, groups });
    });
  }
  function patchTeamspace(space: Teamspace, body: unknown, actor = owner) {
    return fetch(`${server.origin}/api/knowledge/workspaces/${space.workspaceId}/teamspaces/${space.id}`, { method: 'PATCH', headers: { cookie: actor.cookie, origin: server.webOrigin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
  async function waitForWorkspaceLock(client: PoolClient) {
    await until(async () => {
      await client.query('SELECT pg_stat_clear_snapshot()');
      return (await client.query<{ waiting: boolean }>(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename=$1 AND wait_event_type='Lock' AND query LIKE '%workspace%for update%') AS waiting`, [server.database.role.name])).rows[0]!.waiting;
    });
  }
  return { server, admin, pool, authenticator, owner, foreign, reader, alpha, beta, organization, errors,
    async createToken(actor: PermissionTestActor, scopes: KnowledgeTokenScope[], workspaceId = alpha.id) {
      const created = await tokens.create(new Request(`${server.origin}/test-token-setup`, { method: 'POST', headers: { origin: server.webOrigin, cookie: actor.cookie } }),
        { workspaceId, name: 'Collaboration test', scopes, expiresAt: null });
      if (!('token' in created)) throw new Error('Token creation failed');
      return `Bearer ${created.token}`;
    },
    tree, jobs, start, stop, drain, resetJobs, latestEvent, access, subjects, patchTeamspace, waitForWorkspaceLock,
    apiClient(headers: Record<string, string> = {}, workspaceId = alpha.id) {
      return createTRPCClient<typeof knowledgeApiRouter>({ links: [httpLink({ url: `${server.origin}/api/knowledge/${workspaceId}/trpc`, headers })] });
    },
    async close() { await resetJobs(); await pool.end(); await server.close(); },
  };
}

export type PermissionsFixture = Awaited<ReturnType<typeof createPermissionsFixture>>;
