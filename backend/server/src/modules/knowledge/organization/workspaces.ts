import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { createWorkspaceInputSchema, listWorkspacesInputSchema, renameWorkspaceInputSchema, workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import { member, workspace } from '../../../platform/database/knowledge/schema';
import { withFoucIdentity, withKnowledgeTenant } from '../../../platform/database/knowledge/tenant';
import type { FoucIdentity } from '../../../platform/identity/identity';
import { currentIdentity, inWorkspace, pageOf, requireManager, workspaceView } from './context';
import { parseInput } from './errors';

export function workspaceOperations(pool: Pool) {
  return {
    async createWorkspace(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createWorkspaceInputSchema, input);
      const id = randomUUID();
      return withKnowledgeTenant(pool, id, async (db) => {
        const actor = await currentIdentity(db, identity, true);
        const [created] = await db.insert(workspace).values({ id, ...parsed }).returning();
        await db.insert(member).values({ workspaceId: id, userId: actor.userId, role: 'owner' });
        return { ...workspaceView(created!), role: 'owner' as const };
      });
    },
    async listWorkspaces(identity: FoucIdentity, input: unknown = {}) {
      const parsed = parseInput(listWorkspacesInputSchema, input);
      return withFoucIdentity(pool, identity.sessionId, async (db) => {
        const actor = await currentIdentity(db, identity);
        const records = await db.select({ workspace, role: member.role }).from(workspace)
          .innerJoin(member, and(eq(member.workspaceId, workspace.id), eq(member.userId, actor.userId)))
          .where(parsed.cursor ? gt(workspace.id, parsed.cursor) : undefined).orderBy(asc(workspace.id)).limit(parsed.limit + 1);
        return pageOf(records.map((row) => ({ ...workspaceView(row.workspace), role: row.role })), parsed.limit, (row) => row.id);
      });
    },
    async getWorkspace(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(workspaceScopeSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async (context) => ({ ...workspaceView(context.workspace), role: context.role }));
    },
    async renameWorkspace(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(renameWorkspaceInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const [updated] = await db.update(workspace).set({ name: parsed.name, updatedAt: new Date() }).where(eq(workspace.id, parsed.workspaceId)).returning();
        return { ...workspaceView(updated!), role };
      });
    },
  };
}
