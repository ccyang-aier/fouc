import { authUser } from '../identity/schema';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { initializeFoucDatabase } from '../initialize';
import { readFoucDatabaseConnections } from '../initialize-config';
import { assertFoucApplicationRole } from '../initialize-role';
import * as tables from '../schema';

const databaseNamePattern = /^fouc_rls_[a-f0-9]{32}$/;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Only databases created by this invocation can be removed by this closure. */
export async function createResourceTestDatabase(options: { initialize?: boolean } = {}) {
  const urls = await readFoucDatabaseConnections();
  const name = `fouc_rls_${randomUUID().replaceAll('-', '')}`;
  if (!databaseNamePattern.test(name)) throw new Error('Invalid disposable database name');
  const maintenance = new Pool({ connectionString: urls.admin.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  const databaseAdminUrl = new URL(urls.admin);
  const applicationUrl = new URL(urls.application);
  databaseAdminUrl.pathname = `/${name}`;
  applicationUrl.pathname = `/${name}`;
  const admin = new Pool({ connectionString: databaseAdminUrl.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  const pool = new Pool({ connectionString: applicationUrl.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  const idleErrors: Error[] = [];
  for (const source of [maintenance, admin, pool]) source.on('error', (error) => idleErrors.push(error));
  let created = false;
  let disposed = false;

  async function dispose() {
    if (disposed) return;
    await Promise.all([pool.end(), admin.end()]);
    try {
      if (created) {
        if (!databaseNamePattern.test(name)) throw new Error('Refusing to remove an unrecognized database');
        await maintenance.query(`DROP DATABASE ${identifier(name)} WITH (FORCE)`);
        created = false;
        const remains = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
        if (remains.rowCount !== 0) throw new Error('Disposable database cleanup did not complete');
        console.log(`Removed disposable resource-test database ${name}.`);
      }
    } finally {
      disposed = true;
      await maintenance.end();
    }
  }

  try {
    await maintenance.query(`CREATE DATABASE ${identifier(name)} TEMPLATE template0`);
    created = true;
    console.log(`Created disposable resource-test database ${name}.`);
    const role = await assertFoucApplicationRole(admin, pool);
    if (options.initialize !== false) await initializeFoucDatabase(admin, pool);
    return { name, admin, pool, role, idleErrors, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export type ResourceTestDatabase = Awaited<ReturnType<typeof createResourceTestDatabase>>;

export async function seedResourceTestData(admin: Pool) {
  const resources = ['Resource Alpha', 'Resource Beta'].map(name => ({ projectId: randomUUID(), userId: randomUUID(), name }));
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    const db = drizzle(client, { schema: tables.resourceSchema });
    for (const { projectId, userId, name } of resources) {
      await db.insert(authUser).values({ id: userId, name, email: `${userId}@resource.test` });
      await db.insert(tables.project).values({ id: projectId, name, createdBy: userId });
      await db.insert(tables.projectMember).values({ projectId, userId, role: 'owner' });
    }
    await client.query('COMMIT');
    return { resources };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
