import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { FoucDatabaseError } from './initialize-config';
import { assertFoucApplicationRole } from './initialize-role';
import { inspectFoucDatabase, foucDatabaseSchemas } from './initialize-status';
import { installWorkspaceRls } from './workspace/rls';

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Create the current schema once. Existing schemas are never modified or reset. */
export async function initializeFoucDatabase(admin: Pool, application: Pool): Promise<void> {
  const role = await assertFoucApplicationRole(admin, application);
  const currentSql = await readFile(new URL('./current.sql', import.meta.url), 'utf8');
  const client = await admin.connect();
  let reusable = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('fouc:database:initialize'))");
    const existing = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = ANY($1::text[])', [[...foucDatabaseSchemas]]);
    if (existing.rowCount) throw new FoucDatabaseError('already_initialized', 'Fouc schemas already exist. Use status or check; init never changes existing schemas.');
    await client.query(currentSql);
    await installWorkspaceRls(client);
    const applicationRole = identifier(role.name);
    await client.query(`REVOKE ALL ON SCHEMA workspace, auth FROM PUBLIC, ${applicationRole}`);
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA workspace, auth FROM PUBLIC, ${applicationRole}`);
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA workspace, auth FROM PUBLIC, ${applicationRole}`);
    await client.query(`GRANT USAGE ON SCHEMA workspace, auth, paradedb, pdb TO ${applicationRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workspace, auth TO ${applicationRole}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workspace, auth TO ${applicationRole}`);
    const verified = await inspectFoucDatabase(client, application);
    if (verified.state !== 'ready') throw new FoucDatabaseError('check_failed', `Knowledge initialization checks failed: ${verified.issues.join('; ')}`);
    await client.query('COMMIT');
    reusable = true;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      reusable = true;
    } catch { reusable = false; }
    throw error;
  } finally {
    client.release(!reusable);
  }
}
