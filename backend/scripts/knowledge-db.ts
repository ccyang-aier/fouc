import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { initializeKnowledgeDatabase } from '../src/database/knowledge/initialize';
import { KnowledgeDatabaseError, knowledgeDatabaseErrorMessage, readKnowledgeDatabaseConnections } from '../src/database/knowledge/initialize-config';
import { inspectKnowledgeDatabase } from '../src/database/knowledge/initialize-status';

export async function runKnowledgeDatabaseCommand(command: string, environment: NodeJS.ProcessEnv = process.env) {
  if (!['init', 'status', 'check'].includes(command)) throw new KnowledgeDatabaseError('invalid_config', 'Usage: bun backend/scripts/knowledge-db.ts [init|status|check]');
  const connections = await readKnowledgeDatabaseConnections(environment);
  const admin = new Pool({ connectionString: connections.admin, max: 1, connectionTimeoutMillis: 10_000 });
  const application = new Pool({ connectionString: connections.application, max: 1, connectionTimeoutMillis: 10_000 });
  // An idle socket error is handled by pg-pool; output stays credential-free.
  for (const pool of [admin, application]) pool.on('error', () => {});
  try {
    if (command === 'init') await initializeKnowledgeDatabase(admin, application);
    const status = await inspectKnowledgeDatabase(admin, application);
    if (command !== 'status' && status.state !== 'ready') {
      throw new KnowledgeDatabaseError('check_failed', `Knowledge database is ${status.state}: ${status.issues.join('; ') || 'run init on an empty database'}`);
    }
    return status;
  } finally {
    await Promise.all([admin.end(), application.end()]);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runKnowledgeDatabaseCommand(process.argv[2] ?? 'status').then((status) => {
    console.log(JSON.stringify(status, null, 2));
  }).catch((error: unknown) => {
    console.error(knowledgeDatabaseErrorMessage(error));
    process.exitCode = 1;
  });
}
