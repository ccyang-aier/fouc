import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, expect, test } from 'bun:test';
import { initializeFoucDatabase } from './initialize';
import { readFoucDatabaseConnections } from './initialize-config';
import { inspectFoucDatabase } from './initialize-status';
import { createResourceTestDatabase, seedResourceTestData } from './resources/resource-test-database';
import type { ResourceTestDatabase } from './resources/resource-test-database';
import * as tables from './schema';

let database: ResourceTestDatabase;

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
    const child = spawn(process.execPath, [fileURLToPath(new URL('../../../scripts/database.ts', import.meta.url)), command], {
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
  database = await createResourceTestDatabase();
  await seedResourceTestData(database.admin);
}, 30_000);

afterAll(async () => {
  if (database) await database.dispose();
}, 30_000);

describe('current schema initialization against PostgreSQL', () => {
  test('catalog matches all current tables, column types, constraints, indexes, RLS and least-privilege grants', async () => {
    const status = await inspectFoucDatabase(database.admin, database.pool);
    expect(status.state).toBe('ready');
    expect(status.tables).toBe(tables.allApplicationTables.length);
    expect(status.forcedResourceTables).toBe(tables.resourceTables.length);
    expect(status.issues).toEqual([]);
  });

  test('init refuses existing schemas without modifying their data', async () => {
    await expect(initializeFoucDatabase(database.admin, database.pool)).rejects.toMatchObject({ code: 'already_initialized' });
    const count = await database.admin.query<{ total: number }>('SELECT count(*)::int AS total FROM resources.project');
    expect(count.rows[0]?.total).toBe(2);
    expect((await inspectFoucDatabase(database.admin, database.pool)).state).toBe('ready');
  });

  test('init rejects an administrative application connection before schema changes', async () => {
    await expect(initializeFoucDatabase(database.admin, database.admin)).rejects.toMatchObject({ code: 'unsafe_role' });
  });

  test('runtime grants do not permit table creation, RLS disabling, or TRUNCATE bypass', async () => {
    await violates(() => database.pool.query('CREATE TABLE resources.not_allowed (id int)'), '42501');
    await violates(() => database.pool.query('ALTER TABLE resources.project DISABLE ROW LEVEL SECURITY'), '42501');
    await violates(() => database.pool.query('TRUNCATE resources.project CASCADE'), '42501');
  });

  test('read-only check detects a permissive policy substitution', async () => {
    const client = await database.admin.connect();
    try {
      await client.query('BEGIN');
      await client.query('ALTER POLICY project_scope ON resources.project USING (true) WITH CHECK (true)');
      const changed = await inspectFoucDatabase(client, database.pool);
      expect(changed.state).toBe('incomplete');
      expect(changed.issues).toContain('Resource policy differs from current definition: resources.project');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  test('status/check/init commands handle an empty database and leave business tables empty', async () => {
    const empty = await createResourceTestDatabase({ initialize: false });
    try {
      const connections = await readFoucDatabaseConnections();
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
      const count = await empty.admin.query<{ total: number }>('SELECT count(*)::int AS total FROM resources.project');
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
    const empty = await createResourceTestDatabase({ initialize: false });
    try {
      await empty.admin.query(`
        CREATE FUNCTION public.fouc_test_reject_policy() RETURNS event_trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Test initialization failure' USING ERRCODE = 'P0001'; END $$;
        CREATE EVENT TRIGGER fouc_test_reject_policy ON ddl_command_end WHEN TAG IN ('CREATE POLICY')
          EXECUTE FUNCTION public.fouc_test_reject_policy();
      `);
      await violates(() => initializeFoucDatabase(empty.admin, empty.pool), 'P0001');
      const after = await inspectFoucDatabase(empty.admin, empty.pool);
      expect(after.state).toBe('empty');
      expect(after.schemas).toEqual([]);
      await empty.admin.query('DROP EVENT TRIGGER fouc_test_reject_policy; DROP FUNCTION public.fouc_test_reject_policy();');
      await initializeFoucDatabase(empty.admin, empty.pool);
      expect((await inspectFoucDatabase(empty.admin, empty.pool)).state).toBe('ready');
    } finally { await empty.dispose(); }
  }, 30_000);
});
