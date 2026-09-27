import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { initializeFoucDatabase } from '../src/database/initialize';
import { FoucDatabaseError, foucDatabaseErrorMessage, readFoucDatabaseConnections } from '../src/database/initialize-config';
import { inspectFoucDatabase } from '../src/database/initialize-status';

export async function runFoucDatabaseCommand(command: string, environment: NodeJS.ProcessEnv = process.env) {
  if (!['init', 'status', 'check'].includes(command)) throw new FoucDatabaseError('invalid_config', 'Usage: bun backend/scripts/database.ts [init|status|check]');
  const connections = await readFoucDatabaseConnections(environment);
  const admin = new Pool({ connectionString: connections.admin, max: 1, connectionTimeoutMillis: 10_000 });
  const application = new Pool({ connectionString: connections.application, max: 1, connectionTimeoutMillis: 10_000 });
  // An idle socket error is handled by pg-pool; output stays credential-free.
  for (const pool of [admin, application]) pool.on('error', () => {});
  try {
    if (command === 'init') await initializeFoucDatabase(admin, application);
    const status = await inspectFoucDatabase(admin, application);
    if (command !== 'status' && status.state !== 'ready') {
      throw new FoucDatabaseError('check_failed', `Fouc database is ${status.state}: ${status.issues.join('; ') || 'run init on an empty database'}`);
    }
    return status;
  } finally {
    await Promise.all([admin.end(), application.end()]);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFoucDatabaseCommand(process.argv[2] ?? 'status').then((status) => {
    console.log(JSON.stringify(status, null, 2));
  }).catch((error: unknown) => {
    console.error(foucDatabaseErrorMessage(error));
    process.exitCode = 1;
  });
}
