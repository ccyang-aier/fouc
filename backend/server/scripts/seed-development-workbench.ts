import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { readFoucDatabaseConnections, foucDatabaseErrorMessage } from '../src/platform/database/initialize-config';
import { assertFoucApplicationRole } from '../src/platform/database/initialize-role';
import { installResourceRls } from '../src/platform/database/resources/rls';
import * as tables from '../src/platform/database/resources/schema';
import { resourceSchema } from '../src/platform/database/schema';
import { authUser } from '../src/platform/database/identity/schema';

/** Explicit development reset: business fixtures only, accounts and sessions survive. */
export async function seedDevelopmentWorkbench() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development fixtures cannot run in production.');
  const connections = await readFoucDatabaseConnections();
  const target = new URL(connections.admin);
  // The development PostgreSQL instance may run in the local WSL private network.
  const localHost = target.hostname === 'localhost' || target.hostname === '127.0.0.1' || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(target.hostname);
  if (target.pathname !== '/fouc' || !localHost) {
    throw new Error('This command only resets the local fouc development database.');
  }
  const admin = new Pool({ connectionString: connections.admin, max: 1 });
  const application = new Pool({ connectionString: connections.application, max: 1 });
  const role = await assertFoucApplicationRole(admin, application);
  const client = await admin.connect();
  try {
    const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(resourceSchema, undefined, ['resources']));
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('fouc:database:initialize'))");
    await client.query('DROP SCHEMA IF EXISTS resources CASCADE');
    await client.query(ddl.join('\n'));
    await installResourceRls(client);
    const name = `"${role.name.replaceAll('"', '""')}"`;
    await client.query(`REVOKE ALL ON SCHEMA resources FROM PUBLIC; GRANT USAGE ON SCHEMA resources TO ${name}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA resources TO ${name}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA resources TO ${name}`);
    const db = drizzle(client);
    const adminEmail = (process.env.FOUC_ADMIN_EMAIL ?? 'admin@fouc.local').toLowerCase();
    const [adminUser] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, adminEmail));
    if (!adminUser) throw new Error(`Create the built-in admin account before seeding the development project: ${adminEmail}`);
    const projectId = '50000000-0000-4000-8000-000000000001';
    await db.insert(tables.project).values({ id: projectId, name: 'Fouc 桌面端 V1', createdBy: adminUser.id });
    await db.insert(tables.projectMember).values({ projectId, userId: adminUser.id, role: 'owner' });
    await client.query('COMMIT');
    console.log('Development workbench ready: one project. Accounts preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await Promise.all([admin.end(), application.end()]); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--reset') throw new Error('Use --reset to rebuild the local development business data.');
  seedDevelopmentWorkbench().catch((error: unknown) => { console.error(foucDatabaseErrorMessage(error)); process.exitCode = 1; });
}
