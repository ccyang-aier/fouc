import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { group, workspaceTenantTables, workspace } from './schema';
import { WorkspaceTransactionAbortedError, withWorkspaceTenant } from './tenant';
import { createTenantTestDatabase, seedTenantTestData } from './tenant-test-database';
import type { TenantTestDatabase } from './tenant-test-database';

let database: TenantTestDatabase;
let data: Awaited<ReturnType<typeof seedTenantTestData>>;
const targetScope = sql.identifier('workspace_id');

function postgresError(error: unknown): { code: string; message: string } | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string' && 'message' in error && typeof error.message === 'string') {
    return { code: error.code, message: error.message };
  }
  return 'cause' in error ? postgresError(error.cause) : undefined;
}

async function denied(operation: () => Promise<unknown>) {
  let failure: ReturnType<typeof postgresError>;
  try { await operation(); } catch (error) { failure = postgresError(error); }
  expect(failure?.code).toBe('42501');
  expect(failure?.message).toContain('row-level security');
}

beforeAll(async () => {
  database = await createTenantTestDatabase();
  data = await seedTenantTestData(database.admin);
}, 30_000);

afterAll(async () => {
  if (database) await database.dispose();
}, 30_000);

describe('real PostgreSQL tenant isolation', () => {
  test('runtime role cannot bypass RLS and every business table is ENABLE + FORCE protected', async () => {
    expect(database.role.rolsuper).toBe(false);
    expect(database.role.rolbypassrls).toBe(false);
    expect(database.role.rolcreatedb).toBe(false);
    expect(database.role.rolcreaterole).toBe(false);
    const actual = await database.admin.query<{ name: string; enabled: boolean; forced: boolean; expression: string; check: string; policies: number }>(`
      SELECT c.relname AS name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
        pg_get_expr(p.polqual, p.polrelid) AS expression, pg_get_expr(p.polwithcheck, p.polrelid) AS check,
        (SELECT count(*)::int FROM pg_policy p2 WHERE p2.polrelid = c.oid) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_policy p ON p.polrelid = c.oid AND p.polname = 'tenant_scope'
      WHERE n.nspname = 'workspace' AND c.relkind = 'r'
    `);
    expect(actual.rowCount).toBe(workspaceTenantTables.length);
    for (const row of actual.rows) {
      expect(row.enabled, row.name).toBe(true);
      expect(row.forced, row.name).toBe(true);
      expect(row.expression, row.name).toContain('app.workspace_id');
      expect(row.check, row.name).toBe(row.expression);
      expect(row.policies, row.name).toBe(['member', 'workspace'].includes(row.name) ? 2 : 1);
    }
  });

  test('both tenants see their own populated rows and no other tenant rows in every business table', async () => {
    for (const tenant of data.tenants) {
      await withWorkspaceTenant(database.pool, tenant.workspaceId, async (db) => {
        for (const table of workspaceTenantTables) {
          const result = await db.execute<{ scope: string }>(sql`SELECT ${targetScope}::text AS scope FROM ${table}`);
          expect(result.rows.length, getTableConfig(table).name).toBeGreaterThan(0);
          expect(result.rows.every((row) => row.scope === tenant.workspaceId), getTableConfig(table).name).toBe(true);
        }
      });
    }
  });

  test('no-context reads fail closed for every business table and no-context writes are denied', async () => {
    for (const table of workspaceTenantTables) {
      const { schema, name } = getTableConfig(table);
      const result = await database.pool.query(`SELECT workspace_id FROM "${schema}"."${name}"`);
      expect(result.rowCount, name).toBe(0);
    }
    await denied(() => database.pool.query('INSERT INTO workspace.workspace (workspace_id, name, kind) VALUES ($1, $2, $3)', [randomUUID(), 'No context', 'personal']));
  });

  test('FORCE RLS still filters an ordinary role that owns the table', async () => {
    const owner = await database.admin.query<{ role: string }>('SELECT current_user AS role');
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    await database.admin.query(`ALTER TABLE workspace.workspace OWNER TO ${quote(database.role.name)}`);
    try {
      expect((await database.pool.query('SELECT workspace_id FROM workspace.workspace')).rowCount).toBe(0);
      const own = await withWorkspaceTenant(database.pool, data.tenants[0].workspaceId, (db) => db.select().from(workspace));
      expect(own).toHaveLength(1);
      expect(own[0]?.id).toBe(data.tenants[0].workspaceId);
    } finally {
      await database.admin.query(`ALTER TABLE workspace.workspace OWNER TO ${quote(owner.rows[0]!.role)}`);
      await database.admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON workspace.workspace TO ${quote(database.role.name)}`);
    }
  });

  test('cross-tenant UPDATE and DELETE cannot target rows in any business table', async () => {
    const [alpha, beta] = data.tenants;
    await withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
      for (const table of workspaceTenantTables) {
        const updated = await db.execute(sql`UPDATE ${table} SET ${targetScope} = ${targetScope} WHERE ${targetScope} = ${beta.workspaceId} RETURNING ${targetScope}`);
        const removed = await db.execute(sql`DELETE FROM ${table} WHERE ${targetScope} = ${beta.workspaceId} RETURNING ${targetScope}`);
        expect(updated.rowCount, getTableConfig(table).name).toBe(0);
        expect(removed.rowCount, getTableConfig(table).name).toBe(0);
      }
    });
  });

  test('WITH CHECK rejects inserting foreign-tenant records in every business table', async () => {
    const [alpha, beta] = data.tenants;
    for (const table of workspaceTenantTables) {
      const config = getTableConfig(table);
      const sample = await database.admin.query<{ record: Record<string, unknown> }>(
        `SELECT row_to_json(record) AS record FROM "${config.schema}"."${config.name}" AS record WHERE workspace_id = $1 LIMIT 1`, [beta.workspaceId],
      );
      expect(sample.rowCount, config.name).toBe(1);
      const columns = sql.join(config.columns.filter((column) => !column.generatedIdentity && !column.generated).map((column) => sql.identifier(column.name)), sql`, `);
      await denied(() => withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
        await db.execute(sql`INSERT INTO ${table} (${columns}) SELECT ${columns} FROM jsonb_populate_record(NULL::${table}, ${JSON.stringify(sample.rows[0]!.record)}::jsonb)`);
      }));
    }
  }, 30_000);

  test('WITH CHECK also forbids changing a visible row to another workspace', async () => {
    const [alpha, beta] = data.tenants;
    await denied(() => withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
      await db.update(workspace).set({ id: beta.workspaceId });
    }));
  });

  test('a one-connection pool reuses the same connection after commit without leaking tenant scope', async () => {
    const [alpha, beta] = data.tenants;
    const first = await withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
      const result = await db.execute<{ pid: number; scope: string }>(sql`SELECT pg_backend_pid() AS pid, current_setting('app.workspace_id') AS scope`);
      expect(result.rows[0]?.scope).toBe(alpha.workspaceId);
      return result.rows[0]!.pid;
    });
    const cleared = await database.pool.query<{ pid: number; scope: string | null }>("SELECT pg_backend_pid() AS pid, NULLIF(current_setting('app.workspace_id', true), '') AS scope");
    expect(cleared.rows[0]?.pid).toBe(first);
    expect(cleared.rows[0]?.scope).toBeNull();
    const second = await withWorkspaceTenant(database.pool, beta.workspaceId, async (db) => {
      const result = await db.execute<{ pid: number; scope: string }>(sql`SELECT pg_backend_pid() AS pid, current_setting('app.workspace_id') AS scope`);
      expect(result.rows[0]?.scope).toBe(beta.workspaceId);
      return result.rows[0]!.pid;
    });
    expect(second).toBe(first);
  });

  test('callback failure rolls back writes and clears scope while preserving a reusable connection', async () => {
    const [alpha] = data.tenants;
    const before = await database.pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const id = randomUUID();
    const original = new Error('Abort this request');
    await expect(withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
      await db.insert(group).values({ workspaceId: alpha.workspaceId, id, name: 'Must roll back' });
      throw original;
    })).rejects.toBe(original);
    const after = await database.pool.query<{ pid: number; scope: string | null }>("SELECT pg_backend_pid() AS pid, NULLIF(current_setting('app.workspace_id', true), '') AS scope");
    expect(after.rows[0]?.pid).toBe(before.rows[0]?.pid);
    expect(after.rows[0]?.scope).toBeNull();
    const persisted = await database.admin.query('SELECT 1 FROM workspace."group" WHERE workspace_id = $1 AND id = $2', [alpha.workspaceId, id]);
    expect(persisted.rowCount).toBe(0);
  });

  test('a swallowed SQL error cannot be reported as a successful commit', async () => {
    const [alpha] = data.tenants;
    await expect(withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
      try { await db.execute(sql`SELECT 1 / 0`); } catch { /* Emulate a service accidentally swallowing a query failure. */ }
      return 'must not succeed';
    })).rejects.toBeInstanceOf(WorkspaceTransactionAbortedError);
    const scope = await database.pool.query<{ scope: string | null }>("SELECT NULLIF(current_setting('app.workspace_id', true), '') AS scope");
    expect(scope.rows[0]?.scope).toBeNull();
  });

  test('a terminated borrowed connection is destroyed and the next request receives a clean replacement', async () => {
    const [alpha, beta] = data.tenants;
    let terminatedPid = 0;
    await expect(withWorkspaceTenant(database.pool, alpha.workspaceId, async (db) => {
      const current = await db.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
      terminatedPid = current.rows[0]!.pid;
      await database.admin.query('SELECT pg_terminate_backend($1)', [terminatedPid]);
      await db.execute(sql`SELECT 1`);
    })).rejects.toBeDefined();
    const next = await withWorkspaceTenant(database.pool, beta.workspaceId, async (db) => {
      const result = await db.execute<{ pid: number; scope: string }>(sql`SELECT pg_backend_pid() AS pid, current_setting('app.workspace_id') AS scope`);
      return result.rows[0]!;
    });
    expect(next.pid).not.toBe(terminatedPid);
    expect(next.scope).toBe(beta.workspaceId);
    expect(database.idleErrors).toHaveLength(0);
  });
});
