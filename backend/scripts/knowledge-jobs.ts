import { Pool } from 'pg';
import { readKnowledgeDatabaseConnections } from '../src/database/knowledge/initialize-config';
import { inspectKnowledgeDatabase } from '../src/database/knowledge/initialize-status';
import { initializeKnowledgeJobs } from '../src/knowledge/workers/initialize';

async function main() {
  if (process.argv[2] !== 'init') throw new Error('Usage: bun backend/scripts/knowledge-jobs.ts init');
  const connections = await readKnowledgeDatabaseConnections();
  const admin = new Pool({ connectionString: connections.admin, max: 1, connectionTimeoutMillis: 10_000 });
  const application = new Pool({ connectionString: connections.application, max: 2, connectionTimeoutMillis: 10_000 });
  for (const pool of [admin, application]) pool.on('error', () => {});
  try {
    const database = await inspectKnowledgeDatabase(admin, application);
    if (database.state !== 'ready') throw new Error('Current business schema must be initialized before the queue');
    await initializeKnowledgeJobs(admin, application);
    console.log(JSON.stringify({ state: 'ready', schema: 'knowledge_jobs', runtimeRole: 'verified non-owner/NOBYPASSRLS' }));
  } finally { await Promise.all([admin.end(), application.end()]); }
}
main().catch(() => {
  console.error('Knowledge queue bootstrap failed; verify the command, database roles and current schema. Credentials and database errors are not logged.');
  process.exitCode = 1;
});
