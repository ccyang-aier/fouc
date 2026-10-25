import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { project, projectMember } from './schema';
import { withFoucIdentity } from './transaction';
import { createResourceTestDatabase, seedResourceTestData } from './resource-test-database';
import { inspectFoucDatabase } from '../initialize-status';
import { resourcePoliciesForTable } from './rls';
import type { ResourceTestDatabase } from './resource-test-database';

let database: ResourceTestDatabase;
let data: Awaited<ReturnType<typeof seedResourceTestData>>;
const sessionId = randomUUID();
const anotherProjectId = randomUUID();

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
  database = await createResourceTestDatabase();
  data = await seedResourceTestData(database.admin);
  const [alpha, beta] = data.resources;
  await database.admin.query('UPDATE auth."user" SET email_verified = true WHERE id = $1', [alpha.userId]);
  await database.admin.query("INSERT INTO auth.session (id, user_id, token, expires_at) VALUES ($1, $2, $3, now() + interval '1 hour')", [sessionId, alpha.userId, randomUUID()]);
  await database.admin.query('INSERT INTO resources.project (id, name, created_by) VALUES ($1, $2, $3)', [anotherProjectId, 'Another own project', alpha.userId]);
  await database.admin.query('INSERT INTO resources.project_member (project_id, user_id, role) VALUES ($1, $2, $3), ($4, $5, $6)', [anotherProjectId, alpha.userId, 'owner', alpha.projectId, beta.userId, 'guest']);
}, 30_000);
afterAll(async () => { if (database) await database.dispose(); }, 30_000);

describe('verified session identity discovery RLS', () => {
  test('deployment check detects a weakened identity discovery policy', async () => {
    await database.admin.query('ALTER POLICY own_identity ON resources.project_member USING (true)');
    try {
      const status = await inspectFoucDatabase(database.admin, database.pool);
      expect(status.state).toBe('incomplete');
      expect(status.issues).toContain('Resource policy differs from current definition: resources.project_member');
    } finally {
      const policy = resourcePoliciesForTable(projectMember).find(item => item.name === 'own_identity')!;
      await database.admin.query(`ALTER POLICY own_identity ON resources.project_member USING (${policy.using})`);
    }
    expect((await inspectFoucDatabase(database.admin, database.pool)).state).toBe('ready');
  });
  test('can discover only own projects and own memberships', async () => {
    const own = await withFoucIdentity(database.pool, sessionId, async db => ({
      projects: await db.select().from(project), memberships: await db.select().from(projectMember),
    }));
    expect(own.projects.map(row => row.id).sort()).toEqual([data.resources[0].projectId, anotherProjectId].sort());
    expect(own.memberships).toHaveLength(2);
    expect(own.memberships.every(row => row.userId === data.resources[0].userId)).toBe(true);
    expect((await database.pool.query('SELECT * FROM resources.project')).rowCount).toBe(0);
  });
  test('identity transaction is read-only for UPDATE, DELETE and INSERT', async () => {
    await sqlFailure(() => withFoucIdentity(database.pool, sessionId, db => db.execute(sql`UPDATE ${project} SET name = 'forbidden'`)), '25006');
    await sqlFailure(() => withFoucIdentity(database.pool, sessionId, db => db.execute(sql`DELETE FROM ${projectMember}`)), '25006');
    await sqlFailure(() => withFoucIdentity(database.pool, sessionId, db => db.execute(sql`INSERT INTO ${project} (id, name, created_by) VALUES (${randomUUID()}, 'forbidden', ${data.resources[0].userId})`)), '25006');
  });
  test('SELECT-only discovery policies grant no mutations in a writable transaction', async () => {
    const client = await database.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.auth_session_id', $1, true)", [sessionId]);
      expect((await client.query('SELECT * FROM resources.project')).rowCount).toBe(2);
      expect((await client.query('UPDATE resources.project SET name = name RETURNING *')).rowCount).toBe(0);
      expect((await client.query('DELETE FROM resources.project_member RETURNING *')).rowCount).toBe(0);
      await sqlFailure(() => client.query('INSERT INTO resources.project (id, name, created_by) VALUES ($1, $2, $3)', [randomUUID(), 'No write scope', data.resources[0].userId]), '42501');
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
  test('unknown, expired and unverified sessions fail closed', async () => {
    const discover = (id: string) => withFoucIdentity(database.pool, id, db => db.select().from(project));
    expect(await discover(randomUUID())).toHaveLength(0);
    await database.admin.query("UPDATE auth.session SET expires_at = now() - interval '1 second' WHERE id = $1", [sessionId]);
    expect(await discover(sessionId)).toHaveLength(0);
    await database.admin.query("UPDATE auth.session SET expires_at = now() + interval '1 hour' WHERE id = $1", [sessionId]);
    await database.admin.query('UPDATE auth."user" SET email_verified = false WHERE id = $1', [data.resources[0].userId]);
    expect(await discover(sessionId)).toHaveLength(0);
    await database.admin.query('UPDATE auth."user" SET email_verified = true WHERE id = $1', [data.resources[0].userId]);
    expect(await discover(sessionId)).toHaveLength(2);
  });
  test('discovery clears a previous project setting and commit/rollback clear the local identity', async () => {
    await database.pool.query("SELECT set_config('app.project_id', $1, false)", [data.resources[1].projectId]);
    try {
      await withFoucIdentity(database.pool, sessionId, async db => {
        expect((await db.select().from(project)).some(row => row.id === data.resources[1].projectId)).toBe(false);
      });
    } finally { await database.pool.query('RESET app.project_id'); }
    const read = () => database.pool.query("SELECT NULLIF(current_setting('app.auth_session_id', true), '') AS identity");
    expect((await read()).rows[0].identity).toBeNull();
    await expect(withFoucIdentity(database.pool, sessionId, async () => { throw new Error('rollback request'); })).rejects.toThrow('rollback request');
    expect((await read()).rows[0].identity).toBeNull();
  });
  test('revocation immediately removes discovery access', async () => {
    await database.admin.query('DELETE FROM auth.session WHERE id = $1', [sessionId]);
    expect(await withFoucIdentity(database.pool, sessionId, db => db.select().from(project))).toHaveLength(0);
    expect(await withFoucIdentity(database.pool, sessionId, db => db.select().from(projectMember))).toHaveLength(0);
  });
  test('session expiry inside an open transaction removes discovery access', async () => {
    const shortSession = randomUUID();
    await database.admin.query("INSERT INTO auth.session (id, user_id, token, expires_at) VALUES ($1, $2, $3, clock_timestamp() + interval '300 milliseconds')", [shortSession, data.resources[0].userId, randomUUID()]);
    await withFoucIdentity(database.pool, shortSession, async db => {
      expect(await db.select().from(project)).toHaveLength(2);
      await db.execute(sql`SELECT pg_sleep(0.35)`);
      expect(await db.select().from(project)).toHaveLength(0);
      expect(await db.select().from(projectMember)).toHaveLength(0);
    });
  });
});
