import { pageScopeSchema, permissionLevelSchema, workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import { authorizePageAccess } from '../../knowledge/permissions';
import { createKnowledgeRouter, knowledgeQuery } from './procedures';

/** Infrastructure plus the P03 page ACL query. Page content and writes arrive with T01+/B01+. */
export const knowledgeApiRouter = createKnowledgeRouter({
  access: knowledgeQuery({
    input: workspaceScopeSchema,
    scopes: ['read'],
    resolve: ({ ctx }) => ({
      workspaceId: ctx.authority.workspaceId,
      userId: ctx.authority.userId,
      role: ctx.authority.role,
      actor: ctx.authority.actor,
      credentialKind: ctx.authority.credential.kind,
      scopes: ctx.authority.scopes,
    }),
  }),
  page: {
    /** One authorization per action. Denied, rebuilding and missing pages share one shape. */
    access: knowledgeQuery({
      input: pageScopeSchema.extend({ action: permissionLevelSchema }),
      scopes: ['read'],
      resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
        const decision = await authorizePageAccess(db, { userId: authority.userId, scope: { workspaceId: input.workspaceId, pageId: input.pageId }, required: input.action });
        if (decision.decision !== 'allow') return { workspaceId: input.workspaceId, pageId: input.pageId, authorized: false, level: null };
        return { workspaceId: input.workspaceId, pageId: input.pageId, authorized: true, level: decision.level };
      }),
    }),
  },
});

export type KnowledgeApiRouter = typeof knowledgeApiRouter;
