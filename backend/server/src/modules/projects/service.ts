import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { createProjectInputSchema, listProjectsInputSchema, removeProjectInputSchema, renameProjectInputSchema } from '@fouc/shared/projects';
import { project } from '../../platform/database/workspace/schema';
import type { FoucIdentity } from '../../platform/identity/identity';
import { inWorkspace, pageOf, requireDirectory, requireManager } from '../workspaces/context';
import { OrganizationError, parseInput } from '../workspaces/errors';

const view = (row: typeof project.$inferSelect) => ({ id: row.id, workspaceId: row.workspaceId, name: row.name });

/** Projects are workspace children; no knowledge-base ID enters these operations. */
export function createProjectService(pool: Pool) {
  return {
    async list(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(listProjectsInputSchema, input);
      return inWorkspace(pool, identity, scope.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        const rows = await db.select().from(project).where(and(eq(project.workspaceId, scope.workspaceId), scope.cursor ? gt(project.id, scope.cursor) : undefined)).orderBy(asc(project.id)).limit(scope.limit + 1);
        return pageOf(rows.map(view), scope.limit, (row) => row.id);
      });
    },
    async create(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(createProjectInputSchema, input);
      return inWorkspace(pool, identity, scope.workspaceId, true, async ({ db, role, actor }) => {
        requireManager(role);
        const [created] = await db.insert(project).values({ ...scope, id: randomUUID(), createdBy: actor.userId }).returning();
        return view(created!);
      });
    },
    async rename(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(renameProjectInputSchema, input);
      return inWorkspace(pool, identity, scope.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const [updated] = await db.update(project).set({ name: scope.name, updatedAt: new Date() }).where(and(eq(project.workspaceId, scope.workspaceId), eq(project.id, scope.projectId))).returning();
        if (!updated) throw new OrganizationError('PROJECT_NOT_FOUND', 'Project was not found in this workspace.', 404);
        return view(updated);
      });
    },
    async remove(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(removeProjectInputSchema, input);
      return inWorkspace(pool, identity, scope.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const [removed] = await db.delete(project).where(and(eq(project.workspaceId, scope.workspaceId), eq(project.id, scope.projectId))).returning({ id: project.id });
        if (!removed) throw new OrganizationError('PROJECT_NOT_FOUND', 'Project was not found in this workspace.', 404);
        return { removed: true as const };
      });
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
