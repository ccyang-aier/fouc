import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, expect, test } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import * as Y from 'yjs';
import { initializeKnowledgeDatabase } from './initialize';
import { readKnowledgeDatabaseConnections } from './initialize-config';
import { inspectKnowledgeDatabase } from './initialize-status';
import { createTenantTestDatabase, seedTenantTestData } from './tenant-test-database';
import type { TenantTestDatabase } from './tenant-test-database';
import { withKnowledgeTenant } from './tenant';
import * as tables from './schema';

let database: TenantTestDatabase;
let data: Awaited<ReturnType<typeof seedTenantTestData>>;

function errorDetails(error: unknown): { code: string; constraint?: string } | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string') return { code: error.code, constraint: 'constraint' in error && typeof error.constraint === 'string' ? error.constraint : undefined };
  return 'cause' in error ? errorDetails(error.cause) : undefined;
}

async function violates(operation: () => Promise<unknown>, code: string, constraint?: string) {
  let failure: ReturnType<typeof errorDetails>;
  try { await operation(); } catch (error) { failure = errorDetails(error); }
  expect(failure?.code).toBe(code);
  if (constraint) expect(failure?.constraint).toBe(constraint);
}

function runCommand(command: string, environment: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../../../scripts/knowledge-db.ts', import.meta.url)), command], {
      env: { ...process.env, ...environment }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

beforeAll(async () => {
  database = await createTenantTestDatabase();
  data = await seedTenantTestData(database.admin);
}, 30_000);

afterAll(async () => {
  if (database) await database.dispose();
}, 30_000);

describe('current schema initialization against PostgreSQL', () => {
  test('catalog matches all current tables, column types, constraints, indexes, RLS and least-privilege grants', async () => {
    const status = await inspectKnowledgeDatabase(database.admin, database.pool);
    expect(status.state).toBe('ready');
    expect(status.tables).toBe(tables.allKnowledgeTables.length);
    expect(status.forcedTenantTables).toBe(tables.knowledgeBusinessTables.length);
    expect(status.issues).toEqual([]);
  });

  test('init refuses existing schemas without modifying their data', async () => {
    await expect(initializeKnowledgeDatabase(database.admin, database.pool)).rejects.toMatchObject({ code: 'already_initialized' });
    const count = await database.admin.query<{ total: number }>('SELECT count(*)::int AS total FROM knowledge.workspace');
    expect(count.rows[0]?.total).toBe(2);
    expect((await inspectKnowledgeDatabase(database.admin, database.pool)).state).toBe('ready');
  });

  test('init rejects an administrative application connection before schema changes', async () => {
    await expect(initializeKnowledgeDatabase(database.admin, database.admin)).rejects.toMatchObject({ code: 'unsafe_role' });
  });

  test('runtime grants do not permit table creation, RLS disabling, or TRUNCATE bypass', async () => {
    await violates(() => database.pool.query('CREATE TABLE knowledge.not_allowed (id int)'), '42501');
    await violates(() => database.pool.query('ALTER TABLE knowledge.workspace DISABLE ROW LEVEL SECURITY'), '42501');
    await violates(() => database.pool.query('TRUNCATE knowledge.workspace CASCADE'), '42501');
  });

  test('read-only check detects a permissive policy substitution', async () => {
    const client = await database.admin.connect();
    try {
      await client.query('BEGIN');
      await client.query('ALTER POLICY tenant_scope ON knowledge.workspace USING (true) WITH CHECK (true)');
      const changed = await inspectKnowledgeDatabase(client, database.pool);
      expect(changed.state).toBe('incomplete');
      expect(changed.issues).toContain('Tenant policy differs from current definition: knowledge.workspace');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  test('status/check/init commands handle an empty database and leave business tables empty', async () => {
    const empty = await createTenantTestDatabase({ initialize: false });
    try {
      const connections = await readKnowledgeDatabaseConnections();
      const admin = new URL(connections.admin);
      const application = new URL(connections.application);
      admin.pathname = application.pathname = `/${empty.name}`;
      const environment = { DATABASE_ADMIN_URL: admin.toString(), DATABASE_URL: application.toString() };
      const status = await runCommand('status', environment);
      expect(status.code).toBe(0);
      expect(JSON.parse(status.stdout).state).toBe('empty');
      const emptyCheck = await runCommand('check', environment);
      expect(emptyCheck.code).toBe(1);
      expect(emptyCheck.stderr).toContain('database is empty');
      const initialized = await runCommand('init', environment);
      expect(initialized.code, initialized.stderr).toBe(0);
      expect(JSON.parse(initialized.stdout).state).toBe('ready');
      const checked = await runCommand('check', environment);
      expect(checked.code, checked.stderr).toBe(0);
      expect(JSON.parse(checked.stdout).state).toBe('ready');
      const count = await empty.admin.query<{ total: number }>('SELECT count(*)::int AS total FROM knowledge.workspace');
      expect(count.rows[0]?.total).toBe(0);
      const repeated = await runCommand('init', environment);
      expect(repeated.code).toBe(1);
      expect(repeated.stderr).toContain('schemas already exist');
      for (const result of [status, emptyCheck, initialized, checked, repeated]) {
        expect(result.stdout + result.stderr).not.toContain(admin.password);
        expect(result.stdout + result.stderr).not.toContain(application.password);
      }
    } finally { await empty.dispose(); }
  }, 30_000);

  test('a failure after current DDL is applied rolls back schemas and permits a clean retry', async () => {
    const empty = await createTenantTestDatabase({ initialize: false });
    try {
      await empty.admin.query(`
        CREATE FUNCTION public.fouc_test_reject_policy() RETURNS event_trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Test initialization failure' USING ERRCODE = 'P0001'; END $$;
        CREATE EVENT TRIGGER fouc_test_reject_policy ON ddl_command_end WHEN TAG IN ('CREATE POLICY')
          EXECUTE FUNCTION public.fouc_test_reject_policy();
      `);
      await violates(() => initializeKnowledgeDatabase(empty.admin, empty.pool), 'P0001');
      const after = await inspectKnowledgeDatabase(empty.admin, empty.pool);
      expect(after.state).toBe('empty');
      expect(after.schemas).toEqual([]);
      expect(after.extensions).toEqual([]);
      await empty.admin.query('DROP EVENT TRIGGER fouc_test_reject_policy; DROP FUNCTION public.fouc_test_reject_policy();');
      await initializeKnowledgeDatabase(empty.admin, empty.pool);
      expect((await inspectKnowledgeDatabase(empty.admin, empty.pool)).state).toBe('ready');
    } finally { await empty.dispose(); }
  }, 30_000);
});

describe('real PostgreSQL constraints and Yjs persistence', () => {
  test('composite foreign keys cannot attach records to another tenant', async () => {
    const [alpha, beta] = data.tenants;
    const foreignTeamspace = randomUUID();
    const foreignPage = randomUUID();
    const foreignThread = randomUUID();
    await withKnowledgeTenant(database.pool, beta.workspaceId, async (db) => {
      await db.insert(tables.teamspace).values({ workspaceId: beta.workspaceId, id: foreignTeamspace, name: 'Private team' });
      await db.insert(tables.page).values({ workspaceId: beta.workspaceId, id: foreignPage, teamspaceId: foreignTeamspace, path: foreignPage.replaceAll('-', '_'), position: 'a0', createdBy: beta.userId });
      await db.insert(tables.commentThread).values({ workspaceId: beta.workspaceId, id: foreignThread, pageId: foreignPage });
    });
    const id = randomUUID();
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.groupMember).values({ workspaceId: alpha.workspaceId, groupId: data.ids.group, userId: beta.userId })), '23503', 'group_member_membership_fk');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.page).values({ workspaceId: alpha.workspaceId, id, teamspaceId: foreignTeamspace, path: id.replaceAll('-', '_'), position: 'a0', createdBy: alpha.userId })), '23503', 'page_teamspace_fk');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.docState).values({ workspaceId: alpha.workspaceId, pageId: foreignPage, state: new Uint8Array([0, 0]), stateVector: new Uint8Array([0]) })), '23503');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.backlink).values({ workspaceId: alpha.workspaceId, srcPageId: data.ids.page, srcBlockId: 'block-1', dstPageId: foreignPage })), '23503');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.comment).values({ workspaceId: alpha.workspaceId, id: randomUUID(), threadId: foreignThread, authorId: alpha.userId, bodyMd: 'Forbidden link' })), '23503', 'comment_thread_fk');
  });

  test('database rows require a local database definition whose page is actually kind=database', async () => {
    const [alpha, beta] = data.tenants;
    const foreignDatabase = randomUUID();
    await withKnowledgeTenant(database.pool, beta.workspaceId, async (db) => {
      await db.insert(tables.page).values({ workspaceId: beta.workspaceId, id: foreignDatabase, teamspaceId: data.ids.teamspace, kind: 'database', path: foreignDatabase.replaceAll('-', '_'), position: 'a2', createdBy: beta.userId });
      await db.insert(tables.databaseDefinition).values({ workspaceId: beta.workspaceId, pageId: foreignDatabase, teamspaceId: data.ids.teamspace });
    });
    const id = randomUUID();
    const row = { workspaceId: alpha.workspaceId, id, teamspaceId: data.ids.teamspace, parentId: data.ids.database, path: `${data.ids.database}.${id}`.replaceAll('-', '_'), position: 'a1', createdBy: alpha.userId, kind: 'row' as const };
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.page).values({ ...row, databaseId: null })), '23514', 'page_row_database_relation');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.page).values({ ...row, databaseId: data.ids.page })), '23503', 'page_database_fk');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.page).values({ ...row, databaseId: foreignDatabase })), '23503', 'page_database_fk');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.page).values({ ...row, kind: 'doc', databaseId: data.ids.database })), '23514', 'page_row_database_relation');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.databaseDefinition).values({ workspaceId: alpha.workspaceId, pageId: data.ids.page, teamspaceId: data.ids.teamspace })), '23503', 'database_definition_page_fk');
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.insert(tables.databaseDefinition).values({ workspaceId: alpha.workspaceId, pageId: data.ids.page, teamspaceId: data.ids.teamspace, pageKind: 'doc' })), '23514', 'database_definition_database_kind');
  });

  test('vector dimensions are checked while old and replacement models coexist', async () => {
    const [alpha] = data.tenants;
    await violates(() => withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.update(tables.blockIndex).set({ embedDimensions: 3 })), '23514', 'block_index_embedding_metadata');
    const vectors = await withKnowledgeTenant(database.pool, alpha.workspaceId, async (db) => ({
      active: await db.select().from(tables.blockIndex), staging: await db.select().from(tables.blockEmbeddingStaging),
    }));
    expect(vectors.active[0]?.embedding).toEqual([1, 2]);
    expect(vectors.staging[0]?.embedding).toEqual([1, 2, 3]);
  });

  test('stored bytea state and state vectors restore a real Y.Doc and converge after concurrent edits', async () => {
    const [alpha] = data.tenants;
    const docs = Array.from({ length: 5 }, () => new Y.Doc({ gc: true }));
    const [original, first, second, restored, checkpoint] = docs as [Y.Doc, Y.Doc, Y.Doc, Y.Doc, Y.Doc];
    try {
      original.getText('content').insert(0, '共同的知识库');
      const baseState = Y.encodeStateAsUpdate(original);
      const baseVector = Y.encodeStateVector(original);
      await withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.update(tables.docState).set({ state: baseState, stateVector: baseVector }).where(eq(tables.docState.pageId, data.ids.page)));
      const saved = await withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.select().from(tables.docState).where(eq(tables.docState.pageId, data.ids.page)));
      expect(saved[0]?.state).toBeInstanceOf(Uint8Array);
      expect(saved[0]?.stateVector).toEqual(baseVector);
      Y.applyUpdate(first, saved[0]!.state);
      Y.applyUpdate(second, saved[0]!.state);
      first.getText('content').insert(0, '甲：');
      second.getText('content').insert(second.getText('content').length, ' — 乙');
      const firstDelta = Y.encodeStateAsUpdate(first, saved[0]!.stateVector);
      const secondDelta = Y.encodeStateAsUpdate(second, saved[0]!.stateVector);
      Y.applyUpdate(first, secondDelta);
      Y.applyUpdate(second, firstDelta);
      expect(first.getText('content').toString()).toBe(second.getText('content').toString());
      const merged = { state: Y.encodeStateAsUpdate(first), stateVector: Y.encodeStateVector(first) };
      const checkpointId = randomUUID();
      await withKnowledgeTenant(database.pool, alpha.workspaceId, async (db) => {
        await db.update(tables.docState).set(merged).where(eq(tables.docState.pageId, data.ids.page));
        await db.insert(tables.docCheckpoint).values({ workspaceId: alpha.workspaceId, pageId: data.ids.page, id: checkpointId, authors: [alpha.userId], label: 'Concurrent merge', ...merged });
      });
      const loaded = await withKnowledgeTenant(database.pool, alpha.workspaceId, async (db) => ({
        current: await db.select().from(tables.docState).where(eq(tables.docState.pageId, data.ids.page)),
        checkpoint: await db.select().from(tables.docCheckpoint).where(eq(tables.docCheckpoint.id, checkpointId)),
      }));
      Y.applyUpdate(restored, loaded.current[0]!.state);
      Y.applyUpdate(checkpoint, loaded.checkpoint[0]!.state);
      Y.applyUpdate(original, Y.encodeStateAsUpdate(restored, baseVector));
      for (const doc of [original, second, restored, checkpoint]) expect(doc.getText('content').toString()).toBe(first.getText('content').toString());
      expect(Y.encodeStateVector(restored)).toEqual(loaded.current[0]!.stateVector);
      expect(Y.encodeStateVector(checkpoint)).toEqual(loaded.checkpoint[0]!.stateVector);
      expect(restored.gc).toBe(true);
    } finally { for (const doc of docs) doc.destroy(); }
  });

  test('document state and its Outbox event roll back together on failure', async () => {
    const [alpha] = data.tenants;
    const before = await withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.select().from(tables.docState).where(eq(tables.docState.pageId, data.ids.page)));
    const eventId = randomUUID();
    const failure = new Error('Abort document persistence');
    await expect(withKnowledgeTenant(database.pool, alpha.workspaceId, async (db) => {
      await db.update(tables.docState).set({ state: new Uint8Array([0, 0]), stateVector: new Uint8Array([0]) }).where(eq(tables.docState.pageId, data.ids.page));
      await db.insert(tables.outbox).values({ workspaceId: alpha.workspaceId, id: eventId, topic: 'doc.changed', payload: { workspaceId: alpha.workspaceId, topic: 'doc.changed', pageId: data.ids.page, actor: { kind: 'human', userId: alpha.userId }, occurredAt: new Date().toISOString() } });
      throw failure;
    })).rejects.toBe(failure);
    const after = await withKnowledgeTenant(database.pool, alpha.workspaceId, async (db) => ({
      state: await db.select().from(tables.docState).where(eq(tables.docState.pageId, data.ids.page)),
      event: await db.select().from(tables.outbox).where(and(eq(tables.outbox.id, eventId), eq(tables.outbox.workspaceId, alpha.workspaceId))),
    }));
    expect(after.state[0]?.state).toEqual(before[0]!.state);
    expect(after.state[0]?.stateVector).toEqual(before[0]!.stateVector);
    expect(after.event).toHaveLength(0);
    expect((await withKnowledgeTenant(database.pool, alpha.workspaceId, (db) => db.execute(sql`SELECT 1`))).rowCount).toBe(1);
  });
});
