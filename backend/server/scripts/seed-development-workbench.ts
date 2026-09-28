import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { createDevelopmentWorkspaces, developmentId } from '@fouc/shared/development-workbench';
import { repairBlockIds } from '@fouc/shared/knowledge/schema';
import { readFoucDatabaseConnections, foucDatabaseErrorMessage } from '../src/platform/database/initialize-config';
import { assertFoucApplicationRole } from '../src/platform/database/initialize-role';
import { installWorkspaceRls } from '../src/platform/database/workspace/rls';
import * as tables from '../src/platform/database/workspace/schema';
import { workspaceTenantSchema } from '../src/platform/database/schema';
import { authUser } from '../src/platform/database/identity/schema';
import { markdownSchema } from '../src/modules/knowledge/import-export/body';
import { prosemirrorDocToYDoc } from '../src/modules/knowledge/import-export/y-encoding';

/** Explicit development reset: business fixtures only, accounts and sessions survive. */
export async function seedDevelopmentWorkbench() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development fixtures cannot run in production.');
  const connections = await readFoucDatabaseConnections();
  const target = new URL(connections.admin);
  // The development PostgreSQL instance may run in the local WSL private network.
  if (target.pathname !== '/fouc' || !/^(localhost|127\.0\.0\.1|172\.17\.\d+\.\d+)$/.test(target.hostname)) {
    throw new Error('This command only resets the local fouc development database.');
  }
  const admin = new Pool({ connectionString: connections.admin, max: 1 });
  const application = new Pool({ connectionString: connections.application, max: 1 });
  const role = await assertFoucApplicationRole(admin, application);
  const client = await admin.connect();
  try {
    const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(workspaceTenantSchema, undefined, ['workspace']));
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('fouc:database:initialize'))");
    await client.query('DROP SCHEMA IF EXISTS knowledge CASCADE');
    await client.query('DROP SCHEMA IF EXISTS workspace CASCADE');
    await client.query(ddl.join('\n'));
    await installWorkspaceRls(client);
    const name = `"${role.name.replaceAll('"', '""')}"`;
    await client.query(`REVOKE ALL ON SCHEMA workspace FROM PUBLIC; GRANT USAGE ON SCHEMA workspace TO ${name}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workspace TO ${name}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workspace TO ${name}`);
    const db = drizzle(client);
    const users = await db.select({ id: authUser.id }).from(authUser);
    const fixtures = createDevelopmentWorkspaces();
    const schema = markdownSchema();
    for (const [index, space] of fixtures.entries()) {
      await db.insert(tables.workspace).values({ id: space.id, name: space.name, kind: index === 1 ? 'personal' : 'team' });
      if (users.length) await db.insert(tables.member).values(users.map((user) => ({ workspaceId: space.id, userId: user.id, role: 'owner' as const })));
      if (index === 0) await db.insert(tables.project).values({ workspaceId: space.id, id: developmentId(0x50000000, 1), name: 'Fouc 桌面端 V1', createdBy: users[0]?.id });
      for (const base of space.bases) {
        await db.insert(tables.knowledgeBase).values({ id: base.id, workspaceId: space.id, name: base.name });
        if (base.folders.length) await db.insert(tables.teamspace).values(base.folders.map((folder) => ({ ...folder, defaultAccess: 'edit' as const })));
        for (const [position, document] of base.documents.entries()) {
          if (!users[0]) continue;
          const scope = { workspaceId: space.id, pageId: document.id };
          const principals = [`workspace:${space.id}` as const];
          await db.insert(tables.page).values({ workspaceId: space.id, id: document.id, teamspaceId: document.folderId,
            path: document.id.replaceAll('-', '_'), position: `a${String(position).padStart(4, '0')}`, title: document.title,
            createdBy: users[0].id, updatedAt: new Date(document.updatedAt),
            properties: { displayCreator: document.creator, fileSource: document.source, indexStatus: document.indexStatus },
          });
          const node = repairBlockIds(schema.nodeFromJSON(document.body)).doc;
          const encoded = prosemirrorDocToYDoc(node);
          await db.insert(tables.docState).values({ ...scope, state: encoded.state, stateVector: encoded.stateVector });
          encoded.ydoc.destroy();
          await db.insert(tables.pageEffectiveAcl).values({ ...scope, view: principals, comment: principals, edit: principals });
          const blocks: (typeof tables.blockIndex.$inferInsert)[] = [];
          node.forEach((block) => {
            const text = block.textContent;
            blocks.push({ ...scope, blockId: block.attrs.blockId, blockType: block.type.name, contentMd: text,
              contentHash: createHash('sha256').update(text).digest('hex'), principals });
          });
          await db.insert(tables.blockIndex).values(blocks);
        }
      }
    }
    // Development jobs referring to the discarded fixtures must not retry forever.
    const queue = await client.query("SELECT to_regclass('knowledge_jobs._private_jobs') AS table_name");
    if (queue.rows[0].table_name) await client.query('DELETE FROM knowledge_jobs._private_jobs');
    await client.query('COMMIT');
    const documentCount = users.length ? fixtures.reduce((sum, space) => sum + space.bases.reduce((count, base) => count + base.documents.length, 0), 0) : 0;
    console.log(`Development workbench ready: ${fixtures.length} workspaces, ${fixtures.reduce((sum, space) => sum + space.bases.length, 0)} knowledge bases, ${documentCount} documents. Accounts preserved.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await Promise.all([admin.end(), application.end()]); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--reset') throw new Error('Use --reset to rebuild the local development business data.');
  seedDevelopmentWorkbench().catch((error: unknown) => { console.error(foucDatabaseErrorMessage(error)); process.exitCode = 1; });
}
