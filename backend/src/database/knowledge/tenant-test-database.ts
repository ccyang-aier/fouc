import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { initializeKnowledgeDatabase } from './initialize';
import { readKnowledgeDatabaseConnections } from './initialize-config';
import { assertKnowledgeApplicationRole } from './initialize-role';
import * as tables from './schema';

const databaseNamePattern = /^fouc_rls_[a-f0-9]{32}$/;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Only databases created by this invocation can be removed by this closure. */
export async function createTenantTestDatabase(options: { initialize?: boolean } = {}) {
  const urls = await readKnowledgeDatabaseConnections();
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
        console.log(`Removed disposable tenant-test database ${name}.`);
      }
    } finally {
      disposed = true;
      await maintenance.end();
    }
  }

  try {
    await maintenance.query(`CREATE DATABASE ${identifier(name)} TEMPLATE template0`);
    created = true;
    console.log(`Created disposable tenant-test database ${name}.`);
    const role = await assertKnowledgeApplicationRole(admin, pool);
    if (options.initialize !== false) await initializeKnowledgeDatabase(admin, pool);
    return { name, admin, pool, role, idleErrors, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export type TenantTestDatabase = Awaited<ReturnType<typeof createTenantTestDatabase>>;

export async function seedTenantTestData(admin: Pool) {
  // The same page/group/etc. UUIDs intentionally occur in both tenants. Only the
  // composite workspace key may distinguish them in joins and foreign keys.
  const ids = {
    teamspace: randomUUID(), group: randomUUID(), page: randomUUID(), database: randomUUID(), row: randomUUID(),
    checkpoint: randomUUID(), thread: randomUUID(), comment: randomUUID(), task: randomUUID(), usage: randomUUID(),
    notification: randomUUID(), outbox: randomUUID(), pat: randomUUID(), share: randomUUID(), credential: randomUUID(),
  };
  const tenants = [
    { workspaceId: randomUUID(), userId: randomUUID(), name: 'Tenant Alpha' },
    { workspaceId: randomUUID(), userId: randomUUID(), name: 'Tenant Beta' },
  ] as const;
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    const db = drizzle(client, { schema: tables.knowledgeSchema });
    for (const tenant of tenants) {
      const { workspaceId, userId, name } = tenant;
      const principal = `user:${userId}` as const;
      await db.insert(tables.authUser).values({ id: userId, name, email: `${userId}@tenant.test` });
      await db.insert(tables.workspace).values({ id: workspaceId, name, kind: 'team' });
      await db.insert(tables.member).values({ workspaceId, userId, role: 'owner' });
      await db.insert(tables.group).values({ workspaceId, id: ids.group, name: 'Editors' });
      await db.insert(tables.groupMember).values({ workspaceId, groupId: ids.group, userId });
      await db.insert(tables.teamspace).values({ workspaceId, id: ids.teamspace, name: 'Team', defaultAccess: 'view' });
      const metadata = { workspaceId, teamspaceId: ids.teamspace, createdBy: userId };
      await db.insert(tables.page).values([
        { ...metadata, id: ids.page, kind: 'doc', path: ids.page.replaceAll('-', '_'), position: 'a0', title: `${name} document` },
        { ...metadata, id: ids.database, kind: 'database', path: ids.database.replaceAll('-', '_'), position: 'a1', title: `${name} database` },
      ]);
      await db.insert(tables.databaseDefinition).values({ workspaceId, pageId: ids.database, teamspaceId: ids.teamspace });
      await db.insert(tables.page).values({
        ...metadata, id: ids.row, parentId: ids.database, databaseId: ids.database, kind: 'row', position: 'a0',
        path: `${ids.database}.${ids.row}`.replaceAll('-', '_'), title: `${name} row`,
      });
      const scope = { workspaceId, pageId: ids.page };
      const state = { state: new Uint8Array([0, 0]), stateVector: new Uint8Array([0]) };
      await db.insert(tables.docState).values({ ...scope, ...state });
      await db.insert(tables.docCheckpoint).values({ ...scope, ...state, id: ids.checkpoint, authors: [userId] });
      await db.insert(tables.pageAcl).values({ ...scope, principal, level: 'full' });
      await db.insert(tables.pageEffectiveAcl).values({ ...scope, view: [principal], comment: [principal], edit: [principal], full: [principal] });
      await db.insert(tables.blockIndex).values({
        ...scope, blockId: 'block-1', blockType: 'paragraph', contentMd: `${name} private block`, contentHash: 'a'.repeat(64),
        embedding: [1, 2], embedModel: 'previous-model', embedDimensions: 2, principals: [principal],
      });
      await db.insert(tables.blockEmbeddingStaging).values({
        ...scope, blockId: 'block-1', contentHash: 'a'.repeat(64), embedding: [1, 2, 3], embedModel: 'replacement-model', embedDimensions: 3,
      });
      await db.insert(tables.backlink).values({ workspaceId, srcPageId: ids.page, srcBlockId: 'block-1', dstPageId: ids.database });
      await db.insert(tables.asset).values({ workspaceId, hash: 'f'.repeat(64), mime: 'text/plain', size: 4 });
      await db.insert(tables.commentThread).values({ ...scope, id: ids.thread });
      await db.insert(tables.comment).values({ workspaceId, id: ids.comment, threadId: ids.thread, authorId: userId, bodyMd: `${name} comment` });
      await db.insert(tables.outbox).values({
        workspaceId, id: ids.outbox, topic: 'doc.changed',
        payload: { ...scope, topic: 'doc.changed', actor: { kind: 'human', userId }, occurredAt: new Date().toISOString() },
      });
      await db.insert(tables.aiTask).values({ workspaceId, id: ids.task, initiatedBy: userId, kind: 'chat' });
      await db.insert(tables.aiUsage).values({ workspaceId, id: ids.usage, userId, taskId: ids.task, tier: 'smart', provider: 'local', model: 'test', durationMs: 1 });
      await db.insert(tables.notification).values({ ...scope, id: ids.notification, userId, kind: 'mention', payload: {} });
      await db.insert(tables.personalAccessToken).values({ workspaceId, id: ids.pat, userId, name: 'Test', tokenHash: 'b'.repeat(64), scopes: ['read'] });
      await db.insert(tables.shareLink).values({ ...scope, id: ids.share, tokenHash: 'c'.repeat(64), createdBy: userId });
      await db.insert(tables.modelCredential).values({ workspaceId, id: ids.credential, userId, provider: 'openai', encryptedSecret: new Uint8Array([1, 2, 3]) });
    }
    await client.query('COMMIT');
    return { tenants, ids };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
