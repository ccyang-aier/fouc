import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { group, member, workspace } from './schema';
import { withFoucIdentity, withKnowledgeTenant } from './tenant';
import { createTenantTestDatabase, seedTenantTestData } from './tenant-test-database';
import { inspectFoucDatabase } from '../initialize-status';
import { knowledgePoliciesForTable } from './rls';
import type { TenantTestDatabase } from './tenant-test-database';

let database: TenantTestDatabase;
let data: Awaited<ReturnType<typeof seedTenantTestData>>;
const sessionId = randomUUID();
const anotherWorkspaceId = randomUUID();

function code(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? code(error.cause) : undefined;
}

async function sqlFailure(operation: () => Promise<unknown>, expected: string) {
  let actual: string | undefined;
  try { await operation(); } catch (error) { actual = code(error); }
  expect(actual).toBe(expected);
}

beforeAll(async () => {
  database = await createTenantTestDatabase();
  data = await seedTenantTestData(database.admin);
  const [alpha, beta] = data.tenants;
  await database.admin.query('UPDATE auth."user" SET email_verified = true WHERE id = $1', [alpha.userId]);
  await database.admin.query('INSERT INTO auth.session (id, user_id, token, expires_at) VALUES ($1, $2, $3, now() + interval \'1 hour\')', [sessionId, alpha.userId, randomUUID()]);
  await database.admin.query('INSERT INTO knowledge.workspace (workspace_id, name, kind) VALUES ($1, $2, $3)', [anotherWorkspaceId, 'Another own workspace', 'personal']);
  await database.admin.query('INSERT INTO knowledge.member (workspace_id, user_id, role) VALUES ($1, $2, $3), ($4, $5, $6)', [anotherWorkspaceId, alpha.userId, 'owner', alpha.workspaceId, beta.userId, 'guest']);
}, 30_000);

afterAll(async () => { if (database) await database.dispose(); }, 30_000);

