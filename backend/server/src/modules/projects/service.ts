import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { createProjectInputSchema, listProjectsInputSchema, removeProjectInputSchema, renameProjectInputSchema } from '@fouc/shared/projects';
import { project, projectDeliveryWorkObject, projectMember } from '../../platform/database/resources/schema';
import type { ResourceTransaction } from '../../platform/database/resources/transaction';
import { withFoucIdentity, withProject } from '../../platform/database/resources/transaction';
import type { FoucIdentity } from '../../platform/identity/identity';
import { currentIdentity, pageOf, requireManager } from '../../platform/resources/context';
import { ResourceRequestError, parseInput } from '../../platform/resources/errors';

const view = (row: typeof project.$inferSelect) => ({ id: row.id, name: row.name });

/** Projects own their membership independently of knowledgeBases and global resources. */
export function createProjectService(pool: Pool) {
  async function mutate<T>(identity: FoucIdentity, projectId: string, operation: (db: ResourceTransaction) => Promise<T>) {
    return withProject(pool, projectId, identity.sessionId, async (db) => {
      const actor = await currentIdentity(db, identity, true);
      const [record] = await db.select().from(project).where(eq(project.id, projectId)).for('update');
      if (!record) throw new ResourceRequestError('PROJECT_NOT_FOUND', 'Project is not available.', 404);
      await currentIdentity(db, identity);
      const [membership] = await db.select().from(projectMember).where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, actor.userId)));
      if (!membership) throw new ResourceRequestError('PROJECT_NOT_FOUND', 'Project is not available.', 404);
      requireManager(membership.role);
      return operation(db);
    });
  }
  return {
    async list(identity: FoucIdentity, input: unknown = {}) {
      const parsed = parseInput(listProjectsInputSchema, input);
      return withFoucIdentity(pool, identity.sessionId, async (db) => {
        const actor = await currentIdentity(db, identity);
        const rows = await db.select({ project }).from(project)
          .innerJoin(projectMember, and(eq(projectMember.projectId, project.id), eq(projectMember.userId, actor.userId)))
          .where(parsed.cursor ? gt(project.id, parsed.cursor) : undefined).orderBy(asc(project.id)).limit(parsed.limit + 1);
        return pageOf(rows.map(({ project: row }) => view(row)), parsed.limit, (row) => row.id);
      });
    },
    async create(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createProjectInputSchema, input);
      const id = randomUUID();
      return withProject(pool, id, identity.sessionId, async (db) => {
        const actor = await currentIdentity(db, identity, true);
        const [created] = await db.insert(project).values({ ...parsed, id, createdBy: actor.userId }).returning();
        await db.insert(projectMember).values({ projectId: created!.id, userId: actor.userId, role: 'owner' });
        return view(created!);
      });
    },
    async rename(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(renameProjectInputSchema, input);
      return mutate(identity, parsed.projectId, async (db) => {
        const [updated] = await db.update(project).set({ name: parsed.name, updatedAt: new Date() }).where(eq(project.id, parsed.projectId)).returning();
        return view(updated!);
      });
    },
    async remove(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(removeProjectInputSchema, input);
      return mutate(identity, parsed.projectId, async (db) => {
        const workObjects = await db.select({ aggregate: projectDeliveryWorkObject.aggregate }).from(projectDeliveryWorkObject).where(eq(projectDeliveryWorkObject.projectId, parsed.projectId));
        if (workObjects.some(({ aggregate }) => aggregate.runs.some(run => ['reserved', 'queued', 'running', 'waiting_approval'].includes(run.status)) || aggregate.releases.some(release => release.status === 'running'))) {
          throw new ResourceRequestError('CONFLICT', '先停止真实运行或等待发布结束，再删除项目。', 409);
        }
        await db.delete(project).where(eq(project.id, parsed.projectId));
        return { removed: true as const };
      });
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
