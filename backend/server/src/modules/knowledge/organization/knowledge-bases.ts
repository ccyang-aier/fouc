import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Pool } from 'pg';
import { knowledgeBaseScopeSchema } from '@fouc/shared/knowledge/contracts';
import { createKnowledgeBaseInputSchema, listKnowledgeBasesInputSchema, renameKnowledgeBaseInputSchema } from '@fouc/shared/knowledge/contracts';
import { member, knowledgeBase, teamspace } from '../../../platform/database/resources/schema';
import { withFoucIdentity, withKnowledgeBase } from '../../../platform/database/resources/transaction';
import type { FoucIdentity } from '../../../platform/identity/identity';
import { inKnowledgeBase, knowledgeBaseView } from './context';
import { currentIdentity, pageOf, requireManager } from '../../../platform/resources/context';
import { parseInput } from '../../../platform/resources/errors';

export function knowledgeBaseOperations(pool: Pool) {
  return {
    async createKnowledgeBase(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(createKnowledgeBaseInputSchema, input);
      const id = randomUUID();
      return withKnowledgeBase(pool, id, async (db) => {
        const actor = await currentIdentity(db, identity, true);
        const [created] = await db.insert(knowledgeBase).values({ id, ...parsed }).returning();
        await db.insert(member).values({ knowledgeBaseId: id, userId: actor.userId, role: 'owner' });
        await db.insert(teamspace).values({ knowledgeBaseId: id, id: randomUUID(), name: '文档', defaultAccess: 'edit' });
        return knowledgeBaseView(created!);
      });
    },
    async listKnowledgeBases(identity: FoucIdentity, input: unknown = {}) {
      const parsed = parseInput(listKnowledgeBasesInputSchema, input);
      return withFoucIdentity(pool, identity.sessionId, async (db) => {
        const actor = await currentIdentity(db, identity);
        const records = await db.select({ knowledgeBase }).from(knowledgeBase)
          .innerJoin(member, and(eq(member.knowledgeBaseId, knowledgeBase.id), eq(member.userId, actor.userId)))
          .where(parsed.cursor ? gt(knowledgeBase.id, parsed.cursor) : undefined).orderBy(asc(knowledgeBase.id)).limit(parsed.limit + 1);
        return pageOf(records.map((row) => knowledgeBaseView(row.knowledgeBase)), parsed.limit, (row) => row.id);
      });
    },
    async getKnowledgeBase(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(knowledgeBaseScopeSchema, input);
      return inKnowledgeBase(pool, identity, parsed.knowledgeBaseId, false, async (context) => ({ ...knowledgeBaseView(context.knowledgeBase), role: context.role }));
    },
    async renameKnowledgeBase(identity: FoucIdentity, input: unknown) {
      const parsed = parseInput(renameKnowledgeBaseInputSchema, input);
      return inKnowledgeBase(pool, identity, parsed.knowledgeBaseId, true, async ({ db, role }) => {
        requireManager(role);
        const [updated] = await db.update(knowledgeBase).set({ name: parsed.name, updatedAt: new Date() }).where(eq(knowledgeBase.id, parsed.knowledgeBaseId)).returning();
        return { ...knowledgeBaseView(updated!), role };
      });
    },
  };
}