describe('verified session identity discovery RLS', () => {
  test('deployment check detects a weakened identity discovery policy', async () => {
    await database.admin.query('ALTER POLICY own_identity ON knowledge.member USING (true)');
    try {
      const status = await inspectFoucDatabase(database.admin, database.pool);
      expect(status.state).toBe('incomplete');
      expect(status.issues).toContain('Tenant policy differs from current definition: knowledge.member');
    } finally {
      const policy = knowledgePoliciesForTable(member).find((item) => item.name === 'own_identity')!;
      await database.admin.query(`ALTER POLICY own_identity ON knowledge.member USING (${policy.using})`);
    }
    expect((await inspectFoucDatabase(database.admin, database.pool)).state).toBe('ready');
  });

  test('can discover only own memberships/workspaces, never another member or tenant content', async () => {
    const own = await withFoucIdentity(database.pool, sessionId, async (db) => ({
      workspaces: await db.select().from(workspace), memberships: await db.select().from(member), groups: await db.select().from(group),
    }));
    expect(own.workspaces.map((row) => row.id).sort()).toEqual([data.tenants[0].workspaceId, anotherWorkspaceId].sort());
    expect(own.memberships).toHaveLength(2);
    expect(own.memberships.every((row) => row.userId === data.tenants[0].userId)).toBe(true);
    expect(own.groups).toHaveLength(0);
    expect((await database.pool.query('SELECT * FROM knowledge.workspace')).rowCount).toBe(0);
  });

  test('identity transaction is genuinely read-only, not just a narrowed TypeScript surface', async () => {
    await sqlFailure(() => withFoucIdentity(database.pool, sessionId, (db) => db.execute(sql`UPDATE ${workspace} SET name = 'forbidden'`)), '25006');
    await sqlFailure(() => withFoucIdentity(database.pool, sessionId, (db) => db.execute(sql`DELETE FROM ${member}`)), '25006');
    await sqlFailure(() => withFoucIdentity(database.pool, sessionId, (db) => db.execute(sql`INSERT INTO ${workspace} (workspace_id, name, kind) VALUES (${randomUUID()}, 'forbidden', 'personal')`)), '25006');
  });

  test('SELECT-only identity policies do not grant UPDATE, DELETE or INSERT even in a writable transaction', async () => {
    const client = await database.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.auth_session_id', $1, true)", [sessionId]);
      expect((await client.query('SELECT * FROM knowledge.workspace')).rowCount).toBe(2);
      expect((await client.query('UPDATE knowledge.workspace SET name = name RETURNING *')).rowCount).toBe(0);
      expect((await client.query('DELETE FROM knowledge.member RETURNING *')).rowCount).toBe(0);
      await sqlFailure(() => client.query('INSERT INTO knowledge.workspace (workspace_id, name, kind) VALUES ($1, $2, $3)', [randomUUID(), 'No write scope', 'personal']), '42501');
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  test('unknown, expired and unverified sessions fail closed', async () => {
    const discover = (id: string) => withFoucIdentity(database.pool, id, (db) => db.select().from(workspace));
    expect(await discover(randomUUID())).toHaveLength(0);
    await database.admin.query('UPDATE auth.session SET expires_at = now() - interval \'1 second\' WHERE id = $1', [sessionId]);
    expect(await discover(sessionId)).toHaveLength(0);
    await database.admin.query('UPDATE auth.session SET expires_at = now() + interval \'1 hour\' WHERE id = $1', [sessionId]);
    await database.admin.query('UPDATE auth."user" SET email_verified = false WHERE id = $1', [data.tenants[0].userId]);
    expect(await discover(sessionId)).toHaveLength(0);
    await database.admin.query('UPDATE auth."user" SET email_verified = true WHERE id = $1', [data.tenants[0].userId]);
    expect(await discover(sessionId)).toHaveLength(2);
  });

  test('commit and rollback clear identity scope on the same reused physical connection', async () => {
    const readScope = () => database.pool.query<{ pid: number; identity: string | null; tenant: string | null }>("SELECT pg_backend_pid() AS pid, NULLIF(current_setting('app.auth_session_id', true), '') AS identity, NULLIF(current_setting('app.workspace_id', true), '') AS tenant");
    const before = (await readScope()).rows[0]!;
    const pid = await withFoucIdentity(database.pool, sessionId, async (db) => {
      const result = await db.execute<{ pid: number; id: string; tenant: string }>(sql`SELECT pg_backend_pid() AS pid, current_setting('app.auth_session_id') AS id, current_setting('app.workspace_id') AS tenant`);
      expect(result.rows[0]!.id).toBe(sessionId);
      expect(result.rows[0]!.tenant).toBe('');
      return result.rows[0]!.pid;
    });
    expect(pid).toBe(before.pid);
    expect((await readScope()).rows[0]).toEqual({ pid, identity: null, tenant: null });
    await expect(withFoucIdentity(database.pool, sessionId, async () => { throw new Error('rollback identity request'); })).rejects.toThrow('rollback identity request');
    expect((await readScope()).rows[0]).toEqual({ pid, identity: null, tenant: null });
    await withKnowledgeTenant(database.pool, data.tenants[1].workspaceId, async (db) => {
      const rows = await db.select().from(workspace);
      expect(rows.map((row) => row.id)).toEqual([data.tenants[1].workspaceId]);
      const identity = await db.execute<{ id: string }>(sql`SELECT current_setting('app.auth_session_id') AS id`);
      expect(identity.rows[0]!.id).toBe('');
    });
  });

  test('each scope actively clears a previous session-wide setting for the duration of its transaction', async () => {
    await database.pool.query("SELECT set_config('app.auth_session_id', $1, false)", [sessionId]);
    try {
      await withKnowledgeTenant(database.pool, data.tenants[1].workspaceId, async (db) => {
        expect((await db.select().from(workspace)).map((row) => row.id)).toEqual([data.tenants[1].workspaceId]);
      });
    } finally { await database.pool.query('RESET app.auth_session_id'); }
    await database.pool.query("SELECT set_config('app.workspace_id', $1, false)", [data.tenants[1].workspaceId]);
    try {
      await withFoucIdentity(database.pool, sessionId, async (db) => {
        expect((await db.select().from(workspace)).some((row) => row.id === data.tenants[1].workspaceId)).toBe(false);
      });
    } finally { await database.pool.query('RESET app.workspace_id'); }
  });

  test('session revocation immediately removes all discovery access', async () => {
    await database.admin.query('DELETE FROM auth.session WHERE id = $1', [sessionId]);
    expect(await withFoucIdentity(database.pool, sessionId, (db) => db.select().from(workspace))).toHaveLength(0);
    expect(await withFoucIdentity(database.pool, sessionId, (db) => db.select().from(member))).toHaveLength(0);
  });

  test('a session expiring inside an open read-only transaction is no longer discoverable', async () => {
    const shortSession = randomUUID();
    await database.admin.query("INSERT INTO auth.session (id, user_id, token, expires_at) VALUES ($1, $2, $3, clock_timestamp() + interval '300 milliseconds')", [shortSession, data.tenants[0].userId, randomUUID()]);
    await withFoucIdentity(database.pool, shortSession, async (db) => {
      expect(await db.select().from(workspace)).toHaveLength(2);
      await db.execute(sql`SELECT pg_sleep(0.35)`);
      expect(await db.select().from(workspace)).toHaveLength(0);
      expect(await db.select().from(member)).toHaveLength(0);
    });
  });
});
