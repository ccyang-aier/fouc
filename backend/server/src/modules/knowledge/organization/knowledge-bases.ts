import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { createKnowledgeBaseInputSchema, listKnowledgeBasesInputSchema } from '@fouc/shared/knowledge/contracts';
import { knowledgeBase, teamspace } from '../../../platform/database/knowledge/schema';
import type { FoucIdentity } from '../../../platform/identity/identity';
import { inWorkspace, pageOf, requireDirectory, requireManager } from './context';
import { parseInput } from './errors';

const view = (row: typeof knowledgeBase.$inferSelect) => ({ id: row.id, workspaceId: row.workspaceId, name: row.name });

export function knowledgeBaseOperations(pool: Pool) {
  return {
    async listKnowledgeBases(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(listKnowledgeBasesInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, false, async ({ db, role }) => {
        requireDirectory(role);
        const rows = await db.select().from(knowledgeBase).where(and(eq(knowledgeBase.workspaceId, parsed.workspaceId), parsed.cursor ? gt(knowledgeBase.id, parsed.cursor) : undefined)).orderBy(asc(knowledgeBase.id)).limit(parsed.limit + 1);
        return pageOf(rows.map(view), parsed.limit, (row) => row.id);
      });
    },
    async createKnowledgeBase(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createKnowledgeBaseInputSchema, input);
      return inWorkspace(pool, identity, parsed.workspaceId, true, async ({ db, role }) => {
        requireManager(role);
        const id = randomUUID();
        const [created] = await db.insert(knowledgeBase).values({ ...parsed, id }).returning();
        await db.insert(teamspace).values({ workspaceId: parsed.workspaceId, knowledgeBaseId: id, id: randomUUID(), name: '文档', defaultAccess: 'edit' });
        return view(created!);
      });
    },
  };
}
