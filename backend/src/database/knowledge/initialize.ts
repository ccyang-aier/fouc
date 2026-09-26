import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { KnowledgeDatabaseError } from './initialize-config';
import { assertKnowledgeApplicationRole } from './initialize-role';
import { inspectKnowledgeDatabase, knowledgeDatabaseSchemas } from './initialize-status';
import { installKnowledgeRls } from './rls';

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Create the current schema once. Existing schemas are never modified or reset. */
export async function initializeKnowledgeDatabase(admin: Pool, application: Pool): Promise<void> {
  const role = await assertKnowledgeApplicationRole(admin, application);
  const currentSql = await readFile(new URL('./current.sql', import.meta.url), 'utf8');
  const client = await admin.connect();
  let reusable = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('fouc:knowledge:initialize'))");
    const existing = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = ANY($1::text[])', [[...knowledgeDatabaseSchemas]]);
    if (existing.rowCount) throw new KnowledgeDatabaseError('already_initialized', 'Knowledge schemas already exist. Use status or check; init never changes existing schemas.');
    await client.query(currentSql);
    await installKnowledgeRls(client);
    const applicationRole = identifier(role.name);
    await client.query(`REVOKE ALL ON SCHEMA knowledge, knowledge_auth FROM PUBLIC, ${applicationRole}`);
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA knowledge, knowledge_auth FROM PUBLIC, ${applicationRole}`);
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA knowledge, knowledge_auth FROM PUBLIC, ${applicationRole}`);
    await client.query(`GRANT USAGE ON SCHEMA knowledge, knowledge_auth, paradedb, pdb TO ${applicationRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA knowledge, knowledge_auth TO ${applicationRole}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA knowledge, knowledge_auth TO ${applicationRole}`);
    const verified = await inspectKnowledgeDatabase(client, application);
    if (verified.state !== 'ready') throw new KnowledgeDatabaseError('check_failed', `Knowledge initialization checks failed: ${verified.issues.join('; ')}`);
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
